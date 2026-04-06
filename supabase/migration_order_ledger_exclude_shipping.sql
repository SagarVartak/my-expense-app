-- Friend / local delivery: exclude saved design shipping from order cost (run in SQL Editor if order_ledger already exists).

alter table public.order_ledger
  add column if not exists exclude_shipping_from_cost boolean not null default false;

-- If PostgREST still says "schema cache" / unknown column, reload the API schema (Supabase SQL Editor):
-- notify pgrst, 'reload schema';
