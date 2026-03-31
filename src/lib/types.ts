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

