-- ============================================================
-- P1 - Biggie Inventory Agent - Supabase Schema
-- ============================================================
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- Extension para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Sucursales de Biggie
-- ============================================================
CREATE TABLE IF NOT EXISTS public.branches (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- Productos del catalogo Biggie
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  supplier      TEXT,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock     INTEGER NOT NULL DEFAULT 10,
  optimal_stock INTEGER NOT NULL DEFAULT 50,
  is_active     BOOLEAN DEFAULT true NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- Inventario actual por sucursal (se actualiza via Realtime)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  branch_id     UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock INTEGER NOT NULL DEFAULT 0,
  last_updated  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(branch_id, product_id)
);

-- ============================================================
-- Historial de ventas (para prediccion de quiebres)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  branch_id     UUID NOT NULL REFERENCES public.branches(id),
  product_id    UUID NOT NULL REFERENCES public.products(id),
  quantity      INTEGER NOT NULL,
  sale_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- Alertas generadas por el agente
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  branch_id     UUID NOT NULL REFERENCES public.branches(id),
  product_id    UUID NOT NULL REFERENCES public.products(id),
  alert_type    TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'stockout', 'overstock', 'trend_warning')),
  severity      TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message       TEXT NOT NULL,
  is_resolved   BOOLEAN DEFAULT false NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at   TIMESTAMPTZ
);

-- ============================================================
-- Conversaciones con el agente (para auditoria)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id    TEXT NOT NULL,
  user_message  TEXT NOT NULL,
  tool_calls    JSONB,
  agent_response TEXT NOT NULL,
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  provider      TEXT NOT NULL DEFAULT 'openai',
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX idx_inventory_branch    ON public.inventory(branch_id, product_id);
CREATE INDEX idx_sales_product_date  ON public.sales(product_id, sale_date DESC);
CREATE INDEX idx_sales_branch_date   ON public.sales(branch_id, sale_date DESC);
CREATE INDEX idx_alerts_unresolved   ON public.alerts(is_resolved, severity);
CREATE INDEX idx_agent_logs_session  ON public.agent_logs(session_id, created_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.branches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Politicas de lectura: todos los usuarios autenticados pueden leer
CREATE POLICY "auth_read_branches"   ON public.branches   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_products"   ON public.products   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_inventory"  ON public.inventory  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_sales"      ON public.sales      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_alerts"     ON public.alerts     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_logs"       ON public.agent_logs FOR SELECT TO authenticated USING (true);

-- Escritura: solo service_role (el backend) puede insertar/actualizar
CREATE POLICY "service_insert_inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_update_inventory" ON public.inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_insert_alerts"    ON public.alerts    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_update_alerts"    ON public.alerts    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "service_insert_logs"      ON public.agent_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Datos de ejemplo (seed)
-- ============================================================
INSERT INTO public.branches (name, city) VALUES
  ('Biggie Centro', 'Asuncion'),
  ('Biggie Shopping del Sol', 'Asuncion'),
  ('Biggie Villa Morra', 'Asuncion'),
  ('Biggie Carmelitas', 'Asuncion'),
  ('Biggie Luque', 'Luque')
ON CONFLICT DO NOTHING;

INSERT INTO public.products (sku, name, category, unit_price, min_stock, optimal_stock) VALUES
  ('BIG001', 'Coca-Cola 2L', 'Bebidas', 12500, 20, 80),
  ('BIG002', 'Leche Entera 1L', 'Lacteos', 7500, 15, 60),
  ('BIG003', 'Pan de Sandwich', 'Panaderia', 5000, 10, 40),
  ('BIG004', 'Arroz 1kg', 'Almacen', 8500, 20, 100),
  ('BIG005', 'Aceite Girasol 900ml', 'Almacen', 12000, 15, 70),
  ('BIG006', 'Queso Paraguay 500g', 'Lacteos', 18000, 5, 25),
  ('BIG007', 'Carne Molida 1kg', 'Carnes', 45000, 5, 20),
  ('BIG008', 'Agua Mineral 500ml', 'Bebidas', 3500, 30, 120),
  ('BIG009', 'Huevos x12', 'Lacteos', 13000, 10, 50),
  ('BIG010', 'Cafe Instantaneo 100g', 'Almacen', 22000, 8, 35)
ON CONFLICT DO NOTHING;
