-- Order visibility: pending until admin approves (run in SQL Editor if order_ledger exists).

alter table public.order_ledger
  add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('pending', 'approved', 'rejected'));

update public.order_ledger set approval_status = 'approved' where approval_status is null;
