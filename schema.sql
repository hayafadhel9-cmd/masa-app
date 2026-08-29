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
  zones text[] default array['Indoor'],  -- e.g. {Indoor,Outdoor,"Shisha Terrace"}
  cancellation_notice_hours integer default 2,
  owner_id uuid references auth.users(id),  -- links a restaurant to its dashboard login
  opening_time text default '18:00',
  closing_time text default '21:30',        -- may be earlier than opening_time (overnight hours)
  party_sizes integer[] default array[2, 4, 6, 8],
  min_advance_days integer default 0,
  max_advance_days integer default 30,
  max_party_size integer default 14,
  zone_capacity jsonb default '{}'::jsonb,  -- e.g. {"Indoor": 5, "Outdoor": 3} — table count per zone
  created_at timestamp with time zone default now()
);

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
  zone text,                      -- e.g. "Indoor" | "Outdoor" | "Shisha Terrace"
  occasion text,                  -- e.g. "Birthday" | "Anniversary" | "Business" | null
  booking_time text not null,     -- e.g. "7:30 PM" (swap to a real timestamp for production)
  booking_date date not null default current_date,
  status text default 'pending',  -- 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'no-show' | 'dined' | 'edited' (superseded by a customer-requested change) | 'settled' (dismissed no-show) | 'archived' (dismissed cancellation)
  card_last4 text,                -- from Stripe, never store full card numbers
  stripe_payment_method_id text,  -- Stripe token reference, added when you wire up Stripe
  charged boolean default false,
  created_at timestamp with time zone default now()
);

-- Basic indexes for the queries you'll run constantly
create index idx_bookings_restaurant on bookings(restaurant_id);
create index idx_bookings_status on bookings(status);
create index idx_bookings_user_id on bookings(user_id);

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
