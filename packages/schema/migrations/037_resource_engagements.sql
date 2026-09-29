-- 037_resource_engagements.sql
-- One row per stint a resource has on the platform. Additive only.
-- Applied to live via Supabase MCP on 29 Sep 2026.

create table public.resource_engagements (
  engagement_id      uuid primary key default gen_random_uuid(),
  resource_id        uuid not null references public.resources(resource_id),
  supplier_id        uuid not null references public.suppliers(supplier_id),
  roll_on_date       date,
  roll_off_date      date,
  roll_on_estimated  boolean not null default false, -- true = taken from earliest schedule, not verified
  roll_on_tentative  boolean not null default false, -- true = signed, date TBC
  roll_off_reason    text check (roll_off_reason in ('roll_off','resignation','maternity_leave')),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint resource_engagements_dates_chk check (roll_off_date is null or roll_on_date is null or roll_off_date >= roll_on_date)
);
create index resource_engagements_resource_supplier_idx on public.resource_engagements (resource_id, supplier_id) where deleted_at is null;
alter table public.resource_engagements enable row level security;
create policy resource_engagements_superuser_access on public.resource_engagements
  for all using (plato_is_superuser()) with check (plato_is_superuser());
create trigger resource_engagements_set_updated_at before update on public.resource_engagements
  for each row execute function plato_set_updated_at();

alter table public.resource_period_allocations
  add column engagement_id uuid references public.resource_engagements(engagement_id);
create index resource_period_allocations_engagement_idx on public.resource_period_allocations (engagement_id);

create or replace function public.plato_resolve_engagement(p_resource uuid, p_supplier uuid, p_period uuid)
returns uuid language sql stable set search_path = public as $$
  select e.engagement_id
  from resource_engagements e
  cross join (select period_start_date ps, period_end_date pe from periods where period_id = p_period) p
  where e.resource_id = p_resource and e.supplier_id = p_supplier and e.deleted_at is null
  order by (coalesce(e.roll_on_date, '-infinity'::date) <= p.pe
            and coalesce(e.roll_off_date, 'infinity'::date) >= p.ps) desc,
           e.roll_on_date desc nulls last
  limit 1
$$;

-- BACKFILL 1: one engagement per resource x supplier found in any schedule
insert into public.resource_engagements (resource_id, supplier_id, roll_on_date, roll_on_estimated)
select a.resource_id, a.supplier_id, min(p.period_start_date), true
from public.resource_period_allocations a
join public.periods p on p.period_id = a.period_id and p.deleted_at is null
join public.resources r on r.resource_id = a.resource_id and r.deleted_at is null
where a.deleted_at is null and a.resource_id is not null and a.supplier_id is not null
group by a.resource_id, a.supplier_id;

-- BACKFILL 2: "to" side of transitions — real roll-on
insert into public.resource_engagements (resource_id, supplier_id, roll_on_date, roll_on_estimated)
select t.resource_id, t.to_supplier_id, coalesce(t.commercial_start, t.joining_date), false
from public.resource_supplier_transitions t
where t.deleted_at is null and t.to_supplier_id is not null
  and not exists (select 1 from public.resource_engagements e
                  where e.resource_id = t.resource_id and e.supplier_id = t.to_supplier_id);

update public.resource_engagements e
set roll_on_date      = coalesce(t.commercial_start, t.joining_date),
    roll_on_estimated = false,
    roll_on_tentative = (t.status = 'signed_doj_tbc'),
    notes             = case when t.from_supplier_id is not null and t.joining_date is not null
                             then 'DOJ ' || to_char(t.joining_date, 'DD Mon YYYY') end
from public.resource_supplier_transitions t
where t.deleted_at is null and t.to_supplier_id is not null
  and e.resource_id = t.resource_id and e.supplier_id = t.to_supplier_id;

-- BACKFILL 3: "from" side of transitions — LWD becomes roll-off
update public.resource_engagements e
set roll_off_date = t.last_working_day
from public.resource_supplier_transitions t
where t.deleted_at is null and t.from_supplier_id is not null and t.last_working_day is not null
  and e.resource_id = t.resource_id and e.supplier_id = t.from_supplier_id;

-- BACKFILL 4: verified 29 Sep — Dat Ly and Rajat Jain roll off 30 Sep
update public.resource_engagements e
set roll_off_date = '2026-09-30'
from public.resources r, public.suppliers s
where r.resource_id = e.resource_id and s.supplier_id = e.supplier_id
  and s.supplier_abbreviation = 'CG' and r.resource_name in ('Dat Ly','Rajat Jain');

-- BACKFILL 5: exit reasons from Capgemini's LWD list
update public.resource_engagements e
set roll_off_reason = v.reason
from (values
  ('Amol Tate','resignation'),('Rajat Pandey','resignation'),('Dipti Borole','resignation'),
  ('Praneeth Gudelli','resignation'),('Makarand Parab','resignation'),('Priyanka Dhole','resignation'),
  ('Poornachandran Ramakrishnan','resignation'),('Vipul Suriya','resignation'),('Pradeep Bolke','resignation'),
  ('Sajesh Advilkar','roll_off'),('Nikhil Vibhav','roll_off'),('Nilesh Kumar','roll_off'),
  ('Bharat Patil','roll_off'),('Deepak Balasaheb Pawar','roll_off'),('Anupama Rs','roll_off'),
  ('Arti Lamje','roll_off'),('Praneetha Bandlamudi','roll_off'),('Savita Khatavkar','roll_off'),
  ('Yashvanth C','roll_off'),('Dat Ly','roll_off'),('Rajat Jain','roll_off'),
  ('Anupama Yadav','maternity_leave')
) v(name, reason)
join public.resources r on r.resource_name = v.name and r.deleted_at is null
join public.suppliers s on s.supplier_abbreviation = 'CG'
where e.resource_id = r.resource_id and e.supplier_id = s.supplier_id;

-- BACKFILL 6: link every allocation to its engagement (updated_at untouched)
alter table public.resource_period_allocations disable trigger resource_period_allocations_set_updated_at;
update public.resource_period_allocations a
set engagement_id = public.plato_resolve_engagement(a.resource_id, a.supplier_id, a.period_id)
where a.resource_id is not null and a.supplier_id is not null;
alter table public.resource_period_allocations enable trigger resource_period_allocations_set_updated_at;

-- BACKFILL 7: clear junk placeholder roll-offs on resources
update public.resources set resource_rolloff_date = null where resource_rolloff_date = '2027-01-31';

-- TRIGGER: every schedule write path (wizard, inline edit, assign/connect RPCs, period clone)
-- gets engagement_id automatically. No app code sets engagement_id.
create or replace function public.plato_allocation_set_engagement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.resource_id is null or new.supplier_id is null then
    new.engagement_id := null;
    return new;
  end if;
  new.engagement_id := plato_resolve_engagement(new.resource_id, new.supplier_id, new.period_id);
  if new.engagement_id is null then
    insert into resource_engagements (resource_id, supplier_id, roll_on_date, roll_on_estimated)
    select new.resource_id, new.supplier_id, period_start_date, true from periods where period_id = new.period_id
    returning engagement_id into new.engagement_id;
  end if;
  return new;
end $$;

create trigger resource_period_allocations_set_engagement
  before insert or update of resource_id, supplier_id, period_id on public.resource_period_allocations
  for each row execute function public.plato_allocation_set_engagement();
