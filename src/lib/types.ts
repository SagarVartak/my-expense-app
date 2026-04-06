export type Role = "admin" | "member";

export type SessionUser = {
  username: string;
  role: Role;
};

export type AppUser = {
  id: string;
  username: string;
  role: Role;
  active: boolean;
  created_at?: string;
  email?: string | null;
  email_verified_at?: string | null;
};

export type PendingInvite = {
  id: string;
  email: string;
  expires_at: string;
  created_at: string;
  created_by: string;
};

export type Expense = {
  id: string;
  entry_uid?: string;
  expense_date: string;
  category: string;
  amount: number;
  paid_by: string;
  payment_method: string;
  description: string;
  created_at?: string;
};

export type AuditLog = {
  id: string;
  performed_by: string;
  action: string;
  details: string;
  created_at?: string;
};

export type CostDesign = {
  id: string;
  created_at: string;
  created_by: string;
  keychain_design: string;
  print_weight_g: number;
  filament_cost_per_g: number;
  electricity_fee: number;
  chain_cost: number;
  pouch_cost: number;
  card_cost: number;
  primer_cost: number;
  clearcoat_cost: number;
  /** Present after migration_cost_designs_key_caps.sql; treat missing as 0. */
  key_caps_cost?: number;
  shipping: number;
  total_cost_price: number;
};

export type CostDesignChangeRequestStatus = "pending" | "approved" | "rejected";

export type CostDesignSnapshotJson = {
  keychain_design: string;
  print_weight_g: number;
  filament_cost_per_g: number;
  electricity_fee: number;
  chain_cost: number;
  pouch_cost: number;
  card_cost: number;
  primer_cost: number;
  clearcoat_cost: number;
  key_caps_cost: number;
  shipping: number;
  total_cost_price: number;
};

export type CostDesignChangeRequest = {
  id: string;
  cost_design_id: string;
  status: CostDesignChangeRequestStatus;
  requested_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string;
  previous_snapshot: CostDesignSnapshotJson;
  proposed_snapshot: CostDesignSnapshotJson;
};

export type OrderApprovalStatus = "pending" | "approved" | "rejected";

export type OrderLedgerSnapshotJson = {
  order_uid: string;
  order_date: string;
  cost_design_id: string | null;
  design_name: string;
  customer_name: string;
  shipping_address: string;
  actual_weight_g: number;
  total_cost_price: number;
  selling_price: number;
  net_profit: number;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  source: string;
  feedback: string;
  customer_behaviour: string;
  exclude_shipping_from_cost: boolean;
};

export type OrderLedgerEntry = {
  id: string;
  created_at: string;
  created_by: string;
  order_uid: string;
  order_date: string;
  cost_design_id: string | null;
  design_name: string;
  customer_name: string;
  shipping_address: string;
  actual_weight_g: number;
  total_cost_price: number;
  selling_price: number;
  net_profit: number;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  source: string;
  feedback: string;
  customer_behaviour: string;
  /** When true, design shipping was not counted in total_cost_price / net_profit for this order. */
  exclude_shipping_from_cost?: boolean;
  approval_status?: OrderApprovalStatus;
};

export type OrderLedgerChangeRequest = {
  id: string;
  order_id: string;
  status: CostDesignChangeRequestStatus;
  requested_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string;
  previous_snapshot: OrderLedgerSnapshotJson;
  proposed_snapshot: OrderLedgerSnapshotJson;
};

