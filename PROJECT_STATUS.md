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
the `masa_lang` localStorage key — these are infrastructure/internal identifiers, not
branding, and renaming them is a separate, riskier task (breaking the live Vercel deploy
URL) that hasn't been requested yet. (The other old internal key, `masa_my_booking_ids`,
no longer exists — see the 2026-08-29 customer-accounts bullet below.)

## Tech stack
- Next.js (App Router) + Tailwind CSS
- Supabase (Postgres database + Auth)
- Deployed on Vercel: https://masa-app-1e96.vercel.app (URL unchanged — see note above)
- GitHub: hayafadhel9-cmd/masa-app (repo name unchanged — see note above)

## Project structure
- `app/page.js` — diner-facing app (Discover / My Bookings / Account tabs, booking flow,
  customer auth)
- `app/dashboard/page.js` — restaurant dashboard (requires login + restaurant ownership)
- `app/dashboard/login/page.js` — restaurant sign up / login
- `app/dashboard/settings/page.js` — restaurant self-serve settings (hours, fees, zones, etc.)
- `app/booking/[id]/page.js` — public shareable booking view (for "share with friends";
  read-only — see the 2026-08-29 customer-accounts bullet for why the old "save to my
  bookings" button on this page was removed)
- `middleware.js` — refreshes the Supabase session cookie on every request and gates
  `/dashboard/*` routes server-side (added 2026-08-29, see the security bullet below)
- `lib/supabase/client.js` — Supabase **browser** client (`@supabase/ssr`, cookie-based
  sessions — replaces the old `lib/supabaseClient.js`, which no longer exists)
- `lib/passwordRules.js` — shared client-side password validation (min length + basic
  complexity) used by both the restaurant and customer sign-up forms
- `lib/bookingTime.js` — cancellation window logic
- `lib/timeSlots.js` — generates time slots from opening/closing hours (handles overnight hours crossing midnight)
- `lib/LanguageContext.js` — English/Arabic i18n + RTL support (whole app)
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
- Full English/Arabic bilingual support with proper RTL layout switching across **the
  entire app** — customer-facing pages and the restaurant dashboard/settings/login (see
  the 2026-08-29 bullet below for when the dashboard side was added).
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
- **Restaurant dashboard, settings, and login pages translated into Arabic (2026-08-29):**
  `app/dashboard/page.js`, `app/dashboard/settings/page.js`, and `app/dashboard/login/page.js`
  now use the same shared `useLanguage()` / `LanguageContext.js` mechanism as the customer
  app, including full RTL layout (the existing `LanguageProvider` and `masa_lang`
  localStorage persistence are global across the whole app already, so no provider-wiring
  changes were needed — just per-page `useLanguage()` imports, a language-toggle button
  added to each page's header, `t()` calls replacing every hardcoded string, and `rtl:`
  Tailwind variants on directional icons like the settings page's back chevron). Roughly 70
  new translation keys were added to `lib/LanguageContext.js` for these three pages
  (verified programmatically that the English and Arabic key sets match exactly, no
  duplicates). In `app/dashboard/settings/page.js`, the zone names (Indoor/Outdoor/Shisha
  Terrace) reuse the customer app's existing zone translation keys rather than duplicating
  them, and the save-confirmation message's color now comes from a dedicated `saveError`
  boolean state set explicitly in the save handler, not from comparing `savedMsg` against a
  translated string (comparing against translated text would break if the user switched
  language between saving and the message re-rendering). Verified live end-to-end in
  Arabic against a disposable QA restaurant: dashboard header, tab labels, and booking
  cards render correctly RTL-mirrored; Settings' full form (name, cuisine, area, price
  tier, booking window, zones + per-zone table counts, no-show fee, cancellation window,
  menu section) renders and saves correctly with the green "تم الحفظ!" confirmation; the
  login/signup form and its language toggle work correctly after signing out. **Not
  built:** nothing scoped out — this covers the full three-page request as asked.
- **Bug fix — no-show fee disclosure/card field shown even when a restaurant charges
  AED 0 (2026-08-29):** the booking Hold screen in `app/page.js` used to always show the
  no-show fee disclosure box and require a card number, even for a restaurant with
  `no_show_fee_aed` set to 0 (or unset) — misleading, since there was nothing to actually
  charge. Fixed by conditioning the disclosure box, the card number field, and the Stripe
  prototype disclaimer paragraph on `active.no_show_fee_aed > 0`; when it's 0/unset, the
  screen instead shows a shorter subtitle via a new `holdsTableNoCard` translation key
  ("No card required — this restaurant doesn't charge a no-show fee.") and the customer can
  tap straight through to "Confirm & hold table" with no card entry at all. When the fee is
  greater than 0, behavior is byte-for-byte unchanged (disclosure box + required card
  field). `card_last4` still falls back to the existing "4242" placeholder value in the
  no-card case (nothing reads it unless a restaurant later marks that booking a no-show,
  which is a pre-existing, unrelated dashboard behavior not touched by this fix). Tested
  live against two disposable QA restaurants: one with `no_show_fee_aed = 150` (disclosure
  box, card field, and disclaimer all present, exactly as before) and one with
  `no_show_fee_aed = 0` (all three absent, booking completes with zero card input) — both
  cases verified in English and in Arabic/RTL (the new Arabic string reads "لا حاجة لبطاقة
  — هذا المطعم لا يفرض رسوم عدم حضور.").
- **Cream background color updated to its final brand shade (2026-08-29):** the `cream`
  Tailwind token (`tailwind.config.js`) changed from #F3EAE0 to #F1E9D6, the finalized
  shade from the brand's logo files. This is the only place the color is defined — every
  usage (`app/page.js`'s main screen container and bottom tab bar, `app/booking/[id]/page.js`'s
  three screens) reads `bg-cream` and picked up the new value automatically with no other
  code changes needed. Verified live: `getComputedStyle` on a `.bg-cream` element returns
  `rgb(241, 233, 214)` (= #F1E9D6 exactly), and the shareable booking page and Discover
  screen both render the new shade correctly.
  **Not done — blocked, needs the user's input:** the same request also asked to wire up 8
  new "Held" wordmark icon files (`held-wordmark-icon-29.png` through `-1024.png`) as the
  site/app favicon, apple-touch-icon, and manifest icons. Those files do not actually exist
  in `public/` (checked — the folder is empty) or anywhere else searched (Downloads,
  Desktop, Documents). The user confirmed doing the color change alone for now and will add
  the files separately before the icon-wiring half of this request is picked back up.
- **Real customer accounts (2026-08-29):** diners now sign up / log in with email +
  password (Supabase Auth, the same auth system restaurants use — there is only one
  Supabase Auth user pool for the whole project, restaurants and customers are just rows
  in different application tables, not different auth systems). Two decisions were made
  with the user before building this:
  1. **Login is required to complete a booking, browsing stays open to everyone.**
     Discover and Restaurant Detail need no login. Reaching the final "Confirm & hold
     table" step while logged out shows a sign-in/sign-up screen in place of the booking
     confirmation (`screen === "authGate"` in `app/page.js`); on success, the exact same
     booking the customer was mid-flow on completes immediately and automatically (no
     re-entering party size/time/zone) — `confirmBooking()` accepts an optional user
     override so it can use the freshly-returned `signUp`/`signInWithPassword` user
     directly, without waiting on React state to catch up.
  2. **A third "Account" tab was added to the bottom nav** (Discover / My Bookings /
     Account). Logged out, it shows the same sign-up/login form. Logged in, it shows the
     customer's name/email/phone (from `user.user_metadata`, not a separate `profiles`
     table — email+password+full_name+phone was all "profile" needed, so a whole new
     table/RLS surface for it wasn't justified), the language toggle (**moved here from
     its old spot on the Discover screen header**, per the request), and Sign out.
  3. **"My Bookings" is now fully account-linked**, replacing the old per-browser
     localStorage tracking (`lib/myBookings.js`, deleted — nothing references it anymore).
     `loadMyBookings()` now queries `bookings` by `user_id` instead of a locally-stored id
     list, so bookings genuinely follow the customer across devices/browsers. The old
     "Remove" button (which only ever meant "stop tracking this locally," never a real
     delete) was removed from the Past-tab card — it has no meaning now that the list is
     the customer's real account history, not something local to hide items from.
  Sign-up collects full name + mobile number in addition to email/password (stored via
  `supabase.auth.signUp({ options: { data: { full_name, phone } } })`). A shared
  `CustomerAuthForm` component (defined once in `app/page.js`) is reused in three places:
  the Account tab, the My-Bookings-while-logged-out prompt, and the booking auth gate.
  **Deliberately not migrated:** bookings made before this feature (tracked only in a
  guest's own browser via the old `masa_my_booking_ids` localStorage key) are left
  exactly as they are in the database — per the user's explicit call, "existing
  guest/localStorage bookings don't need to be migrated." A side effect worth knowing:
  since "My Bookings" is now account-only, those old guest bookings are no longer
  reachable through the customer app's UI at all (not hidden — just no code path reads
  localStorage IDs anymore). The restaurant dashboard is completely unaffected, since it
  has always queried by `restaurant_id`, never by customer identity. The old public
  "Save to My Bookings" button on the shareable booking page (`app/booking/[id]/page.js`)
  was also removed — it let a friend with no account (or a different account) adopt
  someone else's booking into their own local list, which doesn't map onto real accounts
  (RLS would block it anyway; it's not their booking). That page is now a pure read-only
  invite view, matching its stated purpose.
  **Tested live end-to-end** with disposable QA accounts: booked while logged out → hit
  the auth gate → signed up with name/phone/email/password → booking completed
  automatically with no re-entry → showed up correctly in My Bookings and in the
  Account tab profile card → the same restaurant's real dashboard (logged in separately
  as its owner) showed the booking in Needs Response exactly like any other, confirming
  restaurant accounts are unaffected → confirmed a customer account navigating directly
  to `/dashboard` gets redirected away by `middleware.js` before ever seeing dashboard
  content. See the security bullet immediately below for the database/RLS side of this
  feature and everything found/fixed during the accompanying security pass.
- **Security hardening pass, done alongside the customer-accounts work (2026-08-29):**
  the user asked for an 11-point audit given this was the first time the app handled real
  (non-test) user accounts and data. For each item: what was found, and what was actually
  changed.
  1. **Session storage** — was Supabase's default (JWT in `localStorage`, readable by any
     injected script). Migrated the **entire app** (both restaurant and customer auth, by
     explicit user choice) to `@supabase/ssr` cookie-based sessions: `lib/supabase/client.js`
     replaces the old raw `createClient()` call, and `middleware.js` refreshes the session
     server-side on every request (calling `getUser()`, which re-validates against
     Supabase's Auth server rather than trusting a locally-decoded JWT). Verified live:
     `sb-<ref>-auth-token` is a cookie, not a `localStorage` key, after login. **Honest
     caveat, not overclaimed:** because every page in this app is a Client Component that
     queries Supabase directly from the browser (no Route Handlers or Server Components
     do any data fetching), the access token still has to be readable by client-side JS
     to make those calls — true `httpOnly`-only protection (the token never touching
     client JS at all) would require moving those queries behind Route Handlers/Server
     Actions, which is a much larger rearchitecture than "migrate session storage" and
     was not attempted. What this migration *does* deliver: Secure/SameSite cookie
     attributes, and independent server-side session verification everywhere
     `middleware.js` runs (used concretely for the dashboard route gate below).
  2. **Server-side admin/role checks** — audited every place that gates restaurant-only
     content. `app/dashboard/*` pages already relied on RLS-scoped queries
     (`.eq("owner_id", user.id)`) rather than a client-passed flag, which was already
     sound. Added a genuine gap-closer: `middleware.js` now checks, server-side, on every
     `/dashboard/*` request (except `/dashboard/login`): is there a session at all
     (redirect to login if not), and — except for `/dashboard/settings`, which is also
     where a first-time owner completes onboarding and can't require an existing
     restaurant — does this user actually own a restaurant (redirect to `/` if not).
     Verified live: a logged-in customer account requesting `/dashboard` directly is
     redirected away before any dashboard content renders.
  3. **Email verification** — confirmed OFF (new accounts get an active session
     immediately with no confirmation click, which is how every restaurant QA account
     created earlier this session worked). **This is a Supabase Dashboard-only setting
     (Authentication → Sign In / Providers → Email → "Confirm email") — no tool available
     here can read or change it**, so it hasn't been turned on; the user needs to flip it
     in the dashboard. The code is written to handle both states correctly regardless of
     when that happens: `signUp()`'s response is checked for `data.session` — if it's
     null (confirmation required), a "check your email" screen is shown
     (`confirmEmailTitle`/`confirmEmailBody` keys) instead of assuming immediate access.
     This mattered immediately for the *existing* restaurant sign-up flow too: it used to
     create the `restaurants` row inline right after `signUp()`, which only works with an
     immediate session — turning on email confirmation would silently break restaurant
     onboarding. Fixed regardless of whether the toggle ever gets flipped: restaurant
     sign-up no longer creates the row inline (and no longer collects a restaurant name at
     signup — that field was removed from the sign-up form since it's redundant with
     onboarding); `app/dashboard/settings/page.js`'s save handler now inserts a brand-new
     restaurant row on first save if none exists yet, instead of only ever updating one
     (a latent bug — `if (!restaurant) return` — that happened to never fire before
     because a row always pre-existed by the time settings loaded).
  4. **Rate limiting** — Supabase Auth applies its own default per-IP rate limits to all
     `/auth/v1/*` endpoints (sign-up, sign-in, password recovery, etc.) automatically;
     this isn't something the app's own code enables or configures, and it isn't
     customizable on the Free plan. No custom app-level rate limiting was built — with
     zero real users yet, standing up bespoke infrastructure for it (this app has no
     backend beyond Supabase itself; there's nowhere to hang custom rate-limit state
     without adding one) isn't proportionate right now. Revisit if/when there's real
     signup traffic to actually rate-limit.
  5. **Password rules** — added `lib/passwordRules.js` (min 8 characters, at least one
     letter and one number), used by both the customer and restaurant sign-up forms, with
     matching translated hint text. This is explicitly a fail-fast UX layer, not the real
     boundary — Supabase enforces its own minimum server-side regardless. Checked whether
     "leaked password protection" (checks new passwords against HaveIBeenPwned) is
     available: Supabase's own security advisor confirms the feature exists but is
     currently **disabled** — again a Dashboard-only toggle (Authentication → Policies →
     password settings) with no tool access to flip it here; needs the user to enable it.
  6. **`bookings` RLS tightening** — this table's policies were fully open
     (`using (true)` on select/insert/update) from before real customer accounts existed.
     Added a `user_id uuid references auth.users(id)` column (nullable — old guest rows
     keep `NULL`, per the "don't migrate old bookings" decision) and replaced the open
     insert/update policies. Deliberate design, confirmed with the user first:
     - **SELECT stays open** (`using (true)`) — the "Share with friends" feature lets
       anyone with a booking's exact link/UUID view it with no account; the security
       model for that was already "unguessable random ID," not RLS, and tightening SELECT
       would have silently broken a feature that was explicitly built and tested earlier
       in this project.
     - **INSERT** now requires `auth.uid() = user_id` — only a logged-in customer can
       create a booking for themselves; matches "login is required to book."
     - **UPDATE** requires either `auth.uid() = user_id` (the owning customer) or that the
       requester owns the restaurant the booking belongs to (a subquery against
       `restaurants.owner_id`) — both able to update, restaurant owners for full
       accept/decline/dined/no-show/settle/archive control, customers for cancelling or
       triggering an edit.
     - **Found and fixed a real gap during live testing of this**, not just designed on
       paper: the first version of the UPDATE policy checked *row ownership* but not
       *which values* were being written, so a customer could `PATCH` their own pending
       booking straight to `status: "confirmed"` via a direct API call — self-approving
       past the restaurant's accept/decline step entirely. Fixed by adding a value
       constraint to the policy: a customer's own update is only allowed if the resulting
       `status` is `cancelled` or `edited` (the only two statuses the customer-facing app
       ever sets); a restaurant owner's update is unrestricted, preserving all existing
       dashboard actions. Re-tested the same exploit afterward via a raw authenticated
       `fetch()` call (bypassing the UI entirely) and confirmed it now returns
       `403 new row violates row-level security policy`, while a legitimate cancel from
       the same account still succeeds. Also tested and confirmed blocked: inserting a
       booking with a spoofed `user_id` belonging to someone else (403).
  7. **API keys / secrets** — confirmed only `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public
     anon key, safe for client code) is used anywhere in the codebase; no service-role key
     or other secret appears in any file. Searched the full `git log -p` history for
     Supabase key patterns, `service_role`, Stripe-style `sk_live`/`sk_test` prefixes, and
     JWT-shaped strings outside `NEXT_PUBLIC_*` — nothing found. `.env.local` is
     `.gitignore`d and confirmed to have never been committed (`git log --all
     --full-history -- .env.local` returns nothing).
  8. **Input sanitization** — confirmed zero uses of `dangerouslySetInnerHTML` anywhere in
     the codebase (React's default escaping is relied on everywhere strings are
     rendered), and confirmed every Supabase call uses the parameterized query builder
     (`.eq()`, `.insert()`, etc.) — no raw SQL string concatenation exists anywhere in the
     app.
  9. **Menu-photo upload security** — was functionally working but had **no real
     server-side validation**: the `menu-photos` Storage bucket had no `file_size_limit`
     or `allowed_mime_types` set, and the app only checked `accept="image/*"` on the
     `<input>`, a client-side hint an attacker can trivially bypass (e.g. calling the
     Storage API directly, exactly as demonstrated for the RLS tests above). Fixed at the
     real enforcement layer: the bucket now has `file_size_limit = 5MB` and
     `allowed_mime_types` restricted to `image/jpeg|png|webp|gif`, set directly on
     `storage.buckets` via migration. Added matching client-side validation
     (`validatePhotoFile()` in `app/dashboard/settings/page.js`) purely as faster feedback
     for legitimate users — the bucket-level settings are what actually block anything
     bypassing the UI.
  10. **Security headers / production hardening** — `next.config.js` previously set no
      headers at all. Added `Content-Security-Policy` (scoped to `'self'` plus the
      Supabase project host for API/image/websocket traffic — no other third-party hosts
      exist in this app), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
      `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
      `Permissions-Policy`, and `Strict-Transport-Security`. Verified live via
      `curl -I` against a real `next start` production build that all headers are present
      on both normal responses and the middleware's redirect responses. **Honest caveat:**
      the CSP's `script-src` still includes `'unsafe-inline' 'unsafe-eval'`, which
      Next.js's own runtime needs unless the app adopts a nonce-based CSP (a bigger,
      separate change) — so this materially reduces third-party script/frame injection
      risk but doesn't fully eliminate inline-script XSS on its own. HTTPS: Vercel
      enforces this by default for all deployments; nothing to configure, and nothing
      that could be verified from this local-only environment. No dev-only routes or
      debug endpoints exist to worry about — the app has zero API routes / Route Handlers
      at all currently. Console logging was audited: the only `console.error` calls
      anywhere log a Supabase `error.message` string, never a token, password, or other
      sensitive value.
  11. **Cost safety** — the Supabase organization is confirmed on the **Free plan**, which
      has hard usage limits/pausing rather than usage-based billing, so there's no
      "surprise bill" risk to alert on there. Vercel's plan/billing settings aren't
      visible from this environment — the user should check their own Vercel dashboard
      for any spend-alert configuration if that project is on a paid tier.
  Two items above are **manual, dashboard-only actions the user still needs to take** —
  no tool available in this environment can read or change Supabase Auth project
  settings: **(a)** enable "Confirm email" under Authentication → Sign In / Providers →
  Email, and **(b)** enable "Leaked password protection" under Authentication → Policies.
  The app's code already handles both correctly once enabled (see items 3 and 5 above).
  A pre-existing, unrelated finding surfaced by Supabase's own advisor during this pass:
  `restaurant_tables` has RLS enabled with zero policies (meaning it denies all access to
  everyone) — this table has no code path reading or writing it anywhere in the app, so
  it's inert dead schema, not a live vulnerability; left as-is since removing/fixing an
  unused table wasn't part of this request.
  Also fixed in passing, found via `npm install`: 4 pre-existing high-severity `npm audit`
  findings in Next.js's own dependency chain (DoS/XSS/SSRF advisories fixed upstream).
  Bumped `next` from the pinned `15.5.9` to `15.5.24` (a same-major patch release) and ran
  `npm audit fix` for the rest; one moderate `postcss` advisory remains, only fixable by
  a Next.js 15→16 major upgrade (a separate, much larger change with its own regression
  risk) — deliberately left as an accepted, disclosed risk rather than bundled into this
  pass.

## Known limitations / deliberate simplifications (not bugs)
- Card hold step is a plain text input, NOT connected to Stripe or any real payment processor
- Customer accounts exist now (2026-08-29 — see the bullet above), but email verification
  and leaked-password protection are still OFF at the Supabase project level — both need
  the user to flip a Dashboard toggle; the app's code already handles either state
  correctly (see the security bullet above)
- `bookings` RLS was tightened alongside customer accounts (2026-08-29): writes are scoped
  to the owning customer or the owning restaurant; reads intentionally stay open so
  "Share with friends" keeps working via unguessable booking links — see the security
  bullet above for the exact policy shapes and the self-approval gap that was found and
  closed during that work
- Capacity checking is per-zone (e.g., "5 tables in Outdoor"), NOT per-specific-table yet.
  A real visual floor plan (named/placed individual tables) is a planned future feature.
- No real-time notifications (SMS/WhatsApp) — restaurants only see new bookings if they're
  looking at the dashboard, or via Supabase realtime updates while the tab is open
- Full httpOnly session isolation isn't achieved (see the session-storage security bullet
  above for exactly why) — the access token is still readable by client-side JS since
  every page queries Supabase directly from the browser; closing that gap fully would
  require moving data-fetching behind Route Handlers/Server Actions, a larger
  rearchitecture not attempted here

