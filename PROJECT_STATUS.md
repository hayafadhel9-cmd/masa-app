# Masa — Project Status & Context

This file exists so a new Claude Code session can pick up exactly where the previous
work (done via Claude chat) left off. Read this fully before making changes.

## What this is
A restaurant table-booking platform for Downtown Dubai & DIFC fine dining.
Two sides: a diner-facing app (browse, book, manage reservations) and a
restaurant-facing dashboard (accept/decline bookings, manage settings).

Business model: restaurant subscriptions + a cut of no-show fees charged to diners.
App name is still undecided — currently "Masa" as a placeholder. Shortlist: Masa,
Majlis, Held.

## Tech stack
- Next.js (App Router) + Tailwind CSS
- Supabase (Postgres database + Auth)
- Deployed on Vercel: https://masa-app-1e96.vercel.app
- GitHub: hayafadhel9-cmd/masa-app

## Project structure
- `app/page.js` — diner-facing app (browse, book, My Bookings tab)
- `app/dashboard/page.js` — restaurant dashboard (requires login)
- `app/dashboard/login/page.js` — restaurant sign up / login
- `app/dashboard/settings/page.js` — restaurant self-serve settings (hours, fees, zones, etc.)
- `app/booking/[id]/page.js` — public shareable booking view (for "share with friends")
- `lib/supabaseClient.js` — Supabase client setup
- `lib/myBookings.js` — localStorage helpers for guest "My Bookings" (no customer login yet)
- `lib/bookingTime.js` — cancellation window logic
- `lib/timeSlots.js` — generates time slots from opening/closing hours (handles overnight hours crossing midnight)
- `lib/LanguageContext.js` — English/Arabic i18n + RTL support (customer app only so far)
- `schema.sql` — full database schema, kept in sync with what's actually in Supabase

## What's fully working right now
- Restaurant browsing, menu display, real Supabase-backed data
- Diner booking flow: date picker (respects each restaurant's min/max advance-booking
  window), party-size stepper (any exact number, capped per-restaurant via `max_party_size`),
  time slots (generated from each restaurant's own opening/closing hours, handles
  overnight ranges like 18:00–02:00), seating zone picker (Indoor/Outdoor/Shisha Terrace),
  occasion picker (Birthday/Anniversary/Business), card-hold step (UI only, NOT real Stripe yet)
- No-show fee disclosure + cancellation policy, both configurable per restaurant
- Booking confirmation, "Share with friends" (native share sheet / copy link),
  public shareable booking page, "My Bookings" tab (tracked via localStorage per phone/browser,
  no real customer accounts yet)
- Customers can cancel (if outside the free-cancellation window) or just remove a
  booking from their local "My Bookings" list
- Restaurant dashboard: accept/decline pending bookings, mark no-show (calculates
  platform's 18% cut of the no-show fee), dismiss settled no-shows, see guest-cancelled
  bookings and archive them
- Restaurant login (Supabase Auth) — dashboard and settings are gated per-account via
  `owner_id` on the `restaurants` table
- Restaurant self-serve Settings: name, cuisine, area, price tier, booking hours,
  min/max advance-booking window, max party size online, table sizes offered,
  seating zones + **per-zone table counts** (`zone_capacity` jsonb column), no-show fee,
  cancellation notice window
- Zone capacity / availability checking: when a diner reaches the seating screen, the
  app checks how many bookings already exist for that restaurant/date/time/zone and
  compares to the zone's configured table count (`zone_capacity`). Full zones show as
  disabled with "Fully booked at this time." There's also a second check right before
  the booking is actually submitted (in `confirmBooking`), to reduce (not fully
  eliminate) race conditions between two people booking the last table at once.
  **Note:** `zone_capacity` of 0 or unset is treated as "not tracking capacity for this
  zone" (unlimited), not "always full" — this was a deliberate choice to avoid breaking
  existing restaurants who haven't configured it yet.
- Full English/Arabic bilingual support with proper RTL layout switching — **customer-facing
  app only**. Dashboard/settings/login are still English-only.

## Known limitations / deliberate simplifications (not bugs)
- Card hold step is a plain text input, NOT connected to Stripe or any real payment processor
- No customer login yet — "My Bookings" is tracked per-browser via localStorage, not a real account
- RLS (row-level security) on `bookings` is fairly open (`using (true)` on several policies)
  since customer login doesn't exist yet — this is a known gap to tighten once customer
  accounts are built
- Capacity checking is per-zone (e.g., "5 tables in Outdoor"), NOT per-specific-table yet.
  A real visual floor plan (named/placed individual tables) is a planned future feature.
- No real-time notifications (SMS/WhatsApp) — restaurants only see new bookings if they're
  looking at the dashboard, or via Supabase realtime updates while the tab is open

## In-progress work / what to pick up next
The most recent active work was finishing the **zone/table capacity feature** described
above. If continuing that work, verify:
1. Migration ran: `alter table restaurants add column if not exists zone_capacity jsonb default '{}'::jsonb;`
2. `app/dashboard/settings/page.js` has per-zone table-count inputs next to each zone checkbox
3. `app/page.js` has `loadZoneAvailability()`, and the zone-selection screen shows
   "Fully booked at this time" for zones at capacity

## Full backlog (not yet built), in the order discussed with the user
1. Table/zone capacity — see above, may already be complete or in progress
2. Visual floor plan builder for the dashboard (drag/place individual tables, realistic
   layout, live status) — restaurant-side first, then a customer-facing cinema-style
   seat picker built on top of it later
3. Menu management in Settings (add/edit dishes + photos — currently requires manual SQL)
4. "Mark as completed" button for confirmed bookings (so they don't sit forever after
   the reservation time has passed)
5. Edit an existing booking (time/zone/party size) — should re-trigger restaurant
   approval like a brand-new booking request, reusing the existing accept/decline +
   capacity-check flow rather than inventing new logic
6. Bill-split calculator (split a total by people or items, plus tip)
7. Translate the dashboard/settings/login pages into Arabic (customer app is already done)
8. Customer login (Supabase Auth, separate from restaurant login) — sync bookings across
   devices instead of relying on localStorage; this should also be the point where
   `bookings` RLS policies get properly tightened
9. Real Stripe integration for the no-show card hold
10. In-app notifications first, then real SMS/WhatsApp (via Twilio) — deliberately saved
    for closer to actual app-store launch, since WhatsApp Business API needs its own
    account + approval process

## Business/non-code context (for reference, not to act on automatically)
- Target market: Downtown Dubai & DIFC fine dining specifically, expanding to wider
  Dubai/UAE later — deliberately starting narrow (see reasoning in prior conversation)
- Main competitor: Eat App (Dubai-based, well-funded, has both B2B software and a
  consumer app) — Masa's angle is hyper-local curation + a no-show deposit + occasion-aware
  booking + seating-zone picker, not trying to out-build a funded incumbent
- Planned subscription pricing: AED 500-800/month benchmark, with a discounted
  "founding partner" rate locked in for the first restaurants
- Marketing plan: get real restaurants + real bookings first, then run an influencer
  campaign specifically around whichever restaurant develops real visible demand/scarcity
  through the app (not before — the hook only works if the reservation was genuinely hard
  to get)
- Still deciding on final app name (Masa / Majlis / Held)
- Full non-code to-do list (design, legal, App Store, business) is tracked separately by
  the user outside this repo

## Environment / deployment notes
- `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (not committed to git — see `.env.local.example`)
- `.npmrc` has `legacy-peer-deps=true` (needed because `lucide-react` was built for an
  older React version than the Next.js 15 / React 19 this project runs)
- Vercel auto-deploys from the `main` branch on push
