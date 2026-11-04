-- Nutrilog Mind: weekly self-report and opt-in email reminders.
-- Additive migration. No existing tables are modified.
create table if not exists public.mind_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  mood smallint not null check (mood between 1 and 5),
  enjoyment smallint not null check (enjoyment between 1 and 5),
  concentration smallint not null check (concentration between 1 and 5),
  social_anxiety smallint not null check (social_anxiety between 1 and 5),
  phone_usage smallint not null check (phone_usage between 1 and 5),
  unwanted_habits smallint not null check (unwanted_habits between 1 and 5),
  alcohol_units numeric(5,1) not null check (alcohol_units between 0 and 200),
  enjoyable_activities boolean not null default false,
  meaningful_social_contact boolean not null default false,
  creative_activity boolean not null default false,
  reading boolean not null default false,
  social_anxiety_practice boolean not null default false,
  reflection text not null default '' check (char_length(reflection) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create index if not exists mind_checkins_user_week_idx on public.mind_checkins(user_id, week_start desc);
alter table public.mind_checkins enable row level security;
drop policy if exists "Owners manage mind checkins" on public.mind_checkins;
create policy "Owners manage mind checkins" on public.mind_checkins
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.mind_checkins to authenticated;

create table if not exists public.mind_reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.mind_reminder_preferences enable row level security;
drop policy if exists "Owners manage mind reminder preferences" on public.mind_reminder_preferences;
create policy "Owners manage mind reminder preferences" on public.mind_reminder_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.mind_reminder_preferences to authenticated;

-- Internal idempotency ledger. Accessible only to server-side service role; not to users.
create table if not exists public.mind_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  reminder_date date not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start, reminder_date)
);
alter table public.mind_reminder_deliveries enable row level security;
revoke all on public.mind_reminder_deliveries from anon, authenticated;
