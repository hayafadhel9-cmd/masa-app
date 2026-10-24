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
  -- Street-level address (added 2026-10-23, alongside the busyness-forecast
  -- feature) — distinct from the existing `area` column above, which is a
  -- neighborhood name (e.g. "DIFC"), not a lookup-able street address.
  -- Optional: a restaurant works fine with this unset, it just means no
  -- BestTime forecast can be looked up for it (see restaurant_forecasts below).
  address text,
  cancellation_notice_hours integer default 2,
  owner_id uuid references auth.users(id),  -- links a restaurant to its dashboard login
  opening_time text default '18:00',
  closing_time text default '21:30',        -- may be earlier than opening_time (overnight hours)
  party_sizes integer[] default array[2, 4, 6, 8],
  min_advance_days integer default 0,
  max_advance_days integer default 30,
  max_party_size integer default 14,
  zone_capacity jsonb default '{}'::jsonb,  -- superseded, see note above
  -- Dashboard-wide "Taking requests / Paused" switch (2026-10-24 dashboard
  -- rebuild) — when false, the Requests tab shows a paused notice. Diner-app
  -- booking creation is NOT gated by this yet (out of scope for that pass).
  accepting_requests boolean not null default true,
  -- Minimum spend per guest (2026-10-24 Settings tab build-out), applying
  -- only on the nights listed in min_spend_nights. Nights are JS
  -- Date#getDay() indices (0=Sunday..6=Saturday), not day-name strings —
  -- matches the app's existing locale-agnostic-storage convention, so
  -- display labels are generated per-locale rather than stored.
  min_spend_aed integer not null default 0,
  min_spend_nights integer[] not null default '{}',
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
  photo_url text,  -- public URL of the uploaded photo in the menu-photos storage bucket
  staff_only boolean not null default false  -- hidden from the diner-facing menu
                                              -- (Restaurant Detail's "View menu" sheet),
                                              -- but still selectable by staff when
                                              -- building a guest's receipt
                                              -- (ReceiptPanel) — same public-read RLS
                                              -- as every other column here, no
                                              -- separate policy needed
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
  -- Tonight-tab check-in state (2026-10-24 dashboard rebuild) — separate from
  -- `status` so a booking can stay 'confirmed' while tracking whether the
  -- party has actually arrived tonight.
  arrived boolean not null default false,
  arrived_at timestamp with time zone,
  -- Guest-facing message shown when a request is declined (e.g. "We're full
  -- at 8:00 PM. Please try another time.") — captured for future use even
  -- though the diner app doesn't surface it yet; cleared on undo.
  decline_reason text,
  -- Receipts (2026-10-24 Receipts/Analytics build-out). Payment state rides
  -- on `bookings` directly rather than a separate 1:1 `receipts` table — a
  -- receipt is inherently one-per-booking, same reasoning as arrived/
  -- arrived_at above, and it's already covered by the existing owner-scoped
  -- UPDATE policy below, so no new RLS is needed for these two columns.
  -- Line items live in their own `order_items` table (see below), which
  -- does get its own RLS — unlike payment status, "what was ordered" has no
  -- natural home on the bookings row itself.
  receipt_status text,                    -- null (no tab) | 'open' | 'paid' | 'not_paid'
  receipt_paid_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Line items staff add to an open tab (receipt_status = 'open'). Unlike
-- payment status above, this genuinely is a new table — it has its own RLS
-- further down, restaurant-staff-only; no diner-facing read path exists.
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references bookings(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  -- Snapshot name/price at the time the item was added — mirrors the
  -- existing `bookings.card_last4` pattern of storing a point-in-time copy
  -- rather than only a join, so a later menu price change never rewrites a
  -- past receipt.
  name text not null,
  price_aed integer not null,
  quantity integer not null default 1,
  notes text,  -- e.g. "no onions" — staff-entered, shown to the diner on
               -- their Tab screen in small grey text under the item
  created_at timestamp with time zone default now()
);
create index idx_order_items_booking on order_items(booking_id);

-- Guests added to a booking by the diner who made it (Tab feature, "Add
-- guests" on My Bookings) — gives them read-only access to the booking and
-- its tab without ever letting them change anything. One row per invite
-- link generated ("Share invite link"); user_id stays null until someone
-- opens the link and signs in/up, at which point they claim it. guest_name
-- is a point-in-time snapshot of the joining user's own account name (same
-- snapshot pattern as order_items.name / bookings.card_last4) so showing
-- "Shared with Sara" never needs to read auth.users, which isn't readable
-- via the public API anyway.
create table booking_guests (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references bookings(id) on delete cascade,
  invite_token uuid not null default uuid_generate_v4() unique,
  user_id uuid references auth.users(id),
  guest_name text,
  created_at timestamp with time zone default now()
);
create index idx_booking_guests_booking on booking_guests(booking_id);
create index idx_booking_guests_user on booking_guests(user_id);

-- Accessibility/allergy info for one specific booking ("Anything we should
-- know?" on the Booking screen). Deliberately its own table rather than
-- columns on `bookings`: `bookings` stays publicly SELECTable on purpose (the
-- "share with friends" link works via an unguessable UUID, no account
-- needed — see the RLS comment on `bookings` below), but allergy info is
-- health data that only the diner and the restaurant they booked with should
-- ever see. One row per booking, created only when the diner actually
-- selects a need (no row at all means "nothing to show").
create table booking_needs (
  booking_id uuid primary key references bookings(id) on delete cascade,
  wheelchair boolean not null default false,
  high_chair boolean not null default false,
  allergy boolean not null default false,
  allergy_detail text,     -- e.g. "tree nuts" — only meaningful when allergy = true
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

-- These two were live on the project already (created alongside the original
-- owner_id/onboarding work) but had fallen out of this file — added back
-- here during the 2026-10-24 dashboard rebuild after verifying them against
-- the live project's actual policies, per the standing note at the bottom of
-- this file about schema.sql drift.
create policy "Owners can create their own restaurant"
  on restaurants for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their own restaurant"
  on restaurants for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

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

alter table booking_needs enable row level security;

-- Only the diner who made the booking, or the owner of the restaurant it was
-- made at, can read its dining needs — this is the actual privacy boundary
-- for allergy info (health data), unlike `bookings` itself which is openly
-- readable for the share-with-friends link.
create policy "Diner or their restaurant can view booking needs"
  on booking_needs for select
  using (
    exists (
      select 1 from bookings b
      where b.id = booking_needs.booking_id
        and (
          b.user_id = auth.uid()
          or exists (
            select 1 from restaurants
            where restaurants.id = b.restaurant_id
            and restaurants.owner_id = auth.uid()
          )
        )
    )
  );

-- Only the diner who owns the booking can record needs for it (the
-- restaurant side is read-only — it sees needs, it doesn't set them).
create policy "Diner can add needs to their own booking"
  on booking_needs for insert
  with check (
    exists (
      select 1 from bookings b
      where b.id = booking_needs.booking_id
        and b.user_id = auth.uid()
    )
  );

alter table order_items enable row level security;

-- Only the restaurant that owns the booking can see or manage its order
-- items — same join pattern as booking_needs' restaurant-side policy above.
-- No diner-facing SELECT policy at all, unlike bookings/booking_needs.
create policy "Restaurant can view order items for their own bookings"
  on order_items for select
  using (
    exists (
      select 1 from bookings b
      join restaurants r on r.id = b.restaurant_id
      where b.id = order_items.booking_id and r.owner_id = auth.uid()
    )
  );

create policy "Restaurant can add order items to their own bookings"
  on order_items for insert
  with check (
    exists (
      select 1 from bookings b
      join restaurants r on r.id = b.restaurant_id
      where b.id = order_items.booking_id and r.owner_id = auth.uid()
    )
  );

create policy "Restaurant can update order items on their own bookings"
  on order_items for update
  using (
    exists (
      select 1 from bookings b
      join restaurants r on r.id = b.restaurant_id
      where b.id = order_items.booking_id and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from bookings b
      join restaurants r on r.id = b.restaurant_id
      where b.id = order_items.booking_id and r.owner_id = auth.uid()
    )
  );

create policy "Restaurant can delete order items from their own bookings"
  on order_items for delete
  using (
    exists (
      select 1 from bookings b
      join restaurants r on r.id = b.restaurant_id
      where b.id = order_items.booking_id and r.owner_id = auth.uid()
    )
  );

-- Diner-facing read path for the Tab feature (2026-10-25): the booker and
-- any joined guest can read their own booking's order items — the actual
-- RLS boundary behind "only the booker, added guests, and that
-- restaurant's staff can read a tab" (staff's own policy is above). A
-- public share-link visitor (no auth.uid()) can never match either branch,
-- so order_items stays invisible there exactly as before.
create policy "Booking participants can view their own order items"
  on order_items for select
  using (
    exists (select 1 from bookings b where b.id = order_items.booking_id and b.user_id = auth.uid())
    or exists (
      select 1 from booking_guests bg
      where bg.booking_id = order_items.booking_id and bg.user_id = auth.uid()
    )
  );

-- Live item updates on the diner's Tab screen as staff add things.
alter publication supabase_realtime add table order_items;

alter table booking_guests enable row level security;

-- "Is this user already a joined guest on this booking?" pulled out into its
-- own SECURITY DEFINER function rather than inlined as a subquery against
-- booking_guests inside booking_guests' own SELECT policy below — Postgres
-- re-applies a table's RLS policy to every reference to that table,
-- including one inside the policy's own subquery, so the inline version
-- caused infinite recursion (caught live via a rolled-back-transaction RLS
-- test: "infinite recursion detected in policy for relation
-- booking_guests"). A SECURITY DEFINER function's internal query bypasses
-- RLS entirely, breaking the cycle. authenticated-only: Supabase
-- auto-grants EXECUTE to anon on every new function by default, so that has
-- to be revoked explicitly too, not just `from public` (same gotcha as
-- claim_invite below).
create or replace function is_booking_guest(p_booking_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from booking_guests
    where booking_id = p_booking_id and user_id = p_user_id
  );
$$;

revoke all on function is_booking_guest(uuid, uuid) from public;
revoke execute on function is_booking_guest(uuid, uuid) from anon;
grant execute on function is_booking_guest(uuid, uuid) to authenticated;

-- Visible to the booker, any already-joined co-guest on the same booking
-- (so "Shared with Sara" can show everyone's name), and that restaurant's
-- staff.
create policy "Booking participants and staff can view guest rows"
  on booking_guests for select
  using (
    exists (select 1 from bookings b where b.id = booking_guests.booking_id and b.user_id = auth.uid())
    or is_booking_guest(booking_guests.booking_id, auth.uid())
    or exists (
      select 1 from bookings b
      join restaurants r on r.id = b.restaurant_id
      where b.id = booking_guests.booking_id and r.owner_id = auth.uid()
    )
  );

-- Only the booker can generate a new invite link for their own booking.
create policy "Booker can invite guests to their own booking"
  on booking_guests for insert
  with check (exists (select 1 from bookings b where b.id = booking_guests.booking_id and b.user_id = auth.uid()));

-- No UPDATE policy: claiming an invite goes through the claim_invite()
-- SECURITY DEFINER function at the bottom of this file instead of a direct
-- client-side UPDATE (see the comment there for why) — so RLS denies every
-- UPDATE on this table outright, same as reviews below has no UPDATE policy.

-- Only the booker can remove a guest from their own booking.
create policy "Booker can remove a guest from their own booking"
  on booking_guests for delete
  using (exists (select 1 from bookings b where b.id = booking_guests.booking_id and b.user_id = auth.uid()));

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

-- Busyness forecast cache (added 2026-10-23) — a weekly snapshot of a
-- restaurant's BestTime.app foot-traffic forecast, looked up by its name +
-- the new `restaurants.address` column above. One row per restaurant.
-- `forecast` is a compact `{ "0": [24 ints 0-100], ..., "6": [...] }` map,
-- keyed by BestTime's `day_int` (0=Monday..6=Sunday — NOT JS's
-- 0=Sunday..6=Saturday, see lib/busyness.js's dayIntFromDateStr), each array
-- the venue's hourly 0-100 busyness for that day. `forecast = '{}'` (the
-- default) means "looked up, BestTime found nothing" — distinct from no row
-- at all, which means "never looked up" (e.g. no address set yet).
create table restaurant_forecasts (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  besttime_venue_id text,
  forecast jsonb not null default '{}'::jsonb,
  -- The exact name/address this forecast was fetched for — lets a sync
  -- (dashboard save, or the weekly cron) tell "did the owner rename/move
  -- since the last sync?" and re-search by name+address instead of reusing
  -- a now-stale venue_id.
  synced_name text,
  synced_address text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table restaurant_forecasts enable row level security;

create policy "Public can view restaurant forecasts"
  on restaurant_forecasts for select
  using (true);

-- Deliberately no insert/update/delete policy — every write goes through
-- sync_restaurant_forecast() below instead. This project has no Supabase
-- service-role key (only the anon/publishable key, in both the browser and
-- server-side API routes — see app/api/besttime/), so unlike
-- restaurant_areas' owner-scoped RLS above, there's no `auth.uid()` session
-- to check for the weekly cron's writes (it runs with no logged-in user,
-- across every restaurant). A single small lockbox table instead:
create table app_secrets (
  key text primary key,
  value text not null
);
alter table app_secrets enable row level security;
-- No policies at all: unreadable/unwritable via PostgREST by anon or
-- authenticated. Only a SECURITY DEFINER function (which runs with the
-- table owner's privileges, bypassing RLS) can read it.

-- Holds one row, key='forecast_sync_secret' — a random token also held in
-- the server-only FORECAST_SYNC_SECRET env var (never NEXT_PUBLIC_, never
-- sent to the browser). insert into app_secrets (key, value) values
-- ('forecast_sync_secret', '<token>') on conflict (key) do update set
-- value = excluded.value; -- run once per environment, not re-run by this
-- file (no value to default to here without hardcoding a real secret into
-- version control).

-- The only way to write restaurant_forecasts: checks p_secret against the
-- app_secrets row above and raises (errcode 42501) on any mismatch —
-- including a missing row, i.e. the function fails closed, not open, if
-- app_secrets was never seeded. Called by both app/api/besttime/sync
-- (triggered when a restaurant saves its name/address) and
-- app/api/besttime/refresh (the weekly cron), each passing
-- process.env.FORECAST_SYNC_SECRET — never the browser, which never sees
-- this secret or calls this function.
create or replace function sync_restaurant_forecast(
  p_restaurant_id uuid,
  p_venue_id text,
  p_forecast jsonb,
  p_name text,
  p_address text,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_secret text;
begin
  select value into expected_secret from app_secrets where key = 'forecast_sync_secret';
  if expected_secret is null or p_secret is null or p_secret <> expected_secret then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into restaurant_forecasts (restaurant_id, besttime_venue_id, forecast, synced_name, synced_address, last_synced_at)
  values (p_restaurant_id, p_venue_id, coalesce(p_forecast, '{}'::jsonb), p_name, p_address, now())
  on conflict (restaurant_id) do update
    set besttime_venue_id = excluded.besttime_venue_id,
        forecast = excluded.forecast,
        synced_name = excluded.synced_name,
        synced_address = excluded.synced_address,
        last_synced_at = excluded.last_synced_at;
end;
$$;

-- Unlike enforce_booking_capacity()/prevent_unsafe_area_delete() above
-- (whose EXECUTE was deliberately revoked from anon/authenticated once
-- Supabase's advisor flagged them as unintentionally-public RPCs — see the
-- 2026-10-13/14 seating-areas entry in PROJECT_STATUS.md), this function's
-- anon/authenticated EXECUTE grant is intentional: the secret check above,
-- not the PostgREST role, is what authorizes a write. The advisor still
-- flags this function (anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable) — expected and
-- verified live (wrong secret -> 42501; correct secret -> write succeeds).
revoke all on function sync_restaurant_forecast(uuid, text, jsonb, text, text, text) from public;
grant execute on function sync_restaurant_forecast(uuid, text, jsonb, text, text, text) to anon, authenticated;

-- Guest-invite accept flow (Tab feature, 2026-10-25). booking_guests has no
-- public SELECT policy at all (unlike `bookings`, whose "unguessable ID"
-- model doesn't fit here — every row IS an invite token, so a bulk-readable
-- table would let anyone enumerate and claim invites never shared with
-- them). These two SECURITY DEFINER functions are the narrow, token-scoped
-- way around that, same pattern as sync_restaurant_forecast above.

-- Lets an anonymous visitor see just enough about an invite link to render
-- the accept page before they log in/sign up.
create or replace function get_invite_preview(p_token uuid)
returns table(restaurant_name text, booking_date date, booking_time text, valid boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select r.name, b.booking_date, b.booking_time,
    (bg.user_id is null and b.booking_date >= current_date) as valid
  from booking_guests bg
  join bookings b on b.id = bg.booking_id
  join restaurants r on r.id = b.restaurant_id
  where bg.invite_token = p_token;
end;
$$;

revoke all on function get_invite_preview(uuid) from public;
grant execute on function get_invite_preview(uuid) to anon, authenticated;

-- The actual claim step — authenticated only (both the explicit grant below
-- and the auth.uid() null-check inside enforce this; Supabase auto-grants
-- EXECUTE to anon on every new function by default, so the anon grant has
-- to be revoked explicitly too, not just `from public` — see the advisor
-- re-check in PROJECT_STATUS.md for how this was caught). Single atomic
-- UPDATE: the WHERE clause (unclaimed + not expired) is both the
-- authorization check and the optimistic-concurrency guard, so two
-- simultaneous claims on the same token can't both succeed.
create or replace function claim_invite(p_token uuid, p_guest_name text)
returns table(restaurant_name text, booking_date date, booking_time text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update booking_guests bg
  set user_id = v_user_id, guest_name = p_guest_name
  from bookings b
  where bg.invite_token = p_token
    and bg.booking_id = b.id
    and bg.user_id is null
    and b.booking_date >= current_date
  returning bg.booking_id into v_booking_id;

  if v_booking_id is null then
    raise exception 'This invite is no longer available.' using errcode = 'P0001';
  end if;

  return query
  select r.name, b.booking_date, b.booking_time
  from bookings b join restaurants r on r.id = b.restaurant_id
  where b.id = v_booking_id;
end;
$$;

revoke all on function claim_invite(uuid, text) from public;
revoke execute on function claim_invite(uuid, text) from anon;
grant execute on function claim_invite(uuid, text) to authenticated;
