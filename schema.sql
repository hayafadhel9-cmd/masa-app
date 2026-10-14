-- Run this in Supabase: Project > SQL Editor > New query > paste > Run

create extension if not exists "uuid-ossp";

-- Restaurants (your paying customers)
create table restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cuisine text,
  area text,
  price_tier text,               -- e.g. "$$$$"
  no_show_fee_aed integer default 0,   -- per guest
  subscription_status text default 'trial',  -- 'trial' | 'active' | 'cancelled'
  trial_ends_at timestamp with time zone,
  -- zones/zone_capacity are superseded by the restaurant_areas table below
  -- (added 2026-10-13) — left in place as inert legacy columns (same pattern
  -- as the dead restaurant_tables table) rather than dropped. Every
  -- restaurant's data was migrated into restaurant_areas; nothing in the app
  -- reads or writes these two columns anymore.
  zones text[] default array['Indoor'],  -- e.g. {Indoor,Outdoor,"Shisha Terrace"}
  cancellation_notice_hours integer default 2,
  owner_id uuid references auth.users(id),  -- links a restaurant to its dashboard login
  opening_time text default '18:00',
  closing_time text default '21:30',        -- may be earlier than opening_time (overnight hours)
  party_sizes integer[] default array[2, 4, 6, 8],
  min_advance_days integer default 0,
  max_advance_days integer default 30,
  max_party_size integer default 14,
  zone_capacity jsonb default '{}'::jsonb,  -- superseded, see note above
  created_at timestamp with time zone default now()
);

-- A restaurant's freeform, owner-managed list of seating areas (added
-- 2026-10-13, replacing the old fixed Indoor/Outdoor/Shisha Terrace set).
-- bookings.zone stores the area's NAME as a plain text snapshot, not a
-- foreign key — renaming or deleting an area later never changes what a
-- past booking shows.
create table restaurant_areas (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  -- null = not configured (unlimited, same as today's existing behavior);
  -- 0 = configured with zero seats (nothing bookable in this area);
  -- >0 = seat/table count enforced against concurrent pending+confirmed bookings.
  capacity integer,
  created_at timestamp with time zone default now(),
  unique (restaurant_id, name)
);

create index idx_restaurant_areas_restaurant on restaurant_areas(restaurant_id);

-- Tables on the floor for each restaurant
create table restaurant_tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  seats integer not null
);

-- Menu items shown to diners
create table menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  price_aed integer not null,
  sort_order integer default 0,
  photo_url text  -- public URL of the uploaded photo in the menu-photos storage bucket
);

-- Bookings made by diners
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  user_id uuid references auth.users(id),  -- the customer account that made this booking;
                                            -- NULL on bookings made before real customer
                                            -- accounts existed (2026-08-29) — deliberately
                                            -- left unmigrated, see PROJECT_STATUS.md
  guest_name text not null,
  guest_phone text not null,
  party_size integer not null,
  zone text,                      -- the assigned restaurant_areas.name at booking time, e.g.
                                   -- "Indoor" — a plain text snapshot, not a foreign key, so
                                   -- renaming/deleting that area later never changes this row
  occasion text,                  -- e.g. "Birthday" | "Anniversary" | "Business" | null
  booking_time text not null,     -- e.g. "7:30 PM" (swap to a real timestamp for production)
  booking_date date not null default current_date,
  status text default 'pending',  -- 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'no-show' | 'dined' | 'edited' (superseded by a customer-requested change) | 'settled' (dismissed no-show) | 'archived' (dismissed cancellation)
  card_last4 text,                -- from Stripe, never store full card numbers
  stripe_payment_method_id text,  -- Stripe token reference, added when you wire up Stripe
  charged boolean default false,
  created_at timestamp with time zone default now()
);

-- Post-dining ratings. One review per booking (enforced by the unique
-- constraint below, as well as by RLS — see the INSERT policy further down).
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references bookings(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamp with time zone default now(),
  unique (booking_id)
);

