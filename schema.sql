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
  sort_order integer default 0
);

-- Bookings made by diners
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  guest_name text not null,
  guest_phone text not null,
  party_size integer not null,
  zone text,                      -- e.g. "Indoor" | "Outdoor" | "Shisha Terrace"
  occasion text,                  -- e.g. "Birthday" | "Anniversary" | "Business" | null
  booking_time text not null,     -- e.g. "7:30 PM" (swap to a real timestamp for production)
  booking_date date not null default current_date,
  status text default 'pending',  -- 'pending' | 'confirmed' | 'declined' | 'no-show' | 'completed'
  card_last4 text,                -- from Stripe, never store full card numbers
  stripe_payment_method_id text,  -- Stripe token reference, added when you wire up Stripe
  charged boolean default false,
  created_at timestamp with time zone default now()
);

-- Basic indexes for the queries you'll run constantly
create index idx_bookings_restaurant on bookings(restaurant_id);
create index idx_bookings_status on bookings(status);

-- Row Level Security: turn on before going live so restaurants only see their own data
alter table restaurants enable row level security;
alter table bookings enable row level security;

-- Example starter policy (tighten this once you add restaurant login/auth):
-- allow anyone to read restaurant listings (public browsing)
create policy "Public can view restaurants"
  on restaurants for select
  using (true);

-- allow anyone to insert a booking (diners booking a table)
create policy "Anyone can create a booking"
  on bookings for insert
  with check (true);