## In-progress work / what to pick up next
The **zone/table capacity feature**, **menu management (with photo upload)**,
**dashboard tabs with a "Dined" status + customer Current/Past tabs**, the
**customer-app burgundy/gold visual redesign (+ real per-time-slot availability)**, a
follow-up **copy-polish pass** (wordmark size, CTA wording, status-aware cancel wording,
localizing the last two hardcoded-English spots), **editing an existing booking**
(re-triggers restaurant approval as a fresh pending request), and **Arabic/RTL support
for the restaurant dashboard, settings, and login pages** are all now complete end-to-end
(as of 2026-08-29). Each was tested live with a disposable QA restaurant account — see
the dated bullets above for what was specifically verified for the two most recent
features. The **no-show fee disclosure/card field bug fix** and the **cream color update
to #F1E9D6** (2026-08-29) are also both done — see the dated bullets above. **Real
customer accounts and the accompanying 11-point security hardening pass** (2026-08-29,
see the two large bullets above) are also complete and tested live — this was the
largest single piece of work in the project so far: cookie-based sessions app-wide,
server-side dashboard route gating, a tightened `bookings` RLS model (with a real
self-approval exploit found and closed during testing, not just designed on paper), menu
photo upload limits enforced server-side, security headers, and a dependency vulnerability
fix. **Two manual follow-ups only the user can do** (no tool here can touch Supabase Auth
project settings): enable "Confirm email" and "Leaked password protection" in the
Supabase Dashboard's Authentication settings — see the security bullet above for exactly
where. **Pending, unrelated:** wiring up the 8 new "Held" wordmark icon files as the
favicon/apple-touch-icon/manifest icons — the user asked for this alongside the cream
color change, but the files aren't actually in `public/` yet (confirmed empty). Once the
user adds `held-wordmark-icon-29.png` through `held-wordmark-icon-1024.png` to `public/`,
pick this up: reference appropriately-sized ones from `app/layout.js`'s `metadata.icons`
(favicon, apple-touch-icon) and create/update a `manifest.json` (none exists yet) to list
the larger sizes for PWA install icons, then verify the favicon renders in an actual
browser tab before considering it done — a build passing isn't sufficient proof for this
kind of change. Next up after that is the visual floor plan builder (now item 1 in the
backlog below), unless the user redirects.

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
3. Real Stripe integration for the no-show card hold
4. In-app notifications first, then real SMS/WhatsApp (via Twilio) — deliberately saved
   for closer to actual app-store launch, since WhatsApp Business API needs its own
   account + approval process

(Customer login, previously item 3 here, is done — see the 2026-08-29 bullets above.
Real Stripe integration would also be a good time to move file-upload-style secrets, if
any get introduced, to a proper server-side integration rather than client-only code.)

(Edit-an-existing-booking and dashboard/settings/login Arabic translation, both
previously items 2 and 4 here, are done — see the 2026-08-29 bullets above.)

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
  palette: cream background (#F1E9D6 — updated 2026-08-29 from the initial #F3EAE0 to the
  brand's final shade), card surface (#FBF6EF), burgundy primary
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
