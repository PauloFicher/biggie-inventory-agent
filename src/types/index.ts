export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  min_stock: number;
  optimal_stock: number;
  is_active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  is_active: boolean;
}

export interface InventoryRow {
  id: string;
  branch_id: string;
  product_id: string;
  current_stock: number;
  last_updated: string;
  branch?: Branch;
  product?: Product;
}

export interface Alert {
  id: string;
  branch_id: string;
  product_id: string;
  alert_type: 'low_stock' | 'stockout' | 'overstock' | 'trend_warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  is_resolved: boolean;
  created_at: string;
  branch?: Branch;
  product?: Product;
}

export interface AgentMessage {
  role: 'user' | 'agent';
  content: string;
  toolCalls?: Array<{ name: string; result: any }>;
  tokensUsed?: number;
}

export interface SalesVelocity {
  '7_dias': { total_sold: number; daily_average: number };
  '14_dias': { total_sold: number; daily_average: number };
  '30_dias': { total_sold: number; daily_average: number };
}
