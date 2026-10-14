-- Phase 2: flexible training plans. Run AFTER 20261014_exercise_logging.sql.
-- Additive only: the earlier exercise sessions and their data are preserved.
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal text not null default '',
  start_date date not null,
  duration_weeks integer not null check (duration_weeks between 1 and 52),
  status text not null default 'active' check (status in ('active','paused','archived')),
  schedule jsonb not null default '[]'::jsonb check (jsonb_typeof(schedule) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A user can retain archived programmes but only one active/paused programme.
create unique index if not exists one_open_training_plan_per_user
  on public.training_plans(user_id) where status in ('active','paused');
create index if not exists training_plans_user_idx on public.training_plans(user_id,created_at desc);
alter table public.training_plans enable row level security;
drop policy if exists "Owners manage training plans" on public.training_plans;
create policy "Owners manage training plans" on public.training_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.training_plans to authenticated;

alter table public.exercise_sessions
  add column if not exists training_plan_id uuid references public.training_plans(id) on delete set null,
  add column if not exists planned_day_id text,
  add column if not exists planned_week integer check (planned_week is null or planned_week between 1 and 52);
create index if not exists exercise_sessions_plan_week_idx
  on public.exercise_sessions(training_plan_id,planned_week,planned_day_id);
