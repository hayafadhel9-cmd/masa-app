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
- Restaurant dashboard is organized into three tabs — **Needs Response** (pending),
  **Confirmed**, and **History** (dined / charged no-shows / cancelled-by-guest) — each
  showing a live count badge (e.g. "Needs Response (2)") that updates immediately via the
  existing Supabase realtime subscription regardless of which tab is active. Confirmed
  bookings have both "Mark as Dined" and "Mark no-show" buttons; marking a booking Dined
  sets `status = 'dined'` and moves it into History (dined bookings currently have no
  dismiss action — they stay listed, unlike settled no-shows / archived cancellations).
- Customer "My Bookings" tab has "Current" (pending/confirmed) and "Past" (dined/no-show/
  cancelled/declined) pill tabs right below the description text. When a restaurant marks
  a booking Dined, it automatically appears under the customer's Past tab next time that
  data loads (no separate realtime subscription on the customer side — this mirrors the
  existing load-on-tab-switch pattern, not a new live-push mechanism).
- **Customer-facing app visual redesign (2026-08-25):** `app/page.js` and
  `app/booking/[id]/page.js` were reskinned to a burgundy/gold/cream palette based on a
  Claude Design canvas mockup the user provided (`held-customer-flow.html`, 6 screens:
  Discover, RestaurantDetail, Booking, Confirmation, Reservations, ReservationDetail).
  New Tailwind tokens added in `tailwind.config.js` — `cream`, `card`, `tan`, `burgundy`,
  `burgundyLight`, `charcoal`, `muted`, `taupe`, `offwhite`, `warn` (gold reuses the
  existing `brass` token, since the mockup's gold #C9A24B is the exact same value).
  **The restaurant dashboard/settings/login remain on the old teal/ivory/brass palette,
  deliberately** — this redesign was explicitly scoped to the customer-facing app only;
  the two sides now intentionally look different from each other.
  All existing real functionality was preserved and just reskinned, not replaced: the
  native min/max-advance-window date input, the real party-size stepper, the occasion
  picker, the real per-zone capacity/availability check, and the confirm()-dialog booking
  cancellation flow. One genuinely new feature was added along the way (see next bullet).
  Deliberately **not** copied from the mockup: the "Tonight/Tomorrow/Party of N" quick-filter
  chips on its Discover screen (no real filtering logic backs them, and building that
  wasn't requested) and its single-screen booking form (the real app's multi-step
  screen flow — restaurant → book → zone → hold → confirmed — was kept as-is, just
  reskinned per-screen, rather than collapsed into the mockup's simpler one-screen version).
- **Real per-time-slot availability on the booking screen:** each time chip now shows
  either "N left" or "Full" (and disables if full), computed from real `zone_capacity` +
  live booking counts across *all* of a restaurant's zones for that date — added in
  `loadTimeAvailability()` in `app/page.js`. This only activates when **every** zone has a
  configured capacity; if even one zone is untracked (unlimited), the feature shows
  nothing rather than risk an inaccurate partial count — consistent with the existing
  zone-capacity "0/unset = unlimited" convention. This is upfront, informational only; the
  authoritative checks remain the existing per-zone check on the seating screen and the
  second check in `confirmBooking()`.
- **Copy refinements to the redesign (2026-08-25):** the "Held" wordmark on the Discover
  screen is now a large 52px/font-extrabold Georgia heading (was a small compact wordmark
  next to the language toggle). The Restaurant Detail CTA now reads "Continue" (was
  "Reserve a table"); the Booking screen's CTA now reads "Hold my table" (was "Continue to
  choose seating") — both are translation values (`reserveTable` / `continueSeating` keys
  in `lib/LanguageContext.js`), not hardcoded strings, so Arabic has matching copy too.
  Cancel wording is now status-aware everywhere it appears (My Bookings button label *and*
  the native `confirm()` dialog it triggers): "Cancel reservation" for a confirmed booking,
  "Cancel request" for a still-pending one (new `cancelRequest` / `confirmCancelReservation`
  / `confirmCancelRequest` keys). The party-size helper text and the shared booking page's
  status label (`app/booking/[id]/page.js`, previously hardcoded English-only with no
  `useLanguage` import at all) are now fully translated in both languages too (new
  `partySizeHint`, `partySizeMaxNote`, `confirmedStatus`, `heldStatus` keys — the last one
  because My Bookings' confirmed-status pill was also hardcoded "Held" in English only).
  At the time, confirmed there was no "No calling ahead, no walk-in gamble, just held, for
  you." copy on the Booking screen (that line only existed in the original mockup file) —
  see the next bullet for where a version of it actually landed shortly after.
- **Discover screen copy simplified (2026-08-25, same day, follow-up):** removed the
  "Downtown & DIFC's finest, held for you tonight." heading entirely — the big 52px "Held"
  wordmark now carries that on its own — and replaced the short subheadline with a fuller
  slogan: "No calling ahead, no walk in gamble, just held, for you." (deliberately no
  hyphen in "walk in" per the user's wording). The old `headline1`/`headline2` translation
  keys were removed from `lib/LanguageContext.js` since nothing else used them; `subheadline`
  now holds the new line in both English and Arabic.
- **Discover card icon removed + Restaurant Detail gaps filled (2026-08-25, same day,
  second follow-up):** the fork/knife placeholder icon next to each restaurant on the
  Discover list is removed entirely (there's no real restaurant-photo system yet, so it
  was pure placeholder) — the card layout was simplified to a single-column block so the
  name/details naturally fill the space instead of leaving a gap. On Restaurant Detail,
  added the cuisine/price row that had gone missing during the redesign (only area was
  showing before) and added a real "Available tonight" preview — the same
  `loadTimeAvailability()` real seat-count logic already used on the Book screen, now also
  triggered on the `"restaurant"` screen and rendered as a read-only chip row (selection
  still happens on Book; this is just an at-a-glance preview, matching the mockup's intent
  without duplicating the actual interactive time-picker). New `availableTonight`
  translation key. **The menu display was checked and confirmed to have never been broken
  or dropped** — `openRestaurant()` already queries `menu_items` and the render block was
  already present; verified live against two different real restaurants with real dishes
  (including one with real uploaded photos) and both rendered correctly. No fix was needed
  there, just confirmation.
  **Not built:** a "short description" field — `restaurants` has no such column in the
  schema (the mockup's description text was fake placeholder copy, not real data), so nothing
  was added rather than fabricate content; a real `description` column + Settings field
  would need to be requested as its own task if wanted.
- **Restaurant Detail hero placeholder removed (2026-08-25, same day, third follow-up):**
  the large tan hero band with a centered fork/knife icon at the top of Restaurant Detail
  is removed entirely, same reasoning as the Discover card icons — no real restaurant-photo
  system exists yet, so it was pure placeholder. "Back," the name, and everything below now
  sit directly at the top of the screen with no empty gap. The now-unused `UtensilsCrossed`
  icon import was also removed from `app/page.js` since nothing references it anymore.
- **Booking screen date picker replaced with a scrollable date-strip (2026-08-26):** the
  native `<input type="date">` is replaced with a horizontally-scrollable row of day pills
  (weekday abbreviation above, day number in a circle below, solid burgundy when selected),
  matching the mockup's visual language. The underlying logic is unchanged — a new pure
  helper, `generateDateStrip(minAdvanceDays, maxAdvanceDays, locale)` in `app/page.js`,
  enumerates the restaurant's real bookable date range and writes into the same
  `bookingDate` state the native input used to, so `loadTimeAvailability`,
  `confirmBooking`, etc. all keep working unchanged. Weekday labels are generated via
  `Intl.DateTimeFormat(locale, { weekday: "short" })` (real Arabic weekday names in Arabic
  mode, not a hardcoded "Su/Mo/Tu…" set translated by hand). Verified live: a restaurant
  with a 7-day window shows all days with no scroll needed; temporarily testing a 30-day
  window on `test 2` (reverted after) confirmed the strip scrolls correctly and far-out
  dates still flow through to `bookingDate` correctly; also confirmed correct RTL mirroring
  and real Arabic weekday labels in Arabic mode.
- **My Bookings copy/layout cleanup (2026-08-26):** removed the "Saved on this phone —
  reservations you've made or that friends shared with you." subtitle entirely (and its
  now-unused `myBookingsDesc` translation key); the empty-state message no longer uses a
  dash ("Nothing here yet, book a table, or open a link a friend shared with you.");
  Arabic updated to match (comma instead of an em-dash). The empty-state message is now
  vertically centered in the space below the Current/Past tabs rather than sitting right
  under them — the outer page wrapper became `flex flex-col`, the My Bookings block became
  `flex-1 flex flex-col`, and the empty-state got its own `flex-1 flex items-center
  justify-center` wrapper (the non-empty booking list is unaffected, still top-aligned).
  Verified live in both English and Arabic, both Current and Past tabs.
- **Edit an existing booking (2026-08-29):** from My Bookings, a customer can now edit a
  pending or confirmed booking's time, seating zone, or party size — a new "Edit" button
  appears on the booking card next to Share, alongside the existing Cancel/Remove actions.
  Because a change can affect the restaurant's real capacity, editing does **not** silently
  update the existing row. Instead `submitEditBooking()` in `app/page.js`: (1) marks the
  original booking `status = 'edited'` (a new status value, alongside `settled`/`archived`,
  documented in `schema.sql`'s column comment), and (2) inserts a brand-new row with the
  updated details and `status = 'pending'`, running through the exact same real
  zone-capacity check used for a fresh booking (`.neq("id", editingBooking.id)` excludes
  the booking being replaced from its own availability count, so editing a booking to the
  same time/zone doesn't falsely report it as full). The new pending row needs no dashboard
  changes at all — it flows into the restaurant's existing "Needs Response" tab exactly
  like any other new booking, verified live. The edited-away original shows in the
  customer's Past tab with a new "Edited" status pill (`editedStatus` key); the new request
  shows in Current as "Awaiting confirmation," same as any pending booking. The edit screen
  itself (`loadEditTimeAvailability` / `loadEditZoneAvailability`) reuses the same real
  per-slot "N left" / "Fully booked" availability logic as the main booking flow, also
  excluding the booking being edited from the counts. **The cutoff reuses the existing
  cancellation-notice-hours setting**: `handleEditClick()` calls the same `canFreelyCancel()`
  helper the free-cancellation check already uses, and shows a clear alert
  (`editWindowClosed` key, "Too close to your reservation time to edit — please contact the
  restaurant directly") instead of opening the edit screen when the booking is inside that
  window. Tested live end-to-end against a disposable QA restaurant with a tracked
  3-table Indoor zone: created a booking, edited its time/party size (7:00 PM/2 guests →
  8:00 PM/3 guests), confirmed the original flipped to `edited` in Past, the new pending
  row appeared correctly in the restaurant's Needs Response with no dashboard code changes,
  and that accepting it worked through the ordinary accept flow. Also confirmed live that
  the edit-window cutoff correctly blocks editing once a booking's date/time has passed
  (real system-clock date rolled over past the test booking's time mid-session, which
  triggered the `editWindowClosed` alert exactly as designed). **Not built:** editing the
  occasion field (out of scope — only time/zone/party size were requested, since those are
  the fields that affect capacity) and any dashboard-side UI to distinguish an edit-request
  booking from a fresh one (deliberately, per the request — it's meant to look identical).

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
The **zone/table capacity feature**, **menu management (with photo upload)**,
**dashboard tabs with a "Dined" status + customer Current/Past tabs**, the
**customer-app burgundy/gold visual redesign (+ real per-time-slot availability)**, a
follow-up **copy-polish pass** (wordmark size, CTA wording, status-aware cancel wording,
localizing the last two hardcoded-English spots), and **editing an existing booking**
(re-triggers restaurant approval as a fresh pending request) are all now complete
end-to-end (as of 2026-08-29). Each was tested live with a disposable QA restaurant
account — see the dated bullets above for what was specifically verified for the most
recent feature. Nothing is currently in progress. Next up is the visual floor plan builder
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
2. Bill-split calculator (split a total by people or items, plus tip)
3. Translate the dashboard/settings/login pages into Arabic (customer app is already done)
4. Customer login (Supabase Auth, separate from restaurant login) — sync bookings across
   devices instead of relying on localStorage; this should also be the point where
   `bookings` RLS policies get properly tightened
5. Real Stripe integration for the no-show card hold
6. In-app notifications first, then real SMS/WhatsApp (via Twilio) — deliberately saved
   for closer to actual app-store launch, since WhatsApp Business API needs its own
   account + approval process

(Edit-an-existing-booking, previously item 2 here, is done — see the 2026-08-29 bullet
above.)

(The old "Mark as completed" backlog item is done — see "Mark as Dined" above. Note it's
a manual restaurant action, not an automatic mark-after-time-passes; nobody has asked for
the automatic version yet.)

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
- **Color direction — decided and implemented for the customer app (2026-08-25):**
  the earlier dark-near-black-background idea discussed below was superseded when the
  user provided a finished design mockup instead. The customer-facing app
  (`app/page.js`, `app/booking/[id]/page.js`) now uses a warm cream/burgundy/gold
  palette: cream background (#F3EAE0), card surface (#FBF6EF), burgundy primary
  (#4A1729), gold accent (#C9A24B, same value as the existing `brass` token), charcoal
  text (#2B1F21) — see "What's fully working right now" above for the full token list
  and scope. The restaurant dashboard/settings/login intentionally still use the older
  teal/ivory/brass palette; nobody has asked to redesign that side yet.
  Superseded discussion, kept for history: a dark near-black background (e.g. #151313)
  with gold accents was being considered as an alternative, reasoning that light
  backgrounds read as generic and gold "glows" more against dark, with a lean toward
  applying that dark treatment only to marketing surfaces (splash screen, app icon, App
  Store assets) rather than the working app. That idea was never built and is no longer
  the active direction now that the cream/burgundy mockup has been implemented instead —
  raise it again explicitly if the user wants to revisit a dark theme.
- The original mockup the redesign was based on lives at `~/Downloads/held-customer-flow.html`
  (a Claude Design canvas export — the actual per-screen HTML/CSS is JSON-embedded inside
  it under a `<script type="application/json" id="appifact-doc">` tag, not directly
  readable as plain HTML; extract it with a small script if you need to reference it
  again, e.g. for redesigning the dashboard side later).

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