-- Basic indexes for the queries you'll run constantly
create index idx_bookings_restaurant on bookings(restaurant_id);
create index idx_bookings_status on bookings(status);
create index idx_bookings_user_id on bookings(user_id);
create index idx_reviews_restaurant on reviews(restaurant_id);

-- Row Level Security: turn on before going live so restaurants only see their own data
alter table restaurants enable row level security;
alter table bookings enable row level security;

-- allow anyone to read restaurant listings (public browsing)
create policy "Public can view restaurants"
  on restaurants for select
  using (true);

-- Bookings RLS (tightened 2026-08-29 alongside real customer accounts — see
-- PROJECT_STATUS.md's security section for the full reasoning and the
-- self-approval exploit that was found and closed while designing this):
--
-- SELECT stays open on purpose: "Share with friends" lets anyone with a
-- booking's exact link/UUID view it with no account — the security model for
-- that is "unguessable random ID," not RLS.
create policy "Anyone can view bookings"
  on bookings for select
  using (true);

-- Only a logged-in customer can create a booking, and only for themselves.
create policy "Customers can create their own bookings"
  on bookings for insert
  with check (auth.uid() = user_id);

-- The owning customer can update their own booking, but ONLY to cancel it or
-- mark it superseded by an edit — not to self-approve past the restaurant's
-- accept/decline step (this value-level check is the fix for a real exploit
-- found during testing: without it, a customer could PATCH their own pending
-- booking straight to status='confirmed'). A restaurant owner can update any
-- booking that belongs to their own restaurant, to any status (accept,
-- decline, mark dined/no-show, settle, archive).
create policy "Owning customer or restaurant can update a booking"
  on bookings for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from restaurants
      where restaurants.id = bookings.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  )
  with check (
    (auth.uid() = user_id and status in ('cancelled', 'edited'))
    or exists (
      select 1 from restaurants
      where restaurants.id = bookings.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  );

alter table reviews enable row level security;

-- Reviews are publicly readable so the average rating can show on the
-- restaurant page without requiring a login.
create policy "Public can view reviews"
  on reviews for select
  using (true);

-- A customer can only insert a review for their own booking, and only once
-- that booking has actually been marked "dined" by the restaurant — mirrors
-- the booking-status value-check pattern used for bookings UPDATE above (the
-- same kind of self-approval exploit it closes: without the status/ownership
-- check here, a customer could review a booking that isn't theirs, or one
-- that was never dined). No UPDATE or DELETE policy exists at all, so RLS
-- denies both outright — nobody can edit or delete any review, their own or
-- anyone else's.
create policy "Customers can review their own dined booking"
  on reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from bookings b
      where b.id = reviews.booking_id
        and b.user_id = auth.uid()
        and b.status = 'dined'
        and b.restaurant_id = reviews.restaurant_id
    )
  );

