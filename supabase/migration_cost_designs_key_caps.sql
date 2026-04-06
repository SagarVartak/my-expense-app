-- Key caps cost line item (adds to total_cost_price). Run after cost_designs exists.
alter table public.cost_designs
  add column if not exists key_caps_cost numeric(14, 2) not null default 0;

comment on column public.cost_designs.key_caps_cost is 'Key caps component included in total_cost_price.';
