-- ============================================================
-- ROLLTIME · Supabase schema v1.1 (SYNC dengan kode server)
-- Paste SELURUH file ini di SQL Editor → Run.
-- Idempotent: aman dijalankan ulang kapan pun.
-- ============================================================

-- Users (mirror dari auth.users; diisi server saat signup)
create table if not exists rt_users (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Events: satu "roll film" per acara
create table if not exists rt_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users on delete cascade,
  name text not null,
  type text not null default 'party',
  filter_id int not null default 1,                          -- efek default untuk tamu
  filter_ids jsonb not null default '[]'::jsonb,             -- multi-efek pilihan host
  shots_per_guest int not null default 10,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reveal_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Guests: tanpa akun — identitas = nama + token acak di device
create table if not exists rt_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references rt_events on delete cascade,
  name text not null,
  token text not null unique,
  shots_used int not null default 0,
  created_at timestamptz not null default now()
);

-- Photos: metadata saja; binary di storage (Telegram / Supabase Storage / disk)
-- storage_key format tergantung adapter: telegram=file_id, supabase=object key, local=nama file
create table if not exists rt_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references rt_events on delete cascade,
  guest_id uuid references rt_guests on delete set null,
  guest_name text,
  storage_key text not null,
  filter_id int not null default 1,
  size bigint default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_guests_event on rt_guests(event_id);
create index if not exists idx_photos_event on rt_photos(event_id);
create index if not exists idx_events_code on rt_events(code);
create index if not exists idx_events_owner on rt_events(owner_id);

-- ------------------------------------------------------------
-- UPGRADE dari DB versi lama? Baris-baris ini aman diulang:
alter table if exists rt_events add column if not exists filter_ids jsonb not null default '[]'::jsonb;
alter table if exists rt_photos add column if not exists size bigint not null default 0;

-- ------------------------------------------------------------
-- RLS: server memakai SERVICE ROLE key (bypass RLS), jadi otorisasi
-- dikerjakan di layer API. Biarkan RLS off; kalau suatu saat mau
-- expose PostgREST ke client langsung, baru nyalakan + tulis policy.

-- ------------------------------------------------------------
-- Verifikasi cepat (hasilnya harus 4 baris rt_*):
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'rt_%' order by 1;