-- Restaurant owners manage their own menu items (public read policy for menu_items
-- already exists: "Public can view menu items")
create policy "Owners can insert their own menu items"
  on menu_items for insert
  with check (
    exists (
      select 1 from restaurants
      where restaurants.id = menu_items.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  );

create policy "Owners can update their own menu items"
  on menu_items for update
  using (
    exists (
      select 1 from restaurants
      where restaurants.id = menu_items.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from restaurants
      where restaurants.id = menu_items.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  );

create policy "Owners can delete their own menu items"
  on menu_items for delete
  using (
    exists (
      select 1 from restaurants
      where restaurants.id = menu_items.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  );

-- Storage bucket for menu dish photos, uploaded by restaurant owners from Settings.
-- Public read (so the diner-facing app can display photos); writes restricted to the
-- owner of the restaurant matching the object's folder ({restaurant_id}/filename).
-- file_size_limit/allowed_mime_types are the real, server-enforced upload validation
-- (added 2026-08-29) — the app's own client-side checks are just faster feedback for
-- legitimate users, not the actual security boundary.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos', 'menu-photos', true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Public can view menu photos"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

create policy "Owners can upload menu photos for their restaurant"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-photos'
    and exists (
      select 1 from restaurants
      where restaurants.id::text = (storage.foldername(storage.objects.name))[1]
      and restaurants.owner_id = auth.uid()
    )
  );

create policy "Owners can update menu photos for their restaurant"
  on storage.objects for update
  using (
    bucket_id = 'menu-photos'
    and exists (
      select 1 from restaurants
      where restaurants.id::text = (storage.foldername(storage.objects.name))[1]
      and restaurants.owner_id = auth.uid()
    )
  );

create policy "Owners can delete menu photos for their restaurant"
  on storage.objects for delete
  using (
    bucket_id = 'menu-photos'
    and exists (
      select 1 from restaurants
      where restaurants.id::text = (storage.foldername(storage.objects.name))[1]
      and restaurants.owner_id = auth.uid()
    )
  );

-- restaurant_areas RLS (added 2026-10-13 alongside the seating-areas rework).
alter table restaurant_areas enable row level security;

create policy "Public can view restaurant areas"
  on restaurant_areas for select
  using (true);

create policy "Owners can insert their own areas"
  on restaurant_areas for insert
  with check (
    exists (
      select 1 from restaurants
      where restaurants.id = restaurant_areas.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  );

create policy "Owners can update their own areas"
  on restaurant_areas for update
  using (
    exists (
      select 1 from restaurants
      where restaurants.id = restaurant_areas.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from restaurants
      where restaurants.id = restaurant_areas.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  );

create policy "Owners can delete their own areas"
  on restaurant_areas for delete
  using (
    exists (
      select 1 from restaurants
      where restaurants.id = restaurant_areas.restaurant_id
      and restaurants.owner_id = auth.uid()
    )
  );

-- Server-side seating-capacity enforcement (added 2026-10-13) — defense in
-- depth so a raw API/SQL insert is rejected too, not just blocked by the
-- app's own client-side pre-insert check. Scoped to INSERT only: every write
-- path that creates a new pending/confirmed booking (a fresh booking, or an
-- edit, which inserts a replacement row) goes through INSERT; no existing
-- code path flips an UPDATE from a non-counted status back into
-- pending/confirmed, so UPDATE doesn't need the same guard today.
create or replace function enforce_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  area_capacity integer;
  current_count integer;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  if new.zone is null then
    return new;
  end if;

  select capacity into area_capacity
  from restaurant_areas
  where restaurant_id = new.restaurant_id and name = new.zone;

  -- No matching area row, or capacity not configured (null) -> unlimited,
  -- same as today's existing behavior for an untracked zone.
  if area_capacity is null then
    return new;
  end if;

  select count(*) into current_count
  from bookings
  where restaurant_id = new.restaurant_id
    and booking_date = new.booking_date
    and booking_time = new.booking_time
    and zone = new.zone
    and status in ('pending', 'confirmed');

  if current_count >= area_capacity then
    raise exception 'This seating area is fully booked for the selected time.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_booking_capacity
before insert on bookings
for each row execute function enforce_booking_capacity();

-- Blocks removing a seating area that still has upcoming pending/confirmed
-- bookings, and blocks removing a restaurant's last remaining area —
-- defense in depth behind the dashboard's own pre-delete checks (which give
-- the friendlier, specific UI message before ever reaching this trigger).
create or replace function prevent_unsafe_area_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from bookings
    where restaurant_id = old.restaurant_id
      and zone = old.name
      and status in ('pending', 'confirmed')
      and booking_date >= current_date
  ) then
    raise exception 'This area has upcoming bookings and cannot be removed.'
      using errcode = '23514';
  end if;

  if (select count(*) from restaurant_areas where restaurant_id = old.restaurant_id) <= 1 then
    raise exception 'A restaurant must have at least one seating area.'
      using errcode = '23514';
  end if;

  return old;
end;
$$;

create trigger trg_prevent_unsafe_area_delete
before delete on restaurant_areas
for each row execute function prevent_unsafe_area_delete();
