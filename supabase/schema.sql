-- ============================================================
-- Cue Sheet Tracker — Supabase schema
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste all of this → Run)
-- ============================================================

-- 1. Profiles table — one row per editor, created automatically on first login.
--    is_admin controls who can edit/delete other people's entries.
--    full_name is captured once, on first sign-in, via a one-time prompt in the app.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists full_name text;

alter table profiles enable row level security;

create policy "Anyone signed in can view profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row the first time someone logs in.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Small helper: is the current logged-in user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer;

-- 2. The cue sheet entries table itself.
create table if not exists cue_entries (
  id uuid primary key default gen_random_uuid(),
  date date,
  production text not null,
  editor_email text not null,
  editor_name text not null default '',
  exhibition text,
  link text,
  duration text,
  track text not null,
  usage text,
  pro text,
  shares text,
  composers text,
  publishers text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cue_entries enable row level security;

-- Everyone signed in can see every entry — that's the point of a shared tracker.
create policy "Signed-in users can view all entries"
  on cue_entries for select
  to authenticated
  using (true);

-- Any signed-in editor can add entries, tagged to their own account.
create policy "Signed-in users can insert their own entries"
  on cue_entries for insert
  to authenticated
  with check (created_by = auth.uid());

-- Editors can only edit their own rows; admins can edit anyone's.
create policy "Owners or admins can update entries"
  on cue_entries for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

-- Same rule for deletes.
create policy "Owners or admins can delete entries"
  on cue_entries for delete
  to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Keep updated_at current on every edit.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_cue_entries_updated_at on cue_entries;
create trigger set_cue_entries_updated_at
  before update on cue_entries
  for each row execute procedure public.set_updated_at();

-- 3. Safe to re-run even if you already created these tables before this
--    file added full_name / editor_name — these no-op if the columns exist.
alter table profiles add column if not exists full_name text;
alter table cue_entries add column if not exists editor_name text not null default '';

-- 4. Once you have your own account, make yourself admin by running:
--    update profiles set is_admin = true where email = 'you@yourcompany.com';
