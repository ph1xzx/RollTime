-- ============================================================
-- ROLLTIME · Supabase schema
-- Jalankan di: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists rt_users (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists rt_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users on delete cascade,
  name text not null,
  type text not null default 'party',
  filter_id int not null default 1,
  filter_ids jsonb not null default '[]'::jsonb,   -- multi-efek pilihan host (filter_id = default)
  shots_per_guest int not null default 10,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reveal_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists rt_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references rt_events on delete cascade,
  name text not null,
  token text not null unique,
  shots_used int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists rt_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references rt_events on delete cascade,
  guest_id uuid references rt_guests on delete set null,
  guest_name text,
  storage_key text not null,        -- telegram file_id (atau nama file)
  filter_id int not null default 1,
  size bigint default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_guests_event on rt_guests(event_id);
create index if not exists idx_photos_event on rt_photos(event_id);

-- UPGRADE dari versi lama (tabel udah dibuat tanpa kolom multi-efek)?
-- Jalanin baris ini aja — aman diulang:
alter table if exists rt_events add column if not exists filter_ids jsonb not null default '[]'::jsonb;

-- Catatan: server memakai SERVICE ROLE key (bypass RLS),
-- jadi semua otorisasi dikerjakan di layer API server.
-- Kalau mau hardening, aktifkan RLS + policy sesuai kebutuhan.
