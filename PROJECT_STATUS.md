# Held — Project Status & Context

This file exists so a new Claude Code session can pick up exactly where the previous
work (done via Claude chat) left off. Read this fully before making changes.

## What this is
A restaurant table-booking platform for Downtown Dubai & DIFC fine dining.
Two sides: a diner-facing app (browse, book, manage reservations) and a
restaurant-facing dashboard (accept/decline bookings, manage settings).

Business model: restaurant subscriptions + a cut of no-show fees charged to diners.
The app is named **Held**. All visible branding and user-facing text was renamed from
the old "Masa" placeholder to Held on 2026-08-25 (see "Brand direction" below for the
full naming history). **Not renamed, deliberately:** the GitHub repo
(`hayafadhel9-cmd/masa-app`), the Vercel project/URL, `package.json`'s `name` field, and
a couple of internal (never user-visible) localStorage keys (`masa_lang`,
`masa_my_booking_ids`) — these are infrastructure/internal identifiers, not branding, and
renaming them is a separate, riskier task (breaking the live Vercel deploy URL,
losing already-saved local "My Bookings" data for existing users, etc.) that hasn't been
requested yet.

## Tech stack
- Next.js (App Router) + Tailwind CSS
- Supabase (Postgres database + Auth)
- Deployed on Vercel: https://masa-app-1e96.vercel.app (URL unchanged — see note above)
- GitHub: hayafadhel9-cmd/masa-app (repo name unchanged — see note above)

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
  existing restaurants who haven't configured it yet. Verified end-to-end against the
  live Supabase project on 2026-08-25 (dev server + browser test with a temporary
  capacity-1 zone and a temporary booking, both cleaned up afterward).
- Full English/Arabic bilingual support with proper RTL layout switching — **customer-facing
  app only**. Dashboard/settings/login are still English-only.
- Menu management in Settings: restaurant owners can add, edit, and delete their own
  dishes (name, price, photo) directly from `app/dashboard/settings/page.js` — no more
  manual SQL. Photos are real uploads (not URL pasting) to a public Supabase Storage
  bucket (`menu-photos`), scoped per restaurant at `{restaurant_id}/{filename}`. Each
  dish saves independently (not tied to the main "Save changes" button). The diner-facing
  menu display (`app/page.js`) shows the photo thumbnail when one is set.

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
The **zone/table capacity feature** and **menu management (with photo upload)** are both
now complete end-to-end (as of 2026-08-25). Next up is the visual floor plan builder
(now item 1 in the backlog below), unless the user redirects.

**Note on Supabase Storage RLS policies:** when writing a policy on `storage.objects`
that joins back to another table (e.g. `restaurants`) inside an `exists (select ... from
restaurants where ...)` subquery, always qualify the outer object's column explicitly as
`storage.objects.name` — a bare `name` resolves to the *subquery's* table (`restaurants.name`)
instead, which silently breaks the policy (it looked plausible but always evaluated
false). Hit this exact bug while building the menu-photos bucket policies; caught it via
the browser's alert() surfacing the raw Postgres RLS error, not by reading the SQL.

**Note on `schema.sql`:** it had fallen out of sync with the real Supabase schema —
missing `owner_id`, `opening_time`, `closing_time`, `party_sizes`, `min_advance_days`,
`max_advance_days`, `max_party_size`, `cancellation_notice_hours`, and `zone_capacity`
on `restaurants`, plus the `zone`/`occasion` columns on `bookings`. All of these existed
live but were undocumented in the file. This has been fixed — treat `schema.sql` as
trustworthy again, but if something seems off, verify against the live project
(`cqckxtytqyvldqogpscy`) rather than assuming the file is current.

## Full backlog (not yet built), in the order discussed with the user
1. Visual floor plan builder for the dashboard (drag/place individual tables, realistic
   layout, live status) — restaurant-side first, then a customer-facing cinema-style
   seat picker built on top of it later
2. "Mark as completed" button for confirmed bookings (so they don't sit forever after
   the reservation time has passed)
3. Edit an existing booking (time/zone/party size) — should re-trigger restaurant
   approval like a brand-new booking request, reusing the existing accept/decline +
   capacity-check flow rather than inventing new logic
