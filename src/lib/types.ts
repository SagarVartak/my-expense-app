export type Role = "admin" | "manager" | "member";

export type SessionUser = {
  username: string;
  role: Role;
  /** Sessions use Supabase Google OAuth only. */
  authMethod?: "google";
  /** Google profile picture URL */
  avatar_url?: string;
};

export type AppUser = {
  id: string;
  username: string;
  role: Role;
  active: boolean;
  created_at?: string;
  email?: string | null;
  email_verified_at?: string | null;
  auth_user_id?: string | null;
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

export type PrintedInventoryDesignRow = {
  cost_design_id: string;
  keychain_design: string;
  total_printed: number;
  last_print_at: string | null;
  last_printer_name: string | null;
};

export type PrintedInventoryEntry = {
  id: string;
  cost_design_id: string;
  quantity: number;
  printer_name: string;
  created_by: string;
  created_at: string;
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
  /** Colour cost for coloured keychains; added via migration_manager_colour_multikey.sql */
  colour_cost?: number;
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
  colour_cost: number;
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

export type DeadlineStatus = "not_started" | "print_started" | "print_done" | "in_transit" | "delivered" | "cancelled";

export type OrderLedgerSnapshotJson = {
  order_uid: string;
  order_date: string;
  /** @deprecated Use items instead for multi-design orders */
  cost_design_id: string | null;
  /** @deprecated Use items instead for multi-design orders */
  design_name: string;
  customer_name: string;
  customer_phone: string;
  shipment_tracking: string;
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
  exclude_shipping_from_cost: boolean;
  /** @deprecated Use items instead for multi-design orders */
  units: number;
  /** Deadline fields */
  deadline_date: string | null;
  deadline_status: DeadlineStatus;
  /** New: line items for multi-design orders */
  items?: OrderLedgerItemSnapshot[];
};

export type OrderLedgerItemSnapshot = {
  cost_design_id: string;
  design_name: string;
  quantity: number;
  unit_cost_price: number;
  unit_selling_price: number;
};

export type OrderLedgerEntry = {
  id: string;
  created_at: string;
  created_by: string;
  order_uid: string;
  order_date: string;
  /** @deprecated Use items instead for multi-design orders */
  cost_design_id: string | null;
  /** @deprecated Use items instead for multi-design orders */
  design_name: string;
  customer_name: string;
  customer_phone?: string;
  shipment_tracking?: string;
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
  /** @deprecated Use items instead for multi-design orders */
  units?: number;
  /** Deadline fields */
  deadline_date?: string | null;
  deadline_status?: DeadlineStatus;
  /** New: line items for multi-design orders */
  items?: OrderLedgerItem[];
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

export type OrderLedgerItem = {
  id: string;
  order_id: string;
  cost_design_id: string;
  quantity: number;
  unit_cost_price: number;
  unit_selling_price: number;
  created_at: string;
  /** Joined fields from cost_designs */
  keychain_design?: string;
  design_total_cost_price?: number;
};

export type DeletionResourceType = "expense" | "cost_design" | "order_ledger";

export type DeletionRequest = {
  id: string;
  resource_type: DeletionResourceType;
  resource_id: string;
  requested_by: string;
  status: CostDesignChangeRequestStatus;
  payload: Record<string, unknown>;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string;
};

