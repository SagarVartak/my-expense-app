-- Public entry id for admin lookup and exports (short, human-friendly)
alter table public.expenses add column if not exists entry_uid text unique;

update public.expenses
set entry_uid = 'EXP-' || upper(substring(replace(id::text, '-', '') from 1 for 8))
where entry_uid is null;
