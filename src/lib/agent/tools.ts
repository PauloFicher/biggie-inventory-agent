/**
 * P1 - Biggie Inventory Agent: Tool Implementations
 *
 * Cada tool es una funcion async que recibe los argumentos que
 * OpenAI envia via function calling y ejecuta contra Supabase.
 *
 * Todas las funciones usan el cliente Supabase server-side (admin).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'public' } }
);

// ============================================================
// search_products
// ============================================================
export async function searchProducts(args: { query: string; category?: string }) {
  let query = supabaseAdmin
    .from('products')
    .select('id, sku, name, category, unit_price, min_stock, optimal_stock')
    .ilike('name', `%${args.query}%`)
    .eq('is_active', true);

  if (args.category) {
    query = query.eq('category', args.category);
  }

  const { data, error } = await query.limit(10);
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    count: data.length,
    products: data,
    message:
      data.length === 0
        ? `No se encontraron productos para "${args.query}".`
        : `Se encontraron ${data.length} producto(s).`,
  };
}

// ============================================================
// get_product_by_sku
// ============================================================
export async function getProductBySku(args: { sku: string }) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, sku, name, category, unit_price, min_stock, optimal_stock')
    .eq('sku', args.sku.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { success: false, error: `Producto con SKU ${args.sku} no encontrado.` };
  }

  return { success: true, product: data };
}

// ============================================================
// check_stock
// ============================================================
export async function checkStock(args: { product_id: string; branch_id?: string }) {
  let query = supabaseAdmin
    .from('inventory')
    .select(
      `
      current_stock,
      last_updated,
      branch:branches(id, name, city),
      product:products(id, sku, name, min_stock, optimal_stock)
      `
    )
    .eq('product_id', args.product_id);

  if (args.branch_id) {
    query = query.eq('branch_id', args.branch_id);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: 'No hay datos de inventario para este producto.' };
  }

  const stocks = data.map((row: any) => ({
    branch: row.branch,
    product: row.product,
    current_stock: row.current_stock,
    min_stock: row.product.min_stock,
    optimal_stock: row.product.optimal_stock,
    status: (() => {
      if (row.current_stock === 0) return 'AGOTADO';
      if (row.current_stock < row.product.min_stock * 0.5) return 'CRITICO';
      if (row.current_stock < row.product.min_stock) return 'BAJO';
      if (row.current_stock >= row.product.optimal_stock) return 'OPTIMO';
      return 'NORMAL';
    })(),
    last_updated: row.last_updated,
  }));

  return { success: true, stocks };
}

// ============================================================
// get_sales_velocity
// ============================================================
export async function getSalesVelocity(args: { product_id: string; branch_id?: string }) {
  const now = new Date();
  const periods = [
    { label: '7_dias', days: 7 },
    { label: '14_dias', days: 14 },
    { label: '30_dias', days: 30 },
  ];

  const result: Record<string, any> = {};

  for (const period of periods) {
    const from = new Date(now);
    from.setDate(from.getDate() - period.days);

    let query = supabaseAdmin
      .from('sales')
      .select('quantity')
      .eq('product_id', args.product_id)
      .gte('sale_date', from.toISOString().split('T')[0]);

    if (args.branch_id) {
      query = query.eq('branch_id', args.branch_id);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const total = data?.reduce((sum: number, s: any) => sum + s.quantity, 0) || 0;
    result[period.label] = {
      total_sold: total,
      daily_average: Math.round((total / period.days) * 100) / 100,
    };
  }

  return { success: true, velocity: result };
}

// ============================================================
// list_branches
// ============================================================
export async function listBranches() {
  const { data, error } = await supabaseAdmin
    .from('branches')
    .select('id, name, city')
    .eq('is_active', true)
    .order('name');

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    count: data.length,
    branches: data,
  };
}

// ============================================================
// create_alert
// ============================================================
export async function createAlert(args: {
  branch_id: string;
  product_id: string;
  alert_type: string;
  severity: string;
  message: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('alerts')
    .insert({
      branch_id: args.branch_id,
      product_id: args.product_id,
      alert_type: args.alert_type,
      severity: args.severity,
      message: args.message,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    alert: data,
    message: `Alerta ${args.severity} creada: ${args.message}`,
  };
}

// ============================================================
// get_pending_alerts
// ============================================================
export async function getPendingAlerts(args: { branch_id?: string; severity?: string }) {
  let query = supabaseAdmin
    .from('alerts')
    .select(
      `
      id, alert_type, severity, message, created_at,
      branch:branches(name, city),
      product:products(sku, name)
      `
    )
    .eq('is_resolved', false)
    .order('created_at', { ascending: false });

  if (args.branch_id) query = query.eq('branch_id', args.branch_id);
  if (args.severity) query = query.eq('severity', args.severity);

  const { data, error } = await query.limit(20);
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    count: data.length,
    alerts: data,
  };
}
