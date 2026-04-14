-- Customer phone + shipment tracking on orders. Run in Supabase SQL Editor.

alter table public.order_ledger
  add column if not exists customer_phone text not null default '',
  add column if not exists shipment_tracking text not null default '';

comment on column public.order_ledger.customer_phone is 'Customer contact phone (optional).';
comment on column public.order_ledger.shipment_tracking is 'Carrier / shipment tracking number (optional).';
