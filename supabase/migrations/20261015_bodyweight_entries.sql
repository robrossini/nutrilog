-- Phase 3: dated bodyweight check-ins for progress tracking.
-- Additive only. Existing profiles, meals and workout sessions are unchanged.
create table if not exists public.bodyweight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  weight_kg numeric(5,2) not null check (weight_kg >= 30 and weight_kg <= 300),
  created_at timestamptz not null default now(),
  unique(user_id, recorded_on)
);
create index if not exists bodyweight_entries_user_date_idx
  on public.bodyweight_entries(user_id, recorded_on desc);
alter table public.bodyweight_entries enable row level security;
drop policy if exists "Owners manage bodyweight entries" on public.bodyweight_entries;
create policy "Owners manage bodyweight entries" on public.bodyweight_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.bodyweight_entries to authenticated;
