-- DripCheck recovery migration (idempotent).
--
-- Run this once per environment in the Supabase SQL editor, or apply it with
-- the Supabase CLI. Re-running is safe: every statement either uses
-- IF NOT EXISTS or drops and recreates the object.
--
-- What it changes:
--   * adds the design-system fields (garment type, hex colour, fit, status)
--   * makes outfit rows unique per user/day so saving twice is idempotent
--   * adds lifetime wear counters for cost-per-wear
--   * adds profile fields used by the You screen
--   * moves the wardrobe bucket to private + owner-scoped storage policies
--   * keeps every table behind RLS

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- users (profile + auth mirror)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists size text;
alter table public.users add column if not exists silhouette text;
alter table public.users add column if not exists city text;
alter table public.users add column if not exists timezone text;
alter table public.users add column if not exists send_hour smallint;
alter table public.users add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_size_check') then
    alter table public.users
      add constraint users_size_check check (size is null or size in ('XS','S','M','L','XL','XXL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_silhouette_check') then
    alter table public.users
      add constraint users_silhouette_check check (silhouette is null or silhouette in ('tailored','relaxed','oversized'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  image_url text,
  name text not null,
  category text not null check (category in ('top','bottom','shoes','outerwear')),
  primary_color text not null,
  secondary_color text,
  formality text not null check (formality in ('casual','smart_casual','formal')),
  warmth text not null check (warmth in ('hot','mild','cold')),
  price numeric(10,2),
  created_at timestamptz not null default now()
);

alter table public.items alter column image_url drop not null;
alter table public.items add column if not exists image_path text;
alter table public.items add column if not exists garment_type text;
alter table public.items add column if not exists color_hex text;
alter table public.items add column if not exists fit text;
alter table public.items add column if not exists status text not null default 'clean';
alter table public.items add column if not exists times_worn integer not null default 0;
alter table public.items add column if not exists last_worn date;
alter table public.items add column if not exists updated_at timestamptz not null default now();

-- Clear values that would block the new checks on an older database.
update public.items set price = null where price is not null and price < 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_garment_type_check') then
    alter table public.items
      add constraint items_garment_type_check
      check (garment_type is null or garment_type in ('tee','hoodie','sweater','pants','wide','shoe','jacket'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_fit_check') then
    alter table public.items
      add constraint items_fit_check
      check (fit is null or fit in ('tight','slim','regular','relaxed','baggy'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_status_check') then
    alter table public.items
      add constraint items_status_check check (status in ('clean','dirty'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_color_hex_check') then
    alter table public.items
      add constraint items_color_hex_check
      check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_price_check') then
    alter table public.items
      add constraint items_price_check check (price is null or price >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- outfits
-- ---------------------------------------------------------------------------
create table if not exists public.outfits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  occasion text not null,
  weather_temp integer,
  item_ids uuid[] not null,
  explanation_text text,
  is_favorite boolean not null default false,
  was_worn boolean not null default false,
  generated_by text not null default 'rules',
  created_at timestamptz not null default now()
);

alter table public.outfits add column if not exists generated_by text not null default 'rules';
alter table public.outfits add column if not exists updated_at timestamptz not null default now();

-- Older rows may have zero or too many pieces; the 1–4 check cannot be added
-- while they exist, and they are not valid outfits under the current product.
delete from public.outfits where cardinality(item_ids) < 1 or cardinality(item_ids) > 4;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outfits_generated_by_check') then
    alter table public.outfits
      add constraint outfits_generated_by_check check (generated_by in ('ai','rules'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'outfits_item_ids_check') then
    alter table public.outfits
      add constraint outfits_item_ids_check check (cardinality(item_ids) between 1 and 4);
  end if;
end $$;

-- Keep the newest row for each user/day, then enforce one outfit per day.
delete from public.outfits a
using public.outfits b
where a.user_id = b.user_id
  and a.date = b.date
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists outfits_user_date_key on public.outfits (user_id, date);

-- Enforce outfit integrity in the database too. Server routes already check
-- ownership and slots; this closes the direct-PostgREST path.
create or replace function public.validate_outfit_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_ids integer;
  owned_ids integer;
  tops integer;
  bottoms integer;
  shoes integer;
  outers integer;
begin
  select count(*) into total_ids from unnest(new.item_ids) as id;

  select count(*) into owned_ids
  from public.items
  where id = any(new.item_ids) and user_id = new.user_id;

  if owned_ids <> total_ids then
    raise exception 'outfit contains an item outside this user wardrobe';
  end if;

  select
    count(*) filter (where category = 'top'),
    count(*) filter (where category = 'bottom'),
    count(*) filter (where category = 'shoes'),
    count(*) filter (where category = 'outerwear')
  into tops, bottoms, shoes, outers
  from public.items
  where id = any(new.item_ids) and user_id = new.user_id;

  if tops <> 1 or bottoms <> 1 or shoes <> 1 or outers > 1 then
    raise exception 'outfit must have one top, one bottom, one shoes and at most one outer layer';
  end if;

  return new;
end;
$$;

drop trigger if exists outfits_validate_items on public.outfits;
create trigger outfits_validate_items
  before insert or update of item_ids, user_id on public.outfits
  for each row execute function public.validate_outfit_items();

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_items_user_id on public.items (user_id);
create index if not exists idx_items_category on public.items (category);
create index if not exists idx_outfits_user_date on public.outfits (user_id, date desc);

-- Rebuild lifetime wear counters from the actual worn history. This makes
-- cost-per-wear correct for existing rows instead of falling back to a
-- partial derived count.
update public.items i
set times_worn = sub.cnt,
    last_worn = sub.last_date
from (
  select i2.id,
         count(o.id)::int as cnt,
         max(o.date) as last_date
  from public.items i2
  left join public.outfits o
    on i2.id = any(o.item_ids) and o.was_worn
  group by i2.id
) sub
where i.id = sub.id;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists outfits_set_updated_at on public.outfits;
create trigger outfits_set_updated_at
  before update on public.outfits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auth mirror trigger (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.users (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.outfits enable row level security;

drop policy if exists "Users can view own data" on public.users;
create policy "Users can view own data" on public.users
  for select using (auth.uid() = id);

drop policy if exists "Users can insert own row" on public.users;
create policy "Users can insert own row" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Items: users can view own" on public.items;
create policy "Items: users can view own" on public.items
  for select using (auth.uid() = user_id);

drop policy if exists "Items: users can insert own" on public.items;
create policy "Items: users can insert own" on public.items
  for insert with check (auth.uid() = user_id);

drop policy if exists "Items: users can update own" on public.items;
create policy "Items: users can update own" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Items: users can delete own" on public.items;
create policy "Items: users can delete own" on public.items
  for delete using (auth.uid() = user_id);

drop policy if exists "Outfits: users can view own" on public.outfits;
create policy "Outfits: users can view own" on public.outfits
  for select using (auth.uid() = user_id);

drop policy if exists "Outfits: users can insert own" on public.outfits;
create policy "Outfits: users can insert own" on public.outfits
  for insert with check (auth.uid() = user_id);

drop policy if exists "Outfits: users can update own" on public.outfits;
create policy "Outfits: users can update own" on public.outfits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Outfits: users can delete own" on public.outfits;
create policy "Outfits: users can delete own" on public.outfits
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- private wardrobe storage
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'wardrobe-items',
      'wardrobe-items',
      false,
      4194304,
      array['image/jpeg','image/png','image/webp','image/heic','image/heif']
    )
    on conflict (id) do update
      set    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

-- Backfill object paths from legacy public URLs before the bucket goes private.
update public.items
set image_path = split_part(split_part(image_url, '/object/public/wardrobe-items/', 2), '?', 1)
where image_path is null
  and image_url like '%/object/public/wardrobe-items/%';

do $$
begin
  if to_regclass('storage.objects') is not null then
    -- New uploads live under <uid>/<file>. Legacy objects sat at the bucket
    -- root, so reading/deleting them is allowed when the object path matches
    -- an item owned by the caller. Either way the object stays owner-scoped.
    drop policy if exists "Wardrobe: owner can read" on storage.objects;
    create policy "Wardrobe: owner can read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'wardrobe-items'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or exists (
            select 1 from public.items i
            where i.user_id = auth.uid() and i.image_path = name
          )
        )
      );

    drop policy if exists "Wardrobe: owner can insert" on storage.objects;
    create policy "Wardrobe: owner can insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'wardrobe-items' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "Wardrobe: owner can update" on storage.objects;
    create policy "Wardrobe: owner can update" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'wardrobe-items'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or exists (
            select 1 from public.items i
            where i.user_id = auth.uid() and i.image_path = name
          )
        )
      )
      with check (
        bucket_id = 'wardrobe-items'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or exists (
            select 1 from public.items i
            where i.user_id = auth.uid() and i.image_path = name
          )
        )
      );

    drop policy if exists "Wardrobe: owner can delete" on storage.objects;
    create policy "Wardrobe: owner can delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'wardrobe-items'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or exists (
            select 1 from public.items i
            where i.user_id = auth.uid() and i.image_path = name
          )
        )
      );
  end if;
end $$;
