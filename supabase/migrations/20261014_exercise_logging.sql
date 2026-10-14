-- Run in Supabase SQL editor before using the exercise feature.
create extension if not exists pgcrypto;
create table if not exists public.exercise_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 activity_type text not null check (activity_type in ('strength','run')),
 title text not null,
 performed_at timestamptz not null default now(),
 duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
 distance_m numeric check (distance_m is null or distance_m >= 0),
 effort integer check (effort is null or effort between 1 and 10),
 notes text,
 created_at timestamptz not null default now()
);
create table if not exists public.exercise_sets (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.exercise_sessions(id) on delete cascade,
 exercise_name text not null,
 exercise_order integer not null default 0,
 set_number integer not null check (set_number > 0),
 weight_kg numeric check (weight_kg is null or weight_kg >= 0),
 reps integer check (reps is null or reps >= 0),
 rir integer check (rir is null or rir between 0 and 10),
 created_at timestamptz not null default now()
);
create index if not exists exercise_sessions_user_date_idx on public.exercise_sessions(user_id,performed_at desc);
create index if not exists exercise_sets_session_idx on public.exercise_sets(session_id,exercise_order,set_number);
alter table public.exercise_sessions enable row level security;
alter table public.exercise_sets enable row level security;
create policy "Own exercise sessions" on public.exercise_sessions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own exercise sets" on public.exercise_sets for all to authenticated using (exists (select 1 from public.exercise_sessions s where s.id=session_id and s.user_id=(select auth.uid()))) with check (exists (select 1 from public.exercise_sessions s where s.id=session_id and s.user_id=(select auth.uid())));