4. Bill-split calculator (split a total by people or items, plus tip)
5. Translate the dashboard/settings/login pages into Arabic (customer app is already done)
6. Customer login (Supabase Auth, separate from restaurant login) — sync bookings across
   devices instead of relying on localStorage; this should also be the point where
   `bookings` RLS policies get properly tightened
7. Real Stripe integration for the no-show card hold
8. In-app notifications first, then real SMS/WhatsApp (via Twilio) — deliberately saved
   for closer to actual app-store launch, since WhatsApp Business API needs its own
   account + approval process

## Business/non-code context (for reference, not to act on automatically)
- Target market: Downtown Dubai & DIFC fine dining specifically, expanding to wider
  Dubai/UAE later — deliberately starting narrow (see reasoning in prior conversation)
- Main competitor: Eat App (Dubai-based, well-funded, has both B2B software and a
  consumer app) — Held's angle is hyper-local curation + a no-show deposit + occasion-aware
  booking + seating-zone picker, not trying to out-build a funded incumbent
- Planned subscription pricing: AED 500-800/month benchmark, with a discounted
  "founding partner" rate locked in for the first restaurants
- Marketing plan: get real restaurants + real bookings first, then run an influencer
  campaign specifically around whichever restaurant develops real visible demand/scarcity
  through the app (not before — the hook only works if the reservation was genuinely hard
  to get)
- App name decided as Held (was previously undecided between Masa / Majlis / Held) —
  see "Brand direction" below
- Full non-code to-do list (design, legal, App Store, business) is tracked separately by
  the user outside this repo

## Design psychology principles — apply to every new feature
These aren't optional polish, they're a standing design standard for this app:
- **Cognitive load**: one primary decision per screen. Don't combine multiple choices
  into one form if they can be sequential steps (see the existing booking flow: party
  size → time → occasion → zone → card, each its own screen).
- **Decision fatigue**: keep option sets scoped and relevant, not exhaustive. Only show
  choices the restaurant actually offers; don't add filters/options "just in case."
- **Habit loops**: design features to create a cue → routine → reward cycle where
  possible (e.g., "My Bookings" as a routine check-in; future notifications should
  nudge gently, not spam).
- **Color psychology**: the brand is intentionally desaturated/restrained (deep tones +
  gold accent), not bright primary colors — this is deliberate luxury-market
  positioning, not a placeholder. See "brand direction" below before changing colors.
- **Instant gratification**: every action needs immediate visual feedback — loading
  states, live updates (already using Supabase realtime on the dashboard), confirmation
  animations. Never leave the user staring at a blank screen wondering if something
  worked.

## Brand direction (as of latest design discussion)
- App name: **Held** (finalized). The rename to visible branding/user-facing text was
  applied throughout the codebase on 2026-08-25 — see the note at the top of this file
  for exactly what was and wasn't renamed.
- Wordmark concept: the lowercase "d" in "Held" is redrawn as a reservation-tag
  silhouette (tapered shape with a punched hole) — a hidden dual-meaning detail, similar
  to Amazon's arrow. Not yet built into the actual app, currently just a design concept.
- Color direction is being reconsidered: current app uses light/ivory backgrounds with
  deep teal (#0B3D3A) + brass gold (#C9A24B). Under discussion: a dark, near-black
  background (e.g. #151313) with gold accents for a more premium/distinctive feel,
  since light backgrounds read as generic and gold "glows" more against dark. Leaning
  toward: keep the working app's everyday screens light for readability, but apply the
  dark treatment to marketing surfaces (splash screen, app icon, App Store assets,
  social/marketing content) first, before considering a full app-wide dark theme.
  Nothing here is finalized — confirm with the user before making a big visual change.

## Environment / deployment notes
- The Supabase project (`cqckxtytqyvldqogpscy`) is on the free tier and auto-pauses
  after inactivity — it may show as inactive/paused at the start of a session and need
  restoring (via the Supabase MCP tool or the dashboard) before queries or the app will
  work.
- `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (not committed to git — see `.env.local.example`)
- `.npmrc` has `legacy-peer-deps=true` (needed because `lucide-react` was built for an
  older React version than the Next.js 15 / React 19 this project runs)
- Vercel auto-deploys from the `main` branch on push
