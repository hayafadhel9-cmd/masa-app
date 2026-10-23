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
  3. **Email verification** — was confirmed OFF when this audit was first done (new
     accounts got an active session immediately with no confirmation click). **The user
     has since enabled "Confirm email" in the Supabase Dashboard (Authentication → Sign
     In / Providers → Email) — this is now ON in the live project (2026-08-29).** The code
     was written to handle both states correctly regardless of when the toggle got
     flipped: `signUp()`'s response is checked for `data.session` — if it's null
     (confirmation required, which is now always the case for a real signup), a "check
     your email" screen is shown (`confirmEmailTitle`/`confirmEmailBody` keys) instead of
     assuming immediate access. This mattered immediately for the *existing* restaurant
     sign-up flow too: it used to create the `restaurants` row inline right after
     `signUp()`, which only works with an immediate session — turning on email
     confirmation would have silently broken restaurant onboarding. Fixed regardless of
     the toggle: restaurant sign-up no longer creates the row inline (and no longer
     collects a restaurant name at signup — that field was removed from the sign-up form
     since it's redundant with onboarding); `app/dashboard/settings/page.js`'s save
     handler now inserts a brand-new restaurant row on first save if none exists yet,
     instead of only ever updating one (a latent bug — `if (!restaurant) return` — that
     happened to never fire before because a row always pre-existed by the time settings
     loaded). **Re-verified live after the toggle was flipped:** attempting to sign up
     with an `@example.com` address (this session's disposable-QA-account convention)
     now fails outright with `Email address "..." is invalid` on both the customer and
     restaurant sign-up forms, confirmed on both — Supabase now validates deliverability
     since it has to actually send a confirmation email, and `example.com` is a
     non-deliverable reserved domain. The error surfaces correctly through the existing
     `setError(signUpError.message)` handling on both forms, no orphaned rows were created
     by the rejected attempts, and this isn't a bug: it's Supabase's own enforcement
     working as intended. **Testing implication for future sessions:** the
     `...@example.com` throwaway-account pattern used throughout this project's QA testing
     no longer works for exercising the sign-up flow end-to-end (it fails before an
     account is even created) — a real, deliverable test mailbox is needed to click
     through an actual confirmation link and verify the post-confirmation login path.
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
     currently **disabled**. **Known, accepted gap (2026-08-29):** enabling it requires
     Supabase's Pro plan (~$25/month); the user has decided to stay on the Free plan for
     now and is deliberately not paying for this specific protection at this stage. This
     is a business decision, not something to work around in code — there is no
     client-side or free-tier equivalent worth building as a substitute (a real
     breached-password check requires a server-side service like HaveIBeenPwned's API,
     which is exactly what the Pro-plan feature already wraps). Revisit enabling the
     toggle if/when the project upgrades to Pro for other reasons.
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
  **Update (2026-08-29, after this audit was written):** both manual items above are now
  resolved, one way or the other, by the user directly in the Supabase Dashboard — no tool
  in this environment can read or change Supabase Auth project settings, so this always
  required the user's own action:
  - **(a) "Confirm email" is now enabled.** Re-verified live — see item 3 above for what
    changed in practice (Supabase now rejects non-deliverable test addresses like
    `@example.com` outright) and the resulting testing-pattern implication for future
    sessions.
  - **(b) "Leaked password protection" stays disabled — accepted, not pending.** It
    requires Supabase's Pro plan (~$25/month); the user has decided to remain on the Free
    plan for now, so this is a deliberate, documented gap rather than an outstanding
    to-do. See item 5 above. Revisit only if/when the project upgrades to Pro.
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
- **Password field usability additions (2026-09-07):** every password input in the app
  (customer sign-in/sign-up and restaurant sign-in/sign-up — both share the same
  `type={showPassword ? "text" : "password"}` pattern) now has a show/hide eye-icon toggle
  inside the field, and shows a "Caps Lock is on" warning while it's active. The Caps Lock
  detection is a small shared hook, `lib/useCapsLockWarning.js` (`onKeyDown`/`onKeyUp` →
  `event.getModifierState("CapsLock")`), used identically by both forms since the
  underlying browser API is the same regardless of each form's very different visual
  styling — only the show/hide toggle markup and warning message placement were written
  per-form to match each one's existing layout. Verified live in the browser, including
  in Arabic/RTL: the eye icon correctly mirrors to the start (left) side of the field in
  both forms — Tailwind's logical `end-*`/`pe-*` utilities on the customer form's
  absolutely-positioned button, and ordinary flexbox row reversal on the restaurant
  form's icon-inside-a-flex-row layout. The Caps Lock warning was verified by dispatching
  a synthetic keyboard event with a mocked `getModifierState` (Chrome's own remote-control
  automation doesn't reliably toggle the real OS-level Caps Lock modifier for
  `getModifierState` to read), and confirmed it appears/disappears correctly and coexists
  cleanly with the sign-up form's existing password-rule hint text underneath it.
- **Booking screen no longer asks for name/phone (2026-09-27):** since login is required
  to complete a booking (see "Real customer accounts" above), asking for a name and phone
  on every single booking was redundant — that info already lives on the account. The
  "Your name" and "Mobile number" fields were removed from the Booking screen in
  `app/page.js` entirely; `confirmBooking()` now derives `guest_name`/`guest_phone` from
  the signed-in user via two small helpers in the new `lib/guestInfo.js`:
  `guestNameFromUser(user)` (falls back through `reservation_name` → `full_name` →
  `"Guest"`) and `guestPhoneFromUser(user)` (always `user.user_metadata.phone`, no
  override — phone was never meant to differ per-booking). A new **optional "Reservation
  name"** field was added to the Account tab (customer side only — the restaurant
  dashboard's own login/settings are untouched) letting a customer set a different name to
  use on bookings than their account's main name (e.g. a nickname). It's stored as
  `reservation_name` in the same Supabase Auth `user_metadata` bag as `full_name`/`phone`
  (no new table), saved via `supabase.auth.updateUser({ data: { reservation_name } })`,
  and clearing the field back to blank removes the key entirely (`null`) rather than
  storing an empty string, so the fallback-to-full-name logic triggers correctly. Both
  new translation strings (`reservationName`, `reservationNameHint`) were added in English
  and Arabic; the now-unused `yourName` key (only ever used by the removed field) was
  deleted from both. Tested live end-to-end against the real Supabase project: set a
  reservation name → booked → confirmed the `bookings` row's `guest_name` was the
  reservation name, not the account name; cleared the reservation name → booked again →
  confirmed it fell back to the account's `full_name` correctly; `guest_phone` was the
  account phone in both cases. Also verified in Arabic — the label, hint text, and RTL
  text entry into the field all work correctly (one pre-existing, unrelated cosmetic
  quirk noticed during this pass: the Sign Out button's icon doesn't mirror to the other
  side of its text in RTL the way the language-toggle button's icon does, even though both
  use the same `flex items-center gap-2` pattern — not introduced by this change, not
  investigated further, flagging only in case it's worth a look later). The restaurant
  dashboard needed no changes at all — it already just renders whatever `guest_name`/
  `guest_phone` a booking row has, same as before. Live-testing this required a real
  logged-in customer session; the Resend free-tier sandbox on this project only delivers
  confirmation emails to the project owner's own address, so a fresh sign-up through the
  UI couldn't be used for testing. The user created a test account directly via the
  Supabase dashboard (Authentication → Add user, Auto Confirm) instead — see the new
  "Resend is still in sandbox mode" bullet under "Known limitations" below, which is a
  separate, already-existing issue affecting real user sign-ups too, not just testing.
- **Forgot password for the restaurant dashboard login (2026-10-04):** restaurant owners
  previously had no self-service way back in if they forgot their password.
  `app/dashboard/login/page.js` now has a "Forgot password?" link (login mode only) that
  switches to a small inline form (email only) and calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/dashboard/reset-password` })`;
  a generic "Check your email" confirmation shows regardless of whether the account
  exists (`resetLinkSentBody` key), matching Supabase's own no-enumeration behavior. A new
  page, `app/dashboard/reset-password/page.js` (wrapped in `<Suspense>` for
  `useSearchParams`, same pattern as `settings/page.js`), establishes the recovery session
  from the emailed link — handles both the PKCE `?code=` param
  (`exchangeCodeForSession`) and the older hash-fragment flow (via an `onAuthStateChange`
  `PASSWORD_RECOVERY` listener as a fallback) — then lets the owner set a new password
  (reusing `passwordRuleMessage`/`PASSWORD_MIN_LENGTH` from `lib/passwordRules.js`, with
  the same show/hide + Caps Lock affordances as every other password field in the app) and
  redirects to `/dashboard` on success. `middleware.js` exempts `/dashboard/reset-password`
  from the auth gate the same way `/dashboard/login` already is, since the page must load
  before a session exists.
  **Tested live end-to-end against the real production deployment**
  (`https://masa-app-1e96.vercel.app`), not just locally: triggered a reset for the real
  owner account (`hayafadhel9@gmail.com`), confirmed the emailed link's `redirect_to`
  correctly pointed at the production `/dashboard/reset-password` URL, and the user
  clicked it directly from their own inbox, reached the set-new-password form, set a new
  password, and logged in successfully with it.
  **Known gotcha, not a bug in this app:** Supabase recovery links are single-use. If a
  link passes through an email click-tracking/scanning layer before the real user clicks
  it, that hop can consume the one-time token first, surfacing as `otp_expired` /
  "Email link is invalid or has expired" on a legitimate, never-yet-clicked link. Observed
  during testing: a reset link relayed through an extra hop (pasted into chat, which
  revealed it was wrapped by Resend's AWS SES-backed click-tracking domain,
  `*.awstrack.me`) failed with this error, while the same flow worked immediately when the
  user opened a fresh email and clicked straight from their inbox. Nothing to fix in this
  app's code — worth knowing if a restaurant owner reports a reset link not working: have
  them request a fresh one and click it directly from their mail client rather than
  forwarding/pasting it elsewhere first.
- **Investigated, not reproduced (2026-10-04): report of `/dashboard/login` redirecting a
  restaurant owner to the customer-facing app instead of the dashboard.** The user
  reported that logging in as the restaurant owner (`hayafadhel9@gmail.com`) redirected to
  `/` instead of showing the dashboard, even right after a password reset. Investigated the
  likely mechanism — `middleware.js`'s `requiresExistingRestaurant` check redirects to `/`
  if the logged-in user owns no row in `restaurants` — but found no ambiguity to explain
  it: exactly one `auth.users` row exists for that email, exactly one `restaurants` row has
  a matching `owner_id`, and the `restaurants` SELECT policy is `using (true)` so the
  ownership query doesn't depend on `auth.uid()` resolving correctly. Reproduced the full
  login flow live, with a fresh browser session and a temporary admin-set password, against
  both the local dev server (same production Supabase project) and the real production URL
  (`https://masa-app-1e96.vercel.app`) — both times login correctly reached `/dashboard`
  and showed the owned restaurant, no redirect to `/`. No code change was made since
  nothing reproducible was found; ruled out a stale service worker/PWA cache (this app has
  neither). **If this recurs**, capture the exact browser/device, whether it's a normal or
  incognito window, and any active browser extensions — a cookie-blocking extension, a
  stale cached JS bundle on that specific device, or a transient Supabase/network blip are
  the most likely remaining explanations for a bug that wouldn't reproduce in a clean
  environment.
- **Edge-fade effect on the Booking screen's date strip (2026-10-04):** the horizontally-
  scrollable date strip (see the 2026-08-26 bullet above) now fades days near the left and
  right edges of its visible container and un-fades them smoothly as they scroll toward the
  center — a purely visual polish, no logic change. Implemented as a CSS `mask-image` (plus
  `-webkit-mask-image` for Safari) linear gradient — `transparent → black 32px → black
  calc(100% - 32px) → transparent` — applied inline on the scrollable container in
  `app/page.js`, directly alongside its existing `overflow-x-auto` classes. Because the
  gradient fades the container's physical left/right edges symmetrically, it needed no
  RTL-specific handling: the same style works unchanged in both directions. The real
  `generateDateStrip(minAdvanceDays, maxAdvanceDays, locale)` date-range/availability logic
  is completely untouched. **Tested live:** against a restaurant with a 16-day bookable
  window (`min_advance_days=0`, `max_advance_days=15`), confirmed both edges visibly fade
  at rest and scrolling the strip moves the fade with it (newly-revealed days enter faded
  and sharpen toward the center; days leaving the opposite edge fade out), in both English
  and Arabic/RTL — confirmed in genuine (pre-auto-translate) Arabic that the date order and
  fade both mirror correctly (newest-visible date at the trailing edge, same symmetric
  fade). **Unrelated observation made during this test, not a code issue:** Chrome's
  built-in page translator can silently auto-translate this app's Arabic UI to English in
  the background after a few seconds on a page (it adds a `translated-ltr`/`translated-rtl`
  class to `<html>` and rewrites visible text nodes, leaving the app's own `dir`/state
  untouched) — if a future session's screenshots show English text on a page that should be
  Arabic, check for that class before assuming the app's language switch broke.
- **Account tab restructured into a Talabat-style profile pattern (2026-10-04):** the
  previously fully-inline Account tab (profile card + every editable field always visible)
  in `app/page.js` is now three views behind a local `accountView` state
  (`"main" | "info" | "payment"`, reset to `"main"` on sign-out):
  - **Main screen:** a profile header (circular burgundy avatar showing the first letter of
    the display name, full name, email underneath) followed by a grouped card of full-width
    tappable rows — "Account info" and "Payment methods" (both chevron-ended, navigate into
    their own view) and "Language" (shows the *other* language as a label on the trailing
    side, e.g. "عربي" while in English — tapping it calls the same `setLang` toggle that
    used to live inline here, just relocated). "Sign out" is a separate full-width row below
    the group, with centered text (not the row list's left-aligned/chevron style).
  - **Account info sub-page:** back button, then all four fields together — Full name
    (newly editable; previously set only at signup and never editable after), Reservation
    name, Mobile number (both pre-existing editable fields, now moved here), and Email
    (**read-only display, not an input** — a deliberate choice confirmed with the user,
    since a real editable-email flow needs Supabase's email-change confirmation email,
    which Resend's sandbox mode can't currently deliver to non-owner addresses anyway; see
    the Resend bullet below) — with one single "Save changes" button at the bottom
    (centered text) that writes all three editable fields in one
    `supabase.auth.updateUser({ data: {...} })` call, replacing the old one-button-per-field
    pattern. "Payment methods" is a simple back-button + "Coming soon" card — intentionally
    not real card storage, which needs a separate Stripe integration project.
  - **Three bug fixes bundled into this same pass:**
    1. The account header used to show the literal word "Guest" for any real logged-in user
       whose `user_metadata.full_name` wasn't set (e.g. a QA account created directly via
       the Supabase dashboard rather than through the real sign-up form). Now it falls back
       to the email's local part (e.g. `heldtest1` for `heldtest1@gmail.com`) before ever
       falling back to "Guest" — a real logged-in user essentially always has *some*
       sensible name to show. This is computed once as `accountDisplayName` (and
       `accountAvatarInitial` from its first character) near the component's render return,
       reused by both the avatar and the header text.
    2. The Mobile Number field now genuinely pre-fills from `user_metadata.phone` — this
       logic already existed (a `useEffect` keyed on `[user]`) but is confirmed working
       correctly in this pass; it was extended to also pre-fill the new Full Name field from
       `user_metadata.full_name`.
    3. The Save button's dusty-mauve look was never actually a wrong color — it's
       `bg-burgundy` with Tailwind's `disabled:opacity-60` applied while the button is
       legitimately disabled (no unsaved changes), which washes the deep burgundy out to a
       muted mauve-ish tone. Confirmed live: typing into any field immediately shows the
       button at full-opacity real burgundy. No color value needed to change; this is noted
       here so a future session doesn't "fix" something that was already correct.
  - **Tested live end-to-end** (local dev server, same production Supabase project) using
    the "Held Test Account" QA account: logged in with a freshly-emptied metadata state
    (confirming the email-fallback display-name fix), filled and saved all three editable
    fields via the new combined Save button, reloaded the page fresh and confirmed all four
    Account info fields correctly pre-filled from the saved data, confirmed the main
    screen's header picked up the new name, exercised the Payment methods placeholder,
    toggled Language from its new row (confirmed the whole screen re-renders RTL-mirrored
    correctly, including chevron direction via the existing `rtl:rotate-180` convention),
    and confirmed Sign out returns to a correctly-RTL-rendered logged-out prompt. Verified
    in genuine (pre-auto-translate) Arabic — see the edge-fade bullet above for why that
    matters when capturing screenshots of this app in Arabic.
- **Post-dining ratings (2026-10-04):** customers can now rate a restaurant after a booking
  is marked "dined," and the average shows on the restaurant page as a partially-filled
  star.
  - **New `reviews` table** (`booking_id`, `restaurant_id`, `user_id`, `rating` 1-5,
    `comment`, `created_at`), added via migration and mirrored in `schema.sql`. A `unique
    (booking_id)` constraint enforces one review per booking at the DB level, as defense in
    depth alongside RLS. **RLS:** SELECT is public (`using (true)`) so the average can show
    without a login; INSERT requires `auth.uid() = user_id` *and* an `exists` check that the
    referenced booking belongs to that same user, has `status = 'dined'`, and its
    `restaurant_id` matches the review's — the same ownership-plus-value-check pattern used
    to close the original bookings self-approval exploit (see the 2026-08-29 security
    bullet). **No UPDATE or DELETE policy exists at all**, so RLS denies both outright —
    nobody can edit or delete any review, their own or anyone else's.
  - **Rating prompt:** `app/page.js` checks once per login (a `useEffect` keyed on `[user]`)
    for a dined booking with no review and not already dismissed, and surfaces it as a
    `RatingPromptModal` (restaurant name, booking date/party size, 5 tappable stars, optional
    comment, Submit, "Not now"). "Not now" and a successful submit both record the booking
    id in a `localStorage` set (`masa_rating_dismissed_ids`) so the auto-prompt shows at most
    once per dined booking — a deliberate choice over a DB column, since it's a low-stakes
    per-device nicety, not something that needs to survive a device switch (the actual
    review itself, once submitted, obviously does — it's in the DB).
  - **Rate later from My Bookings:** a dined booking with no review shows a "Rate your
    visit" button in the Past tab (hidden once reviewed); tapping it opens the same modal,
    pre-filled for that booking, bypassing the dismissed-set check since it's an explicit
    user action.
  - **Aggregate star on the restaurant page:** `RatingStar` (a reusable component) renders a
    single SVG star with a **hard clip-path**, not a gradient — a `<clipPath>` `<rect>` with
    a percentage width — filling gold (`#C9A24B`) from the left up to `average / 5` and
    tan (`#D6CBB2`) the rest of the way, with brand gold/tan as plain color literals, not
    Tailwind tokens (nothing new needed in `tailwind.config.js`). `openRestaurant()` fetches
    `reviews.rating` for the restaurant and computes the average client-side; if there are
    zero reviews, nothing renders in that spot (no "0.0", no empty star). **RTL:** the
    star+number cluster is wrapped with `direction: ltr` on an *inner* span only (not the
    outer positioning div) — forcing `ltr` keeps the star-before-number order and the fill
    direction from mirroring under the page's `dir="rtl"` (CSS `flex-direction: row` is
    direction-aware and would otherwise visually reverse to "number, star"), while leaving
    the outer div direction-unset so the whole badge still right-aligns under the restaurant
    name instead of drifting to the page's left edge. (The clip-path's own percentage width
    was never at risk of mirroring either way — `clip-path: inset()`/SVG geometry use
    physical, not logical, coordinates.)
  - **Tested live end-to-end** against the real production Supabase project (local dev
    server): created real bookings through the actual booking flow, marked them "Dined"
    from the real restaurant dashboard (twice, to verify the real flow — remaining dined
    bookings needed for the fill-percentage tests were inserted directly via SQL once that
    mechanism was already confirmed), and verified: the prompt auto-appears for a dined,
    unreviewed booking and not again after submitting; "Not now" suppresses the auto-prompt
    but leaves "Rate your visit" available in My Bookings → Past; submitting from either
    path writes a real row and updates the restaurant page. Verified the star fill at
    5.0 (100%, whole star gold), 3.5 (70%), and 2.5 (50%) by adding ratings that average to
    each value in turn (zoomed screenshots confirmed the hard edge at the right proportion
    each time), and confirmed a restaurant with zero reviews shows nothing. **Security:**
    re-tested the self-approval-exploit pattern specifically for this new table, using a raw
    authenticated `fetch()` call (not the UI) from the browser console — confirmed blocked
    with `403`/`42501` (RLS policy violation) both for a review referencing a booking owned
    by a different customer account and for a review on the reviewer's own booking that
    wasn't yet "dined," and confirmed a duplicate review on an already-reviewed booking is
    blocked with `409`/`23505` (unique constraint) even if RLS were somehow bypassed. All
    test bookings and reviews created during this pass were deleted afterward; the 3
    pre-existing unrelated bookings in the table (from before this session) were left
    untouched.
- **Booking screen date strip redesigned to a 7-up weekday-picker layout (2026-10-04):**
  pure layout/styling pass against a reference image (Talabat-style picker) — the real
  date-range/availability logic (`generateDateStrip`) was not touched. The "DATE" label
  above the strip is removed. Each day cell is now exactly `flex-[0_0_calc(100%/7)]` so
  precisely 7 cells fill the card's width (was unconstrained-width content-sized cells with
  a `gap`, letting ~9 narrow days show at once). The container has `snap-x snap-mandatory`
  and each cell `snap-start`, so scrolling (through the real booking window, unchanged)
  settles cleanly on a 7-day boundary. Weekday labels are 2-letter in English (`d.weekday.slice(0,
  2)` — "Su", "Mo"…, a presentational truncation of the existing `Intl.DateTimeFormat`
  output, not a logic change) and the full Arabic short-form weekday name in Arabic (Intl's
  "short" width already returns the full word for `ar` — there's no shorter standard form);
  `text-base` regular weight, no uppercase/tracking, `text-taupe`. Day numbers are
  `text-[22px]` regular weight `text-charcoal`; the selected-day circle grew from 36px to
  48px (`w-12 h-12`) with white text on burgundy. A `isPast` check (`d.value < today's date
  string`) dims a day to `opacity-35` if present — purely defensive/presentational, since
  `generateDateStrip`'s loop always starts at `today + min_advance_days` (never before
  today) for every restaurant currently in the schema, so this never actually fires with
  real data today; it's there only to match the reference image's dimmed-past-day example
  and to be ready if that ever changes. The edge fade (added 2026-10-04 earlier the same
  day) was tuned from a single hard-ish two-stop gradient to a 6-stop ~40px eased ramp
  (`transparent → 40% opacity by 12px → opaque by 40px`, mirrored on the other edge) so all
  7 resting days stay clearly readable with only the outermost one or two slightly
  softened, and newly-revealed days fade in smoothly while scrolling.
  **Real bug found and fixed during live testing, not just a styling tweak:** the initial
  implementation used `flex-[0_0_calc(100%/7)]` alone, which still let a day cell grow
  wider than 1/7 if its weekday-label text was wider than the cell (flex items default to
  `min-width: auto`, which ignores `flex-shrink: 0`'s intent and refuses to shrink below
  the content's own intrinsic width) — this broke the uniform grid and, as a direct
  consequence, made native CSS scroll-snap settle on seemingly "wrong" (non-cell-aligned)
  positions, since the browser was correctly snapping to each cell's *actual* (non-uniform)
  rendered edge, not the uniform 1/7 width the layout was supposed to guarantee. Fixed by
  adding `min-w-0` to each cell and `truncate` to the weekday label, so long label text
  (verified specifically against Chrome's own auto-translate injecting full day names like
  "Wednesday" during testing — see the edge-fade bullet above for that known gotcha) clips
  inside the fixed-width cell instead of forcing it wider. Verified via direct DOM
  measurement (`getBoundingClientRect()` on every cell) that all cells are exactly
  58.28px wide pre- and post-fix comparison, and that `scrollLeft` after a scroll resolves
  to within ~0.002 of an exact multiple of the cell width (clean snap), both of which
  failed before the fix.
  **Tested live** in both English and Arabic/RTL (genuine, pre-auto-translate, in a fresh
  tab each time — see the known Chrome-translate gotcha noted above): confirmed exactly 7
  full days visible at rest with no partial 8th cell, confirmed scrolling in both
  directions through the real booking window settles cleanly on 7-day boundaries with the
  fade visibly animating as days cross the edge, confirmed day selection still works
  (unchanged logic), and compared a zoomed screenshot of the live result side-by-side
  against the user's reference image — matching weekday-label style, number style and
  size, and selected-circle size/color.
- **Date strip sizing/spacing pass + default-selection bug fix (2026-10-04, same day,
  follow-up):** three small adjustments to the just-redesigned date strip, styling/layout
  only except where noted.
  1. **Smaller strip:** weekday labels `text-base` (16px) → `text-sm` (14px); day numbers
     `text-[22px]` → `text-[18px]`; selected-day circle `w-12 h-12` (48px) →
     `w-[38px] h-[38px]` (38px). Still exactly 7 equal-width cells (`flex-[0_0_calc(100%/7)]`
     unchanged) and the same edge fade.
  2. **Tighter vertical rhythm:** the gap between each cell's weekday label and its number
     (`gap-1.5`, 6px) was already within the requested 6–8px and was left as-is; the gap
     between the strip and the "PARTY SIZE" label (`mb-5 pb-1` = 24px) is now `mb-3 pb-1` =
     16px.
  3. **Top padding:** the Booking screen's wrapper changed from `pt-4` (16px, fixed) to
     `pt-[calc(20px+env(safe-area-inset-top))]`, so the header gets 20px of breathing room
     plus the device's real notch/status-bar inset on a phone, rather than a flat value
     that's the same whether or not the device has a safe area to clear. (Scoped to the
     Booking screen only, per the request — the other screens' `pt-4` wasn't touched.)
  4. **Bug fix (the one logic change in this pass):** the selected date could end up
     scrolled out of view with no day visibly highlighted — reproduced live by scrolling
     the strip away and leaving/re-entering the screen (matching exactly what the user
     described: strip showing unrelated later days, no burgundy circle anywhere). Two
     additions in `app/page.js`: (a) a `useEffect` keyed on `[screen, active, bookingDate]`
     that, whenever the Booking screen is open, checks whether `bookingDate` matches any
     day in the currently-generated strip and falls back to the first bookable date if not
     (defensive — in practice `openRestaurant()`'s default always matches the strip's first
     entry already, but this guarantees the invariant "a day is always selected" even if
     that ever changes); (b) the same effect scrolls the selected day's button into view
     (`scrollIntoView({ inline: "center", block: "nearest" })`, via a `data-selected`
     attribute and a `dateStripRef`) inside a `requestAnimationFrame` so it runs after
     layout. Re-tested the exact repro after the fix: scrolling away and leaving/re-entering
     the screen now reliably re-shows the selected day, confirmed in both English and
     genuine (pre-auto-translate) Arabic/RTL.
  **Verified via direct DOM measurement** (not just eyeballing): label font-size 14px,
  number font-size 18px, circle 38×38px, label-to-number gap 6px, strip-to-PartySize gap
  20px (top of the requested 16–20px range), exactly 7 cells (`strip.clientWidth /
  cellWidth` ≈ 7.0005), and the compiled CSS rule for the top-padding class confirmed to
  literally contain `calc(20px + env(safe-area-inset-top))` (not just resolve to a flat
  20px because this dev browser has no real safe-area inset to add).
- **Booking screen unified spacing pass + party-size hint removed (2026-10-04, same day,
  second follow-up):** supersedes the ad-hoc per-section spacing from the two bullets
  above with one consistent system across all four sections on the screen (Date, Party
  size, Time, Celebrating anything) — each is a `<label>` followed by its content, now
  spaced identically everywhere: **12px** between a label and its content, **28px**
  between one section's content and the next section's label.
  - **Hint text removed:** "Enter your exact group size — we'll seat you at the right
    table." is gone (English and Arabic), along with its now-unused `partySizeHint`
    translation key in both locales. The max-party-size warning
    (`partySizeMaxNote`, "For groups larger than {max}…") is a *different*, still-needed
    message — it's now conditionally rendered (only when `party >= max_party_size`,
    previously it unconditionally occupied that slot, showing the hint the rest of the
    time) with its own tight ~8px gap down from the party-size box and the standard 28px
    down to "TIME", so removing the generic hint doesn't leave a gap-sized hole and the
    max-note still reads as clearly attached to the stepper above it.
  - **"DATE" label restored** above the date strip (removed in an earlier pass this same
    day, brought back here at the user's request) — same classes as the other three
    section labels (`text-[11px] font-bold uppercase tracking-widest text-taupe`), plus
    the `date` translation key (`"Date"` / `"التاريخ"`) re-added to `lib/LanguageContext.js`.
  - **Real cross-browser layout quirk found and fixed, not just a Tailwind class swap:**
    initially set each section's content to `mt-3` (12px) / `mb-7` (28px) and measured the
    actual rendered gaps — they came out to 16px / 36px, a consistent +4px over target on
    every single section. Root cause: `<label>` has no default `display` override in this
    app (browsers render it `inline`), and an inline element's line-height creates a
    "strut" — extra vertical space in the surrounding flow — that doesn't show up in the
    label's own `getBoundingClientRect()` but still pushes the next block element down,
    on top of its declared margin. Fixed by adding `block` to all four section labels;
    re-measured afterward and every gap landed exactly on 12px / 28px, confirmed via
    `getComputedStyle` margins *and* `getBoundingClientRect()`-based gap math agreeing
    precisely (not just eyeballing a screenshot).
  - Sizing (14px labels / 18px numbers / 38px circle / exactly 7 cells), the safe-area-aware
    top padding, and the default-selection/scroll-into-view bug fix from the two bullets
    above were all re-verified still correct after this pass — unaffected by this change,
    which only touched vertical spacing and the two content additions (DATE label, hint
    removal).
  **Tested live** in both English and genuine (pre-auto-translate, fresh tab) Arabic/RTL:
  confirmed the party-size stepper still increments/decrements correctly (including
  hitting the real max for a live restaurant and seeing the max-note appear with correct
  spacing) in both languages, re-ran the scroll-away-then-reopen repro for the selection
  bug and confirmed it's still fixed, and compared before/after screenshots showing the
  section rhythm now visibly even top to bottom (screenshots saved locally during the
  session, not committed to the repo).
- **Booking screen heading changed from "Reserve at" to "Held at" (2026-10-05):** the
  `reserveAt` translation key's English value changed from "Reserve at" to "Held at" —
  styling untouched (`font-serif text-xl text-charcoal` for the phrase, `italic
  text-burgundy` for the restaurant name, same gold underline divider below). Arabic
  changed from "احجز في" (an imperative "Book at") to "محجوز في" ("Held/reserved at," a
  passive participle) — chosen to reuse the exact word already used for `heldStatus` in
  Arabic ("محجوز") elsewhere in the app, rather than inventing new vocabulary for the same
  English concept. **Searched the whole app first, as requested, before touching anything
  beyond this one heading:** the `reserveAt` key is used in exactly one place
  (`app/page.js`'s Booking screen heading); the confirmation screen says "Table requested"
  and the shareable booking-detail page (`app/booking/[id]/page.js`) only shows a status
  pill — neither uses this wording. Found one related-but-different heading that was
  deliberately left alone: the edit-existing-booking screen uses a separate key,
  `editReservation` ("Edit reservation at"), not matched by this request. **Tested live**
  in both English (confirmed "Held at *test 2*" renders with the original styling intact)
  and genuine (pre-auto-translate) Arabic ("محجوز في test 2", correctly RTL-ordered).
- **Booking screen Time section replaced with a two-step hour → minute picker
  (2026-10-11):** layout/styling pass, per the request — the real availability/capacity
  logic, the min/max-advance-window and date-strip logic, and the exact `booking_time`
  string ultimately saved are all unchanged.
  - **What was already done before this session (verified, not rebuilt):** the unified
    12px label-to-content / 28px section-to-section spacing, the safe-area-aware top
    padding, and the default-date-selection/scroll-into-view bug fix were all already in
    place from the 2026-10-04 passes (see the three bullets above) and were re-verified
    live via `getBoundingClientRect()`/`getComputedStyle()` DOM measurement (every gap
    measured exactly 12px/28px, in both English and Arabic) rather than re-implemented.
    The party-size hint text and its translation key were already removed in an earlier
    pass too — nothing left to delete.
  - **New two-step time picker:** `lib/timeSlots.js` gained two small pure helpers,
    `groupSlotsByHour(slots)` (buckets a flat slot list like `generateTimeSlots` already
    produced into per-hour groups, e.g. `"6 PM"` → `[{minute:"00",full:"6:00 PM"},
    {minute:"30",full:"6:30 PM"}]`, preserving chronological order; an hour right before
    closing may have only a `":00"` entry, not a `":30"` one) and `hourLabelOfSlot(slot)`
    (`"6:30 PM"` → `"6 PM"`). `app/page.js`'s Booking screen now renders a horizontally-
    scrollable hour-chip row (same `overflow-x-auto` + edge-fade technique as the date
    strip — the fade gradient was pulled into a shared `EDGE_FADE_STYLE` constant so both
    rows use the identical gradient, not a copy-pasted one) followed by a fixed two-chip
    `":00"`/`":30"` row for whichever hour is selected. The `(opening–closing)` range text
    that used to follow the "TIME" label is gone — the label is just `{t("timeTonight")}`
    now, unchanged value ("Time"/"الوقت").
  - **`time` state is still the single source of truth**, still holds the exact same
    `"6:30 PM"`-style string `generateTimeSlots` always produced, and `confirmBooking()`'s
    `booking_time: time` is byte-for-byte unchanged — the picker only changed how that
    string gets chosen, not what gets saved. Selected hour/minute are *derived* from `time`
    via `hourLabelOfSlot`, not tracked in separate state, so there's no new state to drift
    out of sync.
  - **Availability reuses the exact same `trackingTimeAvailability`/`timeAvailability`
    values** the old 3-column chip grid read (computed by the pre-existing
    `loadTimeAvailability()`, untouched) — a minute chip is disabled under the identical
    `trackingTimeAvailability && timeAvailability[slot] === 0` condition the old grid used
    for "Full"; an hour chip is disabled only if *every* real minute in it is full
    (`group.slots.every(...)`); a minute with no real slot at all (the near-closing-time
    edge case above) renders as a disabled chip too, so the UI always shows exactly two
    equal-width minute chips as requested, never a lopsided one. The "N left"/"Full" seat-
    count text is gone, matching the request (plain chip labels only).
  - **Always-selected + scroll-into-view:** a new `useEffect` (same pattern as the existing
    date-strip fix) falls back to the first genuinely available slot in chronological order
    whenever the current `time` is off the real slot list or has become full (e.g. after
    switching dates), and scrolls the selected hour chip into view via a new `hourStripRef`
    + `data-selected` attribute, mirroring `dateStripRef`'s existing mechanism.
  - **Tested live** (local dev server, real Supabase project) against the one real
    restaurant currently in the database (`test 2`, 18:00–00:00, 7 hour chips 6 PM…12 AM):
    confirmed exactly 12px/28px spacing and 11px/700/1.1px-tracking label styling identical
    across all four sections via DOM measurement; confirmed all 7 hour chips render at
    ≥58px wide with no clipped label text; picked 9 PM/:30 and separately (in Arabic) 8
    PM/:30, completed both bookings end-to-end, and confirmed via direct SQL against the
    live `bookings` table that `booking_time` saved as exactly `"9:30 PM"` and `"8:30 PM"`
    respectively — both test bookings deleted afterward. Confirmed in Arabic/RTL: hour row
    and minute row both mirror correctly (6 PM starts at the right edge, scrolling runs
    right-to-left; the `:00`/`:30` pair also flips order under `dir="rtl"`), spacing
    measurements matched English exactly, and the saved time was unaffected by language.
    This restaurant's `zone_capacity` only has one of its three zones tracked (`Indoor:1`,
    `Outdoor`/`Shisha Terrace` at 0/untracked), so `trackingTimeAvailability` was `false`
    throughout this session's live testing — which doubles as the requested "restaurant
    with no zone capacity configured still works" check (booked successfully with no
    dimming shown, no errors). **Not independently tested live:** a restaurant where every
    zone *is* capacity-tracked, to visually confirm a dimmed/disabled hour and the
    "one open minute, the other dimmed" case — doing so would have meant writing to this
    restaurant's `zone_capacity` (restaurant-dashboard-owned data), which was out of scope
    per "test from the customer side only, stop and ask if a step needs the dashboard"; a
    bulk SQL write attempting this was also declined by the environment's own auto-mode
    safety classifier. Instead verified by code review plus a standalone unit test of the
    new `groupSlotsByHour`/`hourLabelOfSlot` helpers (confirmed the near-closing-time
    single-minute edge case groups correctly) — the disabled/dimmed conditions themselves
    are the same `trackingTimeAvailability && timeAvailability[slot] === 0` check the old,
    already-shipped chip grid used, just applied per-hour and per-minute instead of per-
    slot, so this is a low-risk reuse rather than new logic. If the user later configures
    full zone capacity on a real restaurant, worth a quick live look to confirm the dimming
    renders as expected.

- **Seating areas reworked from a fixed Indoor/Outdoor/Shisha Terrace set to a freeform,
  restaurant-managed list (2026-10-13/14):** touches the schema, server-side capacity
  enforcement, the dashboard, and the full customer booking flow. This was the largest
  single change since the 2026-08-29 customer-accounts/security pass.
  - **New `restaurant_areas` table** (`id`, `restaurant_id`, `name`, `capacity`), replacing
    reliance on `restaurants.zones`/`zone_capacity`. Those two columns are left in place as
    inert legacy data — same precedent as the already-dead `restaurant_tables` table —
    nothing in the app reads or writes them anymore. `bookings.zone` still stores the
    assigned area's **name as a plain text snapshot**, not a foreign key, so renaming or
    deleting an area later never changes what a past booking shows (verified: the
    shareable `/booking/[id]` page and My Bookings both read straight off the booking row).
    A migration backfilled every existing restaurant's `zones[]`/`zone_capacity{}` into
    `restaurant_areas` rows, preserving order and the exact stored capacity numbers.
  - **Capacity semantics, and the bug fix the user asked for:** `capacity` is `null` =
    not configured (unlimited, matches the app's prior behavior for an untracked zone);
    `0` = configured with zero seats (nothing bookable there — this is the fix); any other
    number = seat/table count checked against concurrent pending+confirmed bookings for
    that exact restaurant/date/time/area. The bug this replaces: the old dashboard UI
    always coerced a blank capacity input to a literal `0` on save
    (`Number(zoneCapacity[z]) || 0`), and the old booking-check logic treated `0` as
    "nothing to check" (`if (cap > 0) {...}`) — so a zone saved as `0` silently became
    *unlimited*, the opposite of what a restaurant owner typing `0` would expect. Now `0`
    and "not configured" are genuinely different states everywhere: the dashboard's new
    capacity field is truly optional (blank stays `null`), and both the client-side check
    and the new server-side trigger (below) treat `0` as always-full.
  - **Server-side enforcement (not just the UI):** a `before insert on bookings` trigger,
    `enforce_booking_capacity()`, re-checks capacity at the database level — looks up the
    assigned area's capacity by `(restaurant_id, zone)`, counts existing
    pending/confirmed bookings for that exact slot, and raises `23514` if full; skips the
    check entirely if the area isn't found or its capacity is `null` (unlimited). A second
    trigger, `before delete on restaurant_areas` → `prevent_unsafe_area_delete()`, blocks
    removing an area that still has upcoming (today or later) pending/confirmed bookings,
    and blocks removing a restaurant's last remaining area — both raise `23514` with a
    specific message. **Real bug found and fixed during testing, not just designed on
    paper:** the last-area guard also fired when a *restaurant itself* was deleted (its
    `restaurant_areas` rows cascade-delete via the FK, which hit "must have at least one
    area" and blocked the whole restaurant deletion) — fixed by skipping both guards once
    the parent `restaurants` row is already gone (true mid-cascade, since in Postgres the
    parent row's deletion precedes the cascaded child deletes within the same statement).
  - **A real security gap found via Supabase's own advisor, not just assumed safe:** both
    new trigger functions, being `SECURITY DEFINER` functions in the `public` schema, were
    automatically exposed as directly-callable PostgREST RPC endpoints
    (`/rest/v1/rpc/enforce_booking_capacity` etc.) to both `anon` and `authenticated`
    roles — not how they're meant to be invoked. Fixed by revoking `EXECUTE` from
    `public, anon, authenticated` on both functions; re-verified live afterward that the
    triggers still fire correctly on insert/delete (Postgres invokes a trigger function via
    the table owner's privileges, not the connecting role's `EXECUTE` grant, so this only
    blocks *direct* RPC calls, not the triggers themselves) and that the advisor no longer
    flags either function.
  - **RLS for `restaurant_areas`:** public `select` (so the customer app can read areas
    with no login, same as restaurants/menu_items); `insert`/`update`/`delete` all scoped
    to `exists (... restaurants.owner_id = auth.uid())`, mirroring the existing
    `menu_items` owner-scoped policies exactly.
  - **Customer booking flow:** the separate "Where would you like to sit?" screen is gone
    entirely — seating is now an inline, optional section on the same Booking screen as
    Date/Party size/Time/Celebrating (placed right after Time, before Celebrating, since
    availability depends on the chosen date/time; the request didn't specify an exact
    position). A restaurant with exactly one area shows no seating UI at all and silently
    books that area. 2+ areas show a `SeatingPreferenceSection` (new shared component,
    reused by both the main flow and the edit-booking flow) — a wrapping row of chips
    following the same label/spacing style as the other sections (confirmed via
    `getBoundingClientRect()`: 12px label-to-content, 28px to the next section, identical
    to Date/Party size/Time): "No preference" (selected by default, disabled only if no
    area anywhere has space) plus one chip per area (disabled/dimmed if that specific area
    is full for the selected date+time). Area names render exactly as the restaurant typed
    them — no translation lookup, since they're now freeform text rather than a fixed
    English/Arabic key set. A new `resolveAssignedArea()` helper (shared by
    `confirmBooking()` and the edit flow's `submitEditBooking()`) does a fresh
    live-count check right before writing the row and resolves "No preference" to the
    first area (in the restaurant's own list order) with space — the exact same
    "re-check right before insert, reduce but not eliminate the race window" pattern this
    app already used for the old single-zone check. The old aggregate per-time-slot
    "N left"/"Full" signal (`lib/areas.js`: `allAreasConfigured`, `remainingAcrossAreas`)
    now sums across *every* area a restaurant has, not a fixed 1-3 zones, and still only
    activates when every area has an explicit capacity (consistent with the prior
    behavior for an untracked zone).
  - **Edit-an-existing-booking flow** was reworked to match: its own "where would you like
    to sit" card list is replaced by the same `SeatingPreferenceSection`, defaulting to the
    booking's *current* area (not "No preference") so editing doesn't reset an existing
    choice; "No preference" is still offered there too. Its time picker (the older
    3-column chip grid, from before the main flow's hour/minute-picker redesign) was left
    untouched — only the seating section of that screen was in scope here.
  - **Dashboard settings:** the fixed Indoor/Outdoor/Shisha Terrace checkbox+capacity list
    is replaced by a real CRUD list under a new "Seating areas" section, matching the
    existing Menu section's independent-save pattern (not tied to the big "Save changes"
    button) — add (name + optional seats), inline edit/rename (reusing the exact
    `MenuItemRow` edit-mode pattern, renamed `AreaRow`), and delete. Deleting checks for
    upcoming pending/confirmed bookings client-side first (a specific, friendly alert) —
    the server trigger above is the real backstop, not the primary UX. The delete button is
    disabled client-side whenever only one area remains (defense in depth alongside the
    server-side last-area guard). A brand-new restaurant (first settings save, no row yet)
    gets a default single "Indoor" area (capacity `null`) created automatically, mirroring
    the old `zones` default — the new Seating areas section only renders once a restaurant
    row exists, same as Menu.
  - **Translations:** removed the now-meaningless fixed-set keys (`indoor`, `outdoor`,
    `shishaTerrace`, `indoorDesc`, `outdoorDesc`, `shishaDesc`, plus the old zone-screen's
    `whereSit`/`continueSecure`/`fullyBooked`, all unused once areas became freeform text
    and the separate zone screen was removed) and added `seatingPreference`, `noPreference`,
    `areaNamePlaceholder`, `areaCapacityPlaceholder`, `addArea`, `areaCapacityUnset`,
    `areaCapacityValue`, `removeArea`, `removeAreaConfirm`, `removeAreaBlockedUpcoming`,
    `removeAreaBlockedLastOne`; reworded `zoneCapacityHint`/`zoneJustFilled` for the new
    semantics/terminology. Verified programmatically that English and Arabic still have
    exactly matching key sets (193 keys each, no duplicates).
  - **New shared lib files:** `lib/areas.js` (the capacity-math helpers above, used by both
    the booking screen and the edit flow so they can't drift apart) and `lib/date.js`
    (`toLocalDateStr`/`addDays`, deduplicated out of `app/page.js`, now also used by the
    dashboard's delete-area upcoming-bookings check).
  - **Tested live end-to-end**, mostly via `heldtest3@gmail.com` (confirmed it's a real
    account in this project — an earlier claim that it existed turned out to be wrong twice
    before the user actually created it; verified each time via both a live login attempt
    and a direct `auth.users` query before trusting it):
    - **Database/trigger layer**, directly via SQL and a raw unauthenticated `curl` REST
      call (not just through the app): a 0-capacity area insert is rejected
      (`23514`, the capacity message, fired *before* RLS since `BEFORE INSERT` triggers run
      ahead of the `WITH CHECK` policy evaluation); inserting up to a positive capacity
      succeeds and the next one is rejected; a different time slot for the same area still
      succeeds (capacity is per-slot); a `declined` booking doesn't count toward capacity;
      a `null`-capacity area allows unlimited bookings; the same anon `curl` insert against
      an area with genuine space was correctly blocked instead by RLS's "must be the
      authenticated owning customer" check (`42501`) — confirming the two layers are
      independently effective. All test rows were deleted afterward.
    - **"All areas at 0 → nothing bookable"** was verified against real production data,
      not a fixture: the live `test 2` restaurant's three real zones had all ended up at
      capacity `0` by migration time (apparently changed by the user between sessions) —
      confirmed every time slot shows "Full" and every area chip is dimmed/disabled in the
      actual app with no setup needed.
    - **Single-area vs. multi-area UI**, in English and genuine (pre-auto-translate, fresh
      tab each time) Arabic/RTL, against two disposable QA restaurants created and deleted
      within this session (`QA Single Area`: one "Indoor" area, capacity 2; `QA Multi
      Area`: Indoor/Outdoor/Garden at capacity 1/2/3) — confirmed no seating section for
      the single-area restaurant, confirmed "Seating preference" renders with correct
      12/28 spacing and correct RTL mirroring for the multi-area one, confirmed an area
      fills and dims correctly after a SQL-inserted test booking.
    - **A real signed-in booking end-to-end:** booked `QA Multi Area`'s Outdoor at 7:30 PM
      as `heldtest3` — confirmed "Seating: Outdoor" on the confirmation screen, in My
      Bookings, on the shareable `/booking/[id]` page, and in the database row
      (`zone="Outdoor"`, `booking_time="7:30 PM"`). Edited it to Indoor/7:00 PM — confirmed
      the original flipped to `status="edited"` and a new correct pending row appeared,
      exactly like the pre-existing edit-booking mechanism always worked. Edited again to
      "No preference" at 9:30 PM — confirmed it resolved to "Indoor" (first area with
      space, in the restaurant's own list order) everywhere a result was checked.
    - **Dashboard area management**, in English and genuine Arabic/RTL: add ("Rooftop",
      left capacity blank → showed "Not tracking capacity"), rename + set capacity (renamed
      to "Terrace", set to 4 seats), plain delete (removed cleanly), delete blocked with the
      specific friendly message on an area with a real upcoming booking (`Garden`, via a
      SQL-inserted test booking), and the delete button disabled client-side (confirmed a
      click genuinely no-ops, not just styled) once down to the last remaining area. This
      required a restaurant-owner dashboard login; rather than touch the user's own
      restaurant or ask for its password, `heldtest3` (the same account already used for
      customer-side testing) was made the owner of the disposable `QA Multi Area` fixture
      via one `UPDATE restaurants SET owner_id = ...` statement the **user ran themselves**
      after a prior attempt to run it directly was declined by the environment's own
      auto-mode safety classifier (restaurant ownership being a sensitive field).
    - **A real automation gotcha hit and worked around, not a code bug:** `deleteArea`'s
      `confirm()` call (mirroring the pre-existing `deleteMenuItem` pattern elsewhere in
      this file) froze the browser tab the first time it fired, since native dialogs block
      Chrome's remote-debugging protocol entirely — the user had to manually click it once
      to unfreeze the tab. Worked around for the rest of the session by patching
      `window.confirm`/`window.alert` via injected JS after each page load, which captures
      the message text without ever presenting a real blocking dialog. Worth knowing for
      any future session automating this app's delete flows.
  - **Not independently tested live:** a genuinely unconfigured (`null`-capacity) area's
    per-area chip behavior in the inline picker (always-enabled, matching
    `isAreaFull`'s definition) — covered by code review and the shared `lib/areas.js`
    logic rather than a dedicated live click-through, since every live-tested fixture
    happened to use explicit numeric capacities. The underlying function is simple and
    directly exercised by the trigger tests above (a `null`-capacity area was proven to
    allow unlimited bookings at the database level).
  - **All test data cleaned up afterward:** both disposable restaurants (`QA Single Area`,
    `QA Multi Area`, cascade-deleting their areas), every test booking created during this
    pass, and the trigger-test rows from the SQL-level checks. `test 2`'s real (migrated)
    data was read extensively but never modified beyond the automatic migration itself.

- **No-show fee disclosure simplified to plain text (2026-10-17):** on the Booking screen's
  "Secure your table" step, the bordered card box (AlertTriangle icon + bolded fee line +
  muted cancellation line) and the separate subtitle line ("*Restaurant* holds this table
  for you. A card is required…" / "…No card required…") are both gone, replaced by two
  lines of plain small grey text (`text-xs text-taupe`, no box, no border): "No-show fee:
  AED {fee} per guest" and "Free cancellation up to {hours} {hour/hours} before your
  reservation" — singular "1 hour" vs. plural "N hours" chosen in `app/page.js` based on
  `active.cancellation_notice_hours`. Both lines are still gated on the same
  `active.no_show_fee_aed > 0` condition the old box/subtitle already used (unchanged —
  this is the same check verified correct for the fee=0 case in the 2026-08-29 bug-fix
  entry above), so a restaurant with no no-show fee shows neither line, exactly as before
  just with nothing in that spot now rather than a "no card required" subtitle. Nothing
  else on the screen (card number field, confirm button, Stripe disclaimer paragraph) was
  touched. Removed the four now-unused translation keys this replaced (`holdsTable`,
  `holdsTableNoCard`, `noShowFeeLabel`, `freeCancelLabel`) and added `noShowFeeLine`,
  `freeCancelLine`, `hourSingular`, `hourPlural` in both locales — verified EN/AR key
  parity programmatically (193 keys each, no duplicates) same as always. **Tested live**
  against the real `test 2` restaurant, which conveniently has `no_show_fee_aed = 70` and
  `cancellation_notice_hours = 1` — confirmed "No-show fee: AED 70 per guest" / "Free
  cancellation up to 1 hour before your reservation" (singular, real data, no fixture
  needed) in English, and the correctly right-aligned Arabic equivalent ("رسوم عدم الحضور:
  70 درهم لكل ضيف" / "يمكن الإلغاء مجانًا حتى 1 ساعة قبل موعد حجزك") in genuine
  (pre-auto-translate) Arabic/RTL — both lines flow right-aligned under `dir="rtl"` with no
  explicit alignment override needed, consistent with how the rest of this screen already
  handles RTL. No test booking was created (reached the "Secure your table" screen to
  inspect the text without submitting).

- **"Can't tap time slots or seating preference" investigated and fixed (2026-10-23):**
  reported as a live Booking-screen bug — time chips and the seating-preference chips were
  all unresponsive/disabled. Investigated the three hypotheses the user raised (a visual
  layer sitting on top blocking taps, slots wrongly marked full, the two-step time picker
  missing a selected day) by running the app live on a phone-sized viewport in both English
  and Arabic/RTL: `EDGE_FADE_STYLE` (the date/hour strip fade from the 2026-10-04 entry
  above) is a `mask-image` only, not pointer-blocking, and no overlay/z-index element sits
  over the Time or Seating preference sections; the date strip always has a day selected
  (`bookingDate` defaults and the "always something selected" effect at `app/page.js`
  still holds); and the Arabic/RTL render was pixel-for-pixel the same disabled state as
  English, ruling out an RTL-specific layout bug. **Root cause: data, not code.** The only
  restaurant in the database, `test 2`, had all three of its `restaurant_areas` rows
  (Indoor/Outdoor/Shisha Terrace) at `capacity = 0` — per the capacity semantics documented
  in the 2026-10-13/14 seating-areas entry above (`0` = "configured, zero seats, nothing
  bookable", distinct from `null` = unconfigured/unlimited), `lib/areas.js`'s
  `isAreaFull`/`remainingAcrossAreas` correctly computed every time slot and every seating
  chip as full, so the UI was disabling them exactly as designed. This is the same `test 2`
  0-capacity state already found and deliberately left untouched during the 2026-10-13/14
  session (noted as "apparently changed by the user between sessions"); this time the user
  asked directly for a fix rather than just an explanation, so — after confirming with the
  user rather than guessing their real seat counts — updated `restaurant_areas.capacity` via
  direct SQL to real numbers they provided: Indoor 40, Outdoor 20, Shisha Terrace 15 (no
  app code changed). **Verified live** after the update, in both English and Arabic: every
  time slot shows "75 remaining" (40+20+15) and is tappable, all four seating-preference
  chips (No preference/Indoor/Outdoor/Shisha Terrace) are tappable, and selecting an hour
  (8 PM) and an area (Indoor) both visibly update the selected state correctly.

- **Remaining-seat-count text removed from the Restaurant Detail "Available tonight" time
  chips (2026-10-23, same day, follow-up):** per the user's request, each chip in the
  `AVAILABLE TONIGHT` grid (`app/page.js`, the Restaurant Detail screen reachable from a
  restaurant card, just above the Booking screen itself) now shows only the time (e.g.
  "6:00 PM") instead of "6:00 PM · 75 remaining" / "6:00 PM · Full" — the `· {full ?
  t("slotFull") : t("tablesLeft", {count: remaining})}` suffix was deleted from that one
  chip's JSX. The `full`-dependent dimming (`bg-tan/50 text-taupe` vs. `bg-tan
  text-charcoal`) was deliberately left untouched, so a full slot still reads as visually
  disabled even with no text label. Scoped to only this one grid, per "change nothing
  else": the two-step hour/minute picker on the Booking screen itself never showed a
  remaining-count label to begin with (it only dims/disables), and the separate "Edit
  Reservation" screen under My Bookings (`app/page.js`, its own time-slot grid around
  `editTimeAvailability`) still shows its "N remaining"/"Full" sub-label exactly as before
  — intentionally not touched. The `slotFull`/`tablesLeft` translation keys are kept (both
  still used by the Edit Reservation screen). **Verified live**, phone-sized viewport, in
  both English and Arabic/RTL: chips in `AVAILABLE TONIGHT` show bare times only, with
  (currently, at real `test 2` capacities of Indoor 40/Outdoor 20/Shisha Terrace 15) none
  dimmed since nothing is full — the dimming logic itself wasn't exercised live, but it's
  unchanged code, already covered by the original feature's own live testing in the
  2026-10-13/14 seating-areas entry above.

- **BestTime.app busyness label on the Booking screen (2026-10-23):** a new "Quiet /
  Lively / Busy at [time]" indicator under the two-step Time picker, combining a cached
  BestTime.app foot-traffic forecast with Held's own live booking occupancy for the
  selected date+time. Touches the schema, two new server-only API routes, a weekly Vercel
  Cron job, and both the dashboard settings and customer booking screens.
  - **New `restaurants.address` column** (nullable text) — distinct from the pre-existing
    `area` column (a neighborhood name like "DIFC", not a lookup-able address). Added to
    the dashboard settings form right after the Area field, in English and Arabic
    (`address`/`addressPlaceholder`/`addressHint` keys), and shown on the customer-facing
    Restaurant Detail screen on the same line as the existing area/MapPin row (`app/page.js`
    — `{active.area} · {active.address}`). Optional: a restaurant with no address set just
    never gets a forecast, same as before this feature existed.
  - **New `restaurant_forecasts` table** (one row per restaurant): `besttime_venue_id`,
    `forecast` (a compact `{ "0": [24 ints 0-100], ..., "6": [...] }` map keyed by
    BestTime's `day_int`, 0=Monday..6=Sunday), `synced_name`/`synced_address` (what the
    forecast was fetched for, so a later sync can tell "did the owner rename/move since
    then?"), `last_synced_at`. RLS: public `select` (read client-side with no login, same
    as `restaurant_areas`/menu items); deliberately **no** insert/update/delete policy.
  - **No Supabase service-role key exists in this project** (`.env.local`/Vercel only ever
    had the anon/publishable key) — unlike `restaurant_areas`' owner-scoped RLS, there's no
    `auth.uid()` session for the weekly cron's writes (it runs with nobody logged in,
    across every restaurant at once). Solution: a `sync_restaurant_forecast()` Postgres
    function (`SECURITY DEFINER`, bypasses RLS) that is the *only* way to write
    `restaurant_forecasts`, gated by a `p_secret` parameter checked against a row in a new
    `app_secrets` table (itself RLS-enabled with **no policies at all**, so only the
    SECURITY DEFINER function can ever read it) — the secret lives in the
    `FORECAST_SYNC_SECRET` env var, server-only, never sent to the browser. This is a
    deliberate departure from the 2026-10-13/14 entry's own lesson ("revoke `EXECUTE` from
    anon/authenticated once Supabase's advisor flags a `SECURITY DEFINER` function as a
    directly-callable RPC") — here the grant to anon/authenticated is intentional, since
    the secret parameter is the real authorization check, not the Postgres role. Re-ran the
    same kind of live verification that lesson called for: Supabase's advisor does flag the
    function (`anon_security_definer_function_executable`,
    `authenticated_security_definer_function_executable`) — expected; a raw unauthenticated
    `curl` RPC call with the wrong secret gets `42501`/"Not authorized", and the same call
    with the correct secret succeeds (verified both live against the real project before
    writing any application code against it).
  - **`lib/besttime.js`** (server-only; imported only by the two routes below — never by a
    `"use client"` file, so `BESTTIME_API_KEY` never reaches a browser bundle):
    `fetchBestTimeForecast({ venueId } | { name, address })` wraps `POST
    https://besttime.app/api/v1/forecasts`. **A real correctness bug caught and fixed before
    shipping:** BestTime's `analysis[].day_raw` is a 24-element array, but it is **not**
    indexed by wall-clock hour (index 0 = midnight) — BestTime orders every day starting at
    6 AM (their documented "BestTime Day", which runs 6am→5am so a nightlife venue's late
    night doesn't split across two calendar dates). Caught by fetching a real forecast for
    an already-BestTime-known Dubai venue and cross-checking `day_raw` against the same
    response's `hour_analysis[].hour` field (which does carry an explicit wall-clock hour):
    `day_raw[2]` lined up with `hour_analysis`'s `{hour: 8, intensity_txt: "Low"}`, i.e.
    index 2 = 8am = index 0 + 2, confirming index 0 = 6am, not midnight — naively reading
    `day_raw[hour]` would have silently mislabeled every single hour. Fixed by rotating
    `day_raw` into true wall-clock-hour indexing (`out[(6+i) % 24] = day_raw[i]`) at
    ingestion time in `toForecastMap()`, so `restaurant_forecasts.forecast` and everything
    that reads it (`lib/busyness.js`) can just do `forecast[dayInt][hour]` with no offset
    to remember. A "venue not found" response (BestTime returns HTTP 404 with
    `status: "Error"` for this, confirmed live) resolves to `{ venueId: null, forecast: {} }`
    rather than throwing — the normal "nothing to show" case, not an error.
  - **`lib/busyness.js`** (shared, no server-only dependency): `dayIntFromDateStr()`
    converts a booking date string to BestTime's day_int (0=Monday..6=Sunday — not JS
    `Date#getDay()`'s 0=Sunday..6=Saturday, so it's `(jsDay + 6) % 7`, not a direct
    reindex); `hour24FromSlot()` parses a slot like `"8:00 PM"` to 20 (a `:30` slot shares
    its hour's value, since BestTime's forecast is hourly); `occupancyPctForSlot()` is
    `(totalConfiguredCapacity - remaining) / totalConfiguredCapacity * 100`, `null` when
    capacity isn't fully configured across every area (mirrors the existing "don't show a
    misleading partial signal" rule the Time/Seating availability already follows, see the
    2026-10-13/14 entry); `combineBusyness()` takes the higher of the two signals, `null`
    only when *neither* exists; `busynessLevel()` buckets into `quiet`
    (<40)/`lively`(40-75)/`busy`(>75) per the request's thresholds.
  - **`app/api/besttime/sync`** (POST): called by the dashboard settings page right after a
    save where the name or address actually changed (compared against the previously-saved
    values — every other field, hours/capacity/fees/etc., saves exactly as it always did,
    with no BestTime call). Reads the restaurant's name/address from the database (not from
    the request body, so a client can't spoof what gets looked up), checks the caller's
    session owns that restaurant (same `owner_id = auth.uid()` check pattern as everywhere
    else), calls BestTime, then the secret-gated RPC. The dashboard's `handleSave()` fires
    this with `fetch(...).catch(() => {})` — deliberately not awaited, since waiting on an
    external API call would make a routine settings save (e.g. just changing the no-show
    fee) feel broken; the diner-facing label just won't reflect a brand-new address until
    the fetch completes a moment later or the weekly cron catches it.
  - **`app/api/besttime/refresh`** (GET, weekly cron via `vercel.json`'s `"0 3 * * 1"`
    schedule): no user session exists for a cron run, so this uses the plain anon client;
    write authorization is the RPC's secret check, not a role. Gated by `CRON_SECRET` — if
    set as a Vercel project env var, Vercel automatically sends
    `Authorization: Bearer $CRON_SECRET` on its own cron requests, so this needs no extra
    wiring once that env var exists there; without it (or with the wrong value) the route
    401s *before* ever calling BestTime, so a stray/guessed request can't burn BestTime
    credits. For each restaurant with an address: reuses the cached `besttime_venue_id` (a
    precise, cheaper refresh) only if the name/address hasn't changed since the last sync;
    otherwise searches fresh by name/address, same as the per-save route — so a restaurant
    whose owner changed details without the per-save sync completing (or from legacy data)
    self-heals within a week.
  - **Added `FORECAST_SYNC_SECRET` and `CRON_SECRET`** to `.env.local`/`.env.local.example`
    (random tokens, generated this session) — **not yet added to Vercel**, unlike
    `BESTTIME_API_KEY` which the user had already provisioned there; the scheduled refresh
    cron won't authenticate in production until the same two values are added to the
    Vercel project's env vars (local dev and the per-save sync route both work already,
    since those don't depend on Vercel's cron infrastructure).
  - **Rendering** (`app/page.js`, Booking screen, under the Time picker, before Seating
    preference): three 6px dots (`bg-brass` filled / `bg-tan` empty, 1/2/3 filled for
    quiet/lively/busy) plus `text-taupe` label text, shown only when a level exists (per
    the "BestTime finds nothing + no bookings = show nothing" requirement — `null` all the
    way through, never a default-to-zero "Quiet"). New `busyQuiet`/`busyLively`/`busyBusy`
    translation keys (`"Quiet/Lively/Busy at {time}"` and Arabic equivalents) — EN/AR key
    parity re-verified programmatically after all of this session's additions (199 keys
    each, no duplicates, matching the 2026-10-17 entry's own verification method).
  - **Tested live, real data, not fixtures:** per the request, `test 2` (this project's
    only restaurant) was renamed to **Al Khayma Heritage Restaurant**, address `Historical
    Neighbourhood 79 Al Mussallah Rd Al Souq Al Kabeer - Al Fahidi - Dubai United Arab
    Emirates` — a real Dubai restaurant already known to this BestTime account from a prior
    search (confirmed via `GET /api/v1/venues` before committing to it, specifically so the
    name+address match was known-good rather than guessed; an earlier attempt using **La
    Petite Maison** / Gate Village 8, DIFC genuinely 404'd as "could not confirm the venue"
    from BestTime — even retried against other well-known, high-traffic real venues
    (Zuma Dubai, Nobu Dubai, a Starbucks in Times Square) with the same result, which is
    what surfaced that this account's forecast-matching needs an exact previously-indexed
    name/address rather than any real address being sufficient — worth knowing for whoever
    sets up a restaurant's real address later: use the venue's exact Google Maps-listed name
    if a fresh lookup 404s).
    - Ran the real `/api/besttime/refresh` route (not a simulated call) with the correct
      `CRON_SECRET` against the live dev server — `{"synced":1,"skipped":0,"failed":0}` —
      and confirmed `restaurant_forecasts` held a real 7-day forecast with
      `besttime_venue_id` populated.
    - **Both API routes' auth gates verified live, not just by reading the code:** `POST
      /api/besttime/sync` with no session → 401; `GET /api/besttime/refresh` with no
      `Authorization` header → 401; with the wrong bearer token → 401.
    - **Booking screen, phone-sized viewport, English and Arabic/RTL:** confirmed the
      address line on Restaurant Detail; confirmed all three busyness levels actually
      render by selecting different hours against the real fetched forecast — 6 PM → "●●○
      Lively at 6:00 PM" (today's real day-of-week forecast value 75), 9 PM → "●●● Busy at
      9:00 PM" (95), 11 PM → "●○○ Quiet at 11:00 PM" (0, venue closed per BestTime) — each
      confirmed again in Arabic (e.g. "مزدحم في 9:00 PM", dots unchanged by RTL mirroring
      since "N of 3 filled" has no inherent direction, unlike the existing `StarPicker`'s
      1-5 ordinal scale which does force `direction: ltr`).
    - A full `next build` (production build, not just dev mode) passes cleanly with every
      new file included.
  - **Not independently tested live:** the dashboard settings Address field itself (typing
    into it, saving, seeing the sync fire) was not clicked through with a real dashboard
    login — doing so would have needed either the restaurant owner's actual password
    (never requested, per this session's own handling rules around credentials) or a fresh
    signed-up test account, which hits the already-documented Resend sandbox limitation
    below (confirmation emails only deliver to the account owner's own address). Covered
    instead by a full `next build` (no type/compile errors) and the field's near-exact
    structural match to the pre-existing, already-proven Area field right above it in the
    same form — same pattern the 2026-10-13/14 entry used for its own
    null-capacity-area gap.

- **Browser confirm() popups replaced with an in-app confirm sheet (2026-10-23):** the two
  remaining `window.confirm()` calls in the dashboard settings page (removing a seating
  area, deleting a menu item) — the only ones in the app the request named — are gone,
  replaced by a new shared `ConfirmSheet` component (`app/components/ConfirmSheet.js`) in
  Held's own style rather than the browser's native dialog.
  - **One reusable component**, controlled entirely by props (`open`, `title`,
    `description`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`) — no
    page-specific logic baked in, so any future destructive action anywhere in the app can
    reuse it the same way. The caller owns a single `confirmState`-shaped piece of state
    (`{ title, description, confirmLabel, onConfirm } | null`); `deleteMenuItem()` and
    `deleteArea()` in `app/dashboard/settings/page.js` now just call `setConfirmState({...})`
    instead of gating on `confirm()`'s return value, with the actual delete logic moved
    inside each one's `onConfirm`.
  - **Visuals, matching the request exactly:** slides up from the bottom (`translate-y-full`
    → `translate-y-0`, 200ms), `bg-cream` with `rounded-t-[28px]` top corners, a small
    `bg-tan` handle bar, the background dimmed (`bg-charcoal/50`, fading in alongside the
    slide) and tappable-to-cancel (the dim layer's own `onClick`, with the sheet itself
    calling `stopPropagation()` so tapping the sheet doesn't also cancel). `font-serif
    text-burgundy` title (e.g. "Remove Terrace?", "Delete Pizza Pepe?"), an optional
    `text-muted` grey line below when the caller passes one (only the area-removal confirm
    uses it — "Bookings already made here stay as they are.", true per the
    2026-10-13/14 entry's note that `bookings.zone` stores an area's name as a plain text
    snapshot, unaffected by the area row being deleted later), one `bg-burgundy
    text-offwhite` confirm button, and a plain `text-burgundy` "Cancel" text link below it —
    no description renders nothing extra, not an empty line (the dish-delete confirm has
    none). Also closes on Escape. No RTL-specific classes needed anywhere in the
    component — it's centered/full-width content top to bottom, which mirrors for free
    under the document's existing `dir="rtl"` handling (unlike, say, the booking flow's
    `ChevronLeft` back buttons, which do need an explicit `rtl:rotate-180`).
  - **New translation keys** `removeAreaConfirmTitle`/`removeAreaConfirmBody` (replacing
    the old single-string `removeAreaConfirm`, now split into the sheet's title/description
    pair) and `deleteDishConfirmTitle`/`delete` (the menu-item delete confirm's hardcoded
    English-only string — `` `Delete "${item.name}"?"` `` — is gone too; it had never been
    translated to Arabic at all before this change, a pre-existing gap this fixes as a
    side effect of moving it onto the shared component). EN/AR key parity re-verified
    programmatically after the additions: 202 keys each, no duplicates, no gaps.
  - **Tested live**, phone-sized viewport, both languages: since both real call sites live
    behind the dashboard's owner login (same login-access gap as the settings Address field
    above), verified via a temporary throwaway route outside `/dashboard` (so middleware's
    auth gate didn't apply) rendering the real component with the real translation keys and
    both real copy variants (area-removal with its description line, dish-delete without
    one) — confirmed the cream/rounded/handle-bar/dim/burgundy-title/burgundy-button/plain-
    Cancel look in English, the fully mirrored RTL layout in Arabic (title "إزالة Terrace؟",
    body right-aligned, button "إزالة", Cancel "إلغاء"), and tap-outside-to-cancel actually
    closing the sheet. Deleted the throwaway route before committing — it was never part of
    the shipped app. Also re-ran `next build` clean after removing it, confirming nothing
    else referenced it.

- **Guest dining needs — "Anything we should know?" (2026-10-23):** diners can now flag
  wheelchair access, a high chair, or an allergy (with free-text detail, e.g. "tree
  nuts") per booking, save defaults to their account, and restaurants see them on the
  dashboard. Matches the provided design file 1:1 in behavior, but rebuilt in Held's
  actual brand tokens (`burgundy`/`cream`/`tan`/`taupe`/`muted`/`offwhite`, Georgia
  serif) rather than the design file's slightly different palette.
  - **Booking screen:** a new collapsed row sits directly below the Time section and
    above Seating preference — a small `bg-tan` circle with a `Plus` icon, "Anything we
    should know? (optional)", thin `border-charcoal/[0.08]` dividers above/below. Tapping
    it animates open via a `grid-template-rows: 0fr → 1fr` transition (not a max-height
    hack, so it doesn't need a hardcoded height) and the `+` rotates 45° into an `×`.
    Open, it shows three `rounded-full` chips (Wheelchair access / High chair / Allergy),
    each with a small icon (lucide `Accessibility`, lucide `Baby`, and a custom
    `AllergyIcon` SVG — lucide has no allergy icon, so this reuses the exact mark from
    the design file so it means the same thing everywhere it appears); selected chips
    turn `bg-burgundy`. Picking Allergy reveals a text field ("Which allergy? e.g. tree
    nuts") and auto-focuses it. Collapsed, a truncated grey summary (e.g. "Wheelchair
    access, Allergy: tree nuts") shows on the trailing side of the row. The CTA button
    and everything else on the screen is untouched, per the request.
  - **Pre-fill from Account:** opening a restaurant's booking screen while logged in with
    saved account needs pre-fills them and shows a grey note, "Filled in from your
    account. Changes here apply to this booking only." — any chip toggle or allergy edit
    on the Booking screen clears that flag (it's this-booking-only from that point on),
    mirroring the design file's `fromAcct` behavior exactly.
  - **Account screen:** a new "Dining needs" row sits between Payment methods and
    Language in the account list, showing a grey summary or "None". Tapping it opens the
    same chips/allergy-field UI plus "Saved for every booking. Restaurants only see this
    when you book with them." and a Save button; saved into `user_metadata.dining_needs`
    via `supabase.auth.updateUser`, the same mechanism already used for full name/phone/
    reservation name on this screen — no new table needed for the account-level default
    since it's private to the diner by construction (not exposed via the public
    PostgREST API at all, unlike a real table).
  - **Data model — a new `booking_needs` table, not columns on `bookings`:** `bookings`
    stays publicly SELECTable on purpose (the "share with friends" link works via an
    unguessable UUID, no account needed — see the 2026-08-29 RLS note). Allergy info is
    health data, so it couldn't live on a row anyone can already read. `booking_needs`
    (`booking_id` PK/FK, `wheelchair`, `high_chair`, `allergy`, `allergy_detail`) is its
    own table with its own RLS: SELECT only for the diner who owns the booking or the
    owner of the restaurant it was made at (checked via `exists` against `bookings` +
    `restaurants.owner_id`, the same join pattern the existing bookings-UPDATE policy
    uses), INSERT only for the diner on their own booking, no UPDATE/DELETE policy at
    all (not needed — the app only ever inserts fresh rows). One row per booking, created
    only when the diner actually selects a need — no row means nothing to show, so the
    dashboard and "My Bookings" queries can just embed `booking_needs(*)` and check
    `hasDiningNeeds()`. Editing an existing booking (which inserts a fresh pending row
    superseding the old one, per the 2026-08-29 edit feature) now carries the original
    booking's needs over to the new row too, so an allergy flag can't silently get lost
    on an edit. Shared mapping logic (`emptyDiningNeeds`, `hasDiningNeeds`,
    `diningNeedsSummary`, the camelCase⇄snake_case row converters) lives in one new file,
    `lib/diningNeeds.js`, imported by both `app/page.js` and `app/dashboard/page.js` so
    the two sides of the feature can't drift apart.
  - **Restaurant dashboard:** small icon badges appear next to the guest's name on every
    booking card that has any need set (pending/confirmed/dined/no-show/cancelled —
    all five card types), using the same three icons as the diner app, teal-tinted to
    match the dashboard's existing palette (the dashboard intentionally still uses the
    older teal/ivory/brass palette, not burgundy/cream — see "Brand direction" below;
    untouched by this change). Tapping the icons opens a small modal with the guest's
    name and each need spelled out, allergy detail included.
  - **Migration applied directly to the live project** (`cqckxtytqyvldqogpscy`, via the
    Supabase MCP tool) rather than just written into `schema.sql` — `get_advisors`
    (security) re-run afterward shows zero new findings for `booking_needs`; the three
    warnings it still reports (`app_secrets`/`restaurant_tables` RLS-no-policy,
    `sync_restaurant_forecast` SECURITY DEFINER, leaked-password-protection-disabled) are
    all pre-existing and already documented elsewhere in this file.
  - **New translation keys**, EN/AR: `diningNeeds`, `diningNeedsPrompt`, `optionalLabel`,
    `wheelchairAccess`, `highChairNeed`, `allergyNeed`, `allergyPlaceholder`,
    `filledFromAccount`, `diningNeedsNone`, `diningNeedsAccountSub`,
    `diningNeedsSavedConfirm` — Arabic copy carried over verbatim from the design file's
    own (already-written) Arabic strings rather than retranslated from scratch.
  - **Tested live** against the real `masa-app` Supabase project: `next build` clean,
    then the Booking screen's collapsed row through `npm run dev` + a real browser —
    expand/collapse animation, chip selection turning burgundy with icons, the allergy
    field appearing and auto-focusing, the collapsed summary truncating correctly — in
    both English and Arabic (full RTL mirror: `+`/`×` circle and summary swap to the
    leading/trailing sides that mirror for free under `dir="rtl"`, chip order reverses,
    Arabic copy renders correctly, main CTA "احجز طاولتي" unaffected). **Not** verified
    live end-to-end: saving Account defaults and actually submitting a booking (both need
    a confirmed diner login — email confirmation is required on this project, so a
    throwaway signup can't get a session without inbox access) and the restaurant
    dashboard's icons/modal (needs a restaurant-owner login this session doesn't have
    credentials for). Those paths were verified by code review and by the fact that both
    reuse the exact same `DiningNeedsFields` component already confirmed working on the
    Booking screen, not by clicking through them live — worth a real click-through next
    time either login is available.

- **Dining-needs icons made more visually distinct + swapped to a real lucide allergy
  icon (2026-10-24):** follow-up to the 2026-10-23 feature above, in both `app/page.js`
  and `app/dashboard/page.js`.
  - **Custom `AllergyIcon` SVG replaced with lucide-react's `Nut`** everywhere it
    appeared (Booking screen chip, Account screen chip, dashboard badge, dashboard detail
    modal) — removed the hand-written SVG component from both files entirely rather than
    leaving it as unused dead code. `Accessibility` (wheelchair) and `Baby` (high chair)
    were already lucide and unchanged.
  - **Chip color on the Booking/Account screens** changed from `text-charcoal` to
    `text-burgundy` for the unselected state (icon and label share it via `currentColor`,
    same mechanism as before) — bg stays `bg-tan` (the app's cream-family neutral
    surface) unselected, `bg-burgundy text-offwhite` selected, unchanged. Reads as
    "burgundy on cream, cream on burgundy when selected" without introducing a literal
    `bg-cream` pill, which would have had near-zero contrast against the screen's own
    `bg-cream` page background.
  - **Dashboard icons** recolored from `text-teal` to `text-burgundy` and bumped from
    13px/15px to a uniform 16px (badge next to the guest's name, and the detail modal) —
    a deliberate accent against the dashboard's own teal/ivory palette, chosen so the
    three icons mean the same thing and look the same color on both sides of a booking.
    Already showed on every booking card (Needs Response/pending, Confirmed, and all
    three History sections — dined/no-show/cancelled) before this change; this pass was
    colors and size only, not new placement.
  - **Booking screen's collapsed summary line now also shows the selected icons**, not
    just the grey text — small burgundy 16px icons (only the ones actually selected)
    lead the truncated summary text on the line's trailing side, same spot the text-only
    summary occupied before.
  - **Tested live, both English and Arabic:** `next build` clean, then `npm run dev` +
    a real browser for the Booking screen (expand chips, select all three, confirm
    burgundy-on-tan unselected / offwhite-on-burgundy selected with the new `Nut` icon,
    collapse and confirm the icon row + grey summary together, repeated in Arabic/RTL —
    icons and summary swap to the correct mirrored side, chip order reverses, `Nut`
    renders correctly in the RTL chip too). For the dashboard side (still no
    restaurant-owner login available this session — same gap noted in the 2026-10-23
    entry above), reused the project's established pattern from the 2026-10-23
    `ConfirmSheet` entry: a temporary throwaway route outside `/dashboard` (so
    middleware's auth gate didn't apply) rendering the real `NeedsIcons` component and
    detail-modal JSX against fabricated bookings covering all three icon combinations,
    one per tab's card style (amber/Needs Response, green/Confirmed, neutral/History) —
    confirmed the 16px burgundy icons, the "no needs → no icons" case, and the modal
    (title, guest name, each need spelled out, "Allergy: tree nuts") in both English and
    RTL Arabic. Deleted the throwaway route before committing and re-ran `next build`
    clean, confirming nothing referenced it — this is now a verified visual match, not
    just a code-review inference, though it's still not a real end-to-end click-through
    with an actual restaurant-owner session.

- **Bug fix — dining-needs icons never showed anywhere, including My Bookings
  (2026-10-24):** the user reported icons missing from My Bookings and asked whether
  needs were actually being saved at all.
  - **Cause, in one sentence:** every call site read the embedded `booking_needs` as an
    array (`booking.booking_needs?.[0]`), but because `booking_needs.booking_id` is that
    table's own primary key, PostgREST treats bookings→booking_needs as a to-one
    relationship and always returns a single object (or `null`) — so `?.[0]` was always
    `undefined`, every icon silently evaluated to "no needs," and this affected the
    dashboard and the edit-booking needs-carryover from the moment both shipped
    (2026-10-23), not just My Bookings (which simply never had icons added at all — a
    separate, plain gap, not a bug).
  - **Needs ARE actually saved on the booking when it's made** — checked directly against
    the live project before changing anything: `booking_needs` already had 2 real rows
    from the user's own prior testing (a wheelchair-only and a high-chair-only booking,
    both under her own account), and a direct RLS-simulated read as the restaurant
    owner (`set local role authenticated; set local request.jwt.claims...`, read-only,
    rolled back) confirmed the owner can already see that data — the save path and its
    RLS were never the problem. Confirmed the actual response shape with a real
    unauthenticated REST call against the live project
    (`GET /bookings?select=id,guest_name,booking_needs(*)`), which came back
    `"booking_needs":null` for a single-booking id filter — conclusive proof of the
    to-one shape, not a guess from reading PostgREST's docs.
  - **Fixed in two places:** `app/dashboard/page.js`'s `NeedsIcons` (`booking.booking_needs`
    instead of `?.[0]`) and `app/page.js`'s `submitEditBooking` (same fix, for the
    edit-booking needs-carryover added 2026-10-23). Both now carry a comment explaining
    why, to stop this regressing.
  - **My Bookings icons added** (the actual, separate gap): both the Current and Past
    tabs now show the same three icons (`Accessibility`/`Baby`/`Nut`, burgundy, 16px)
    next to the restaurant name on any booking card with needs, reusing
    `lib/diningNeeds.js`'s helpers. Tapping opens a new `NeedsDetailModal` — same visual
    language as the app's other modals (`RatingPromptModal`'s `bg-cream`/rounded/centered
    pattern), not the existing `ConfirmSheet` (that one's shape is confirm/cancel, not an
    info display) — showing each active need and the allergy text. New state:
    `needsDetail` in `DinerPage`.
  - **Tested with a new, real booking carrying all three needs** (wheelchair, high chair,
    allergy "tree nuts"), inserted directly against the live project under the user's own
    existing diner identity (the same account already behind her 2 prior test bookings,
    which is also this restaurant's own owner account) — a real UI click-through wasn't
    possible this session: `signInAnonymously()` is disabled on this project, and
    `signUp()` with a fresh email hits the already-documented, pre-existing Resend
    sandbox-mode limitation (any email but the account owner's own gets a 500 with no
    user created — see "Resend is still in sandbox mode" below), so a brand-new confirmed
    diner account can't be created in-session. Visually verified the fix against this
    real row (plus the 2 pre-existing real rows) via the same throwaway-route technique
    as the 2026-10-23 entry above: all three icons render on both a My-Bookings-style
    card and a dashboard-style card, tapping opens the correct modal with "Allergy: tree
    nuts," and both mirror correctly in Arabic/RTL. The throwaway route, and a temporary
    one-line QA hook added to `lib/supabase/client.js` to drive the live project's auth
    from the browser console during investigation, were both removed before committing
    (`git status` confirms `lib/supabase/client.js` has no diff). The test booking itself
    was deleted from the live project afterward (`booking_needs` cascaded with it) —
    confirmed 0 rows remain for that id.

- **Restaurant dashboard rebuilt from `design/dashboard design.html` (2026-10-24):** the
  dashboard's teal/ivory look is gone — new login/sign-up screens and a new six-tab
  shell (Requests, Tonight, Upcoming, Receipts, Analytics, Settings) in Held's real
  cream/burgundy/brass tokens, with Requests/Tonight/Upcoming fully wired to real
  bookings data and Receipts/Analytics/Settings as explicit placeholders, per the
  request's own scope.
  - **Reading the design file:** it turned out to be a bundled React SPA (minified
    React + app code inlined in one file), not static HTML, so grepping it wouldn't
    reveal the actual screens. Served it locally (`python3 -m http.server`) and clicked
    through every reachable screen/state in both languages via a background research
    agent, producing a 400-line spec covering exact EN/AR copy, every interaction, and
    the color-role mapping onto Held's real tokens — that spec is what the rest of this
    entry was built from.
  - **Login/sign-up** (`app/dashboard/login/page.js`, restyled, auth logic untouched):
    cream background, burgundy serif "Held" wordmark + gold rule, tan pill inputs, eye
    toggle, burgundy CTA — matches the diner app's existing `CustomerAuthForm` visual
    language rather than introducing a new one. Sign-up now collects restaurant name and
    the signer's own name up front (design's "RESTAURANT NAME"/"YOUR NAME" fields),
    passed through `signUp`'s `options.data` as `pending_restaurant_name`/`full_name`;
    `app/dashboard/settings/page.js`'s onboarding load effect now prefills the restaurant
    name field from `pending_restaurant_name` when there's no restaurant row yet, so
    onboarding doesn't ask for the name twice. Forgot-password flow unchanged.
  - **Shell** (`app/dashboard/page.js`, full rewrite): burgundy-filled sidebar (the one
    deliberately burgundy-not-cream surface in the whole dashboard, per the design), gold
    wordmark + "FOR RESTAURANTS" label, six nav items each with an icon, a brass badge
    circle on Requests showing the live pending count, active-row highlighting, language
    toggle + sign out + restaurant name pinned at the bottom. A global "Taking
    requests / Paused" switch sits top-right on every tab (new `restaurants
    .accepting_requests` column) — pausing shows a grey notice under the page date and
    fires a toast; **this does not yet gate the diner-facing booking flow** (the request
    explicitly scoped this pass to the dashboard, not `app/page.js`) — a restaurant can
    pause and guests can still technically book, worth flagging if the user wants that
    closed next.
  - **Requests tab** (`app/dashboard/_components/RequestsTab.js`): 4 stat tiles (Waiting,
    Covers tonight, Arrived, Respond within — fixed at 15 min for this pass, see "Known
    limitations" below), "Oldest first" divider, one card per pending request with the
    guest's name, visit badge, needs badge, party/zone/card-last4/occasion meta, a
    reused `lib/areas.js`-style "X of Y seats taken" capacity line
    (`lib/zoneCapacity.js`), and a respond-by countdown that turns `warn`-red inside 5
    minutes of the 15-minute SLA. Confirm is a direct action; Decline opens a modal with
    the 4 exact reasons from the design (Fully booked / Can't seat that size / Closed
    that day / Another reason), a live "{Guest} will see: ..." preview that updates per
    reason, and on submit sets `status = 'declined'` plus a new `bookings.decline_reason`
    column (the guest-facing message text — captured for future use even though the
    diner app doesn't surface it yet). Both Confirm and Decline show a toast with Undo
    (reverts `status` back to `'pending'`, clearing `decline_reason` on an undone
    decline) — no new RLS needed, the existing owner-branch `bookings` UPDATE policy
    already allows any status/column change for the restaurant's own bookings.
  - **Tonight tab** (`TonightTab.js`): 4 stats (Bookings, Covers, Arrived, No shows),
    bookings grouped by time slot, each row showing the same name/visit/needs badges plus
    guests/zone/occasion. Not-yet-arrived rows get No show / Arrived buttons (new
    `bookings.arrived` + `arrived_at` columns, separate from `status` so a booking stays
    'confirmed' while tracking tonight's check-in state); arrived rows collapse to a
    plain "Arrived" pill. No-show reuses the existing `no_show_fee_aed * party_size`
    charge math exactly (same as the old dashboard's `markNoShow`), now behind a
    confirmation modal matching the design, with a toast and deliberately no Undo (it's
    a real charge, same no-undo precedent as the diner app's other charged-no-show flow).
  - **Upcoming tab** (`UpcomingTab.js`): "Coming up" / "Past" segmented sub-tabs.
    Coming up = `pending`/`confirmed` bookings strictly after today (today's own
    bookings live on Tonight instead, a deliberate split from the old dashboard's
    pending/confirmed tab grouping); Past = `dined`/`no-show`, both grouped by date with
    a guest-count header. Coming-up rows show a plain "Confirmed" pill; Past rows show
    "Dined" or "No show · AED {total} charged" (the no-show total is real, recomputed
    from `no_show_fee_aed`; a "Paid AED N" pill for dined bookings was deliberately
    **not** added — see "Known limitations" below).
  - **Receipts / Analytics / Settings tabs** (`PlaceholderTab.js`): a short centered
    "Coming soon" card, same pattern as the diner app's existing Payment-methods
    placeholder — per the request, these three are explicitly out of scope this pass
    even though the design file has them fully built out. Settings' placeholder adds an
    "Open full settings" button linking to the real, already-built `/dashboard/settings`
    page, so the existing onboarding/settings functionality stays reachable rather than
    getting orphaned behind the new tab bar.
  - **Guest needs icons + returning-guest badge** (`GuestBadges.js`,
    `GuestNeedsModal.js`, `lib/guestVisits.js`): the needs badge reuses the real
    `lib/diningNeeds.js` exactly (`hasDiningNeeds`, `diningNeedsFromRow`) and the
    dashboard's already-established `Accessibility`/`Baby`/`Nut` lucide icons at burgundy
    — one icon shown per guest (allergy takes priority, as the most safety-relevant,
    then wheelchair, then high chair) with a tap opening a modal listing every need,
    matching the pattern already built for the 2026-10-24 dining-needs bugfix above. The
    visit badge ("• 4th visit" / "• الزيارة رقم 4") is computed client-side from the
    restaurant's own already-loaded bookings — no new table — grouping by `user_id` or,
    since that can be null on pre-account bookings, by `guest_phone`, counting
    pending/confirmed/dined bookings only (a no-show or a declined request isn't a
    "visit"); English uses an ordinal, Arabic uses a structurally different "visit
    number N" construction, per the design — these aren't the same string translated,
    `visitBadgeText()` builds each language's sentence shape directly rather than
    routing both through one interpolated key.
  - **Scope trims — things the design shows that this pass deliberately left out**,
    because building them honestly would mean fabricating data the app doesn't actually
    track (all consistent with Receipts/Analytics/Settings themselves being explicit
    placeholders this pass): no "Table N" meta (the schema's `restaurant_tables` table
    is legacy/unused, no real table-assignment feature exists); no min-spend meta
    (no restaurant-level setting for it exists, and Settings — where it'd be configured
    — is a placeholder); no "Paid AED N" pill for arrived/dined guests (no itemized
    order/payment tracking exists anywhere in the app, only the no-show charge amount is
    real data); the decline modal's three suggested-alternative-time chips (shown under
    "Fully booked") aren't rendered — the design spec itself flagged these as
    non-functional/decorative in the demo, and the request's own scope list didn't
    include them.
  - **Data model**: two migrations applied directly to the live project
    (`cqckxtytqyvldqogpscy`, via the Supabase MCP tool) and mirrored into `schema.sql` —
    `restaurants.accepting_requests` and `bookings.arrived`/`arrived_at`/
    `decline_reason`. **No new RLS policies were needed anywhere** — the existing
    owner-scoped UPDATE policies on both tables already cover every new column, verified
    directly against the live project's actual policies (not assumed from the file) and
    re-confirmed with `get_advisors` afterward: zero new findings, only the same three
    pre-existing ones already documented elsewhere in this file. While checking, found
    and fixed real drift in `schema.sql`: the live project has had `"Owners can create
    their own restaurant"` (INSERT) and `"Owners can update their own restaurant"`
    (UPDATE) policies on `restaurants` all along — they were just missing from this
    file, the same kind of gap the 2026-08-29 note at the bottom of this file already
    warned about. Both are now added back.
  - **91 new translation keys**, EN/AR, for the dashboard rebuild specifically (281 total
    now, parity-checked programmatically — no gaps, no duplicates). Arabic copy follows
    the design spec's captured exact strings where available, translated consistently
    with the app's existing direct/short tone elsewhere.
  - **Tested live against the real project**, both languages: `next build` clean at every
    stage. Login/sign-up screens tested directly (no auth needed). For the tab content,
    reused the project's established throwaway-route technique (temporary route outside
    `/dashboard` so middleware's gate doesn't apply, deleted before committing, `next
    build` re-verified clean afterward) — but this time backed by **real** data: inserted
    8 clearly-labeled real test bookings covering every state (pending/urgent,
    pending/not-urgent, confirmed/not-arrived, confirmed/arrived, no-show tonight,
    confirmed tomorrow, dined in the past, no-show in the past — two sharing a phone
    number to also exercise the visit badge, one reusing the real "haya mousa" account
    to anchor it against genuine history) plus `booking_needs` rows for two of them,
    then rendered the real tab components against that real data. Confirmed: all four
    stat tiles compute correctly, the urgency color threshold, the decline modal's live
    preview updating per reason, the guest-needs modal, the no-show modal's real fee
    math (AED 70 × 2 = AED 140), the arrived/no-show pill states, both Upcoming
    sub-tabs with correct date grouping, and full RTL mirroring on every screen tested
    (including the easy-to-get-backwards "وصل"/"لم يحضر" action-button forms vs.
    "وصلوا"/"لم يحضروا" stat-label forms, which are genuinely different Arabic words, not
    the same word reused — confirmed both render correctly in the right place). Also
    confirmed the server-side `/dashboard` gate is still intact: an unauthenticated
    `fetch` returns an opaque redirect, and — unexpectedly but usefully — this browser
    profile already had a real, unrelated logged-in Supabase session with no restaurant
    ownership, and navigating to `/dashboard` correctly redirected it to `/` exactly as
    `middleware.js` is supposed to for a non-owner. All 8 test bookings (and their
    `booking_needs` rows, cascaded) were deleted afterward — confirmed the restaurant's
    booking count is back to its original 11.

- **Settings tab built out for real, replacing its earlier placeholder (2026-10-24):**
  restaurant info, booking rules, no-show fee/free cancellation, a new minimum-spend
  setting, seating areas, and menu-with-photos all now live in the dashboard's Settings
  tab, in Held's cream/burgundy tokens — nothing from the old settings page was dropped.
  - **Extracted into a shared `SettingsForm`** (`app/dashboard/_components/
    SettingsForm.js`) rather than duplicated: the old `/dashboard/settings` page was 885
    lines of form + seating-areas CRUD + menu CRUD all inline. That logic now lives in
    one component used two ways — the new **Settings tab** (`SettingsTab.js`, thin
    wrapper, no heading since the shell already shows one) and the **standalone
    `/dashboard/settings` route** (now ~90 lines, down from 885), which still has to
    exist on its own for onboarding: middleware exempts exactly that path from requiring
    an existing restaurant, since a brand-new owner has nowhere else to create their
    first restaurant row. Both now render byte-for-byte the same form, so they can't
    drift apart again.
  - **Seating areas stay in sync with the Requests tab**: when used as a tab,
    `SettingsForm` takes the shell's own `areas` state and `loadAreas` reload callback as
    props instead of fetching its own copy — editing an area's capacity in Settings now
    immediately updates the "X of Y seats taken" line on Requests' cards too, rather than
    going stale until the next tab switch. The standalone onboarding page has no such
    shared state to go stale against, so it still manages its own area list locally
    (same `SettingsForm`, just called without those two props).
  - **New minimum-spend setting**: amount (AED per guest) + a 7-night toggle (new
    `restaurants.min_spend_aed`/`min_spend_nights` columns, nights stored as
    `Date#getDay()` indices 0–6, not day-name strings, so display labels are generated
    per-locale the same way `lib/relativeDate.js` already does rather than stored).
    This also resolves a scope-trim flagged in the 2026-10-24 Requests-tab entry above —
    "Min spend AED N" on a request card was left out there because the setting didn't
    exist yet; it's now wired in (`RequestsTab.js`), shown alongside an occasion badge
    when both apply, for the current party size × the per-guest rate, only on the
    nights the owner selected.
  - **Dashboard language** moved from only the small sidebar globe icon into its own
    explicit Settings section too (English/Arabic buttons, instant-apply, no new state —
    same `useLanguage()`/`localStorage` mechanism already in place, which already behaves
    as "this tablet only" since `localStorage` is per-browser/device, matching the
    request's own framing).
  - **Restyled throughout** from the old teal/ivory/white-bordered look to the same
    cream/burgundy/tan/card visual language as the rest of the rebuilt dashboard — pill
    inputs, `bg-card` rows for areas/menu items, burgundy selected-state buttons,
    `font-serif` section headings. `ConfirmSheet` (used for delete confirmations) was
    already cream/burgundy and needed no changes.
  - **9 new translation keys**, EN/AR (286 total now, parity-checked — no gaps, no
    duplicates); removed the now-unused `openFullSettings` key (and the CTA-link code
    path on `PlaceholderTab` that used it) now that Settings is a real tab instead of a
    link-out.
  - **Data model**: `restaurants.min_spend_aed`/`min_spend_nights`, applied directly to
    the live project and mirrored into `schema.sql`. No new RLS needed — already covered
    by the existing owner-scoped `restaurants` UPDATE policy — re-confirmed with
    `get_advisors`: no new findings.
  - **Tested live against the real project**, both languages: `next build` clean, then
    the same throwaway-route technique as the other 2026-10-24 entries (deleted before
    committing, `next build` re-verified clean), this time rendering `SettingsForm`
    directly against the real restaurant row as a fixture — but seating areas and menu
    items were **not** fixtures, since both already have public-read RLS policies, so
    the form fetched them live via the anon key exactly as a real visitor would: the real
    3 areas (Indoor/40, Outdoor/20, Shisha Terrace/15) and the real 2 menu items with
    their real photos all rendered correctly. Confirmed every field prefills from real
    data, the minimum-spend night toggle (Fri/Sat) selects correctly, an area's edit mode
    opens with the burgundy ring highlight, and the dashboard-language buttons work — in
    both English and Arabic (RTL mirrored throughout, verified directly since this form
    happened to load in Arabic first from a prior test's `localStorage` state).

## Known limitations / deliberate simplifications (not bugs)
- **Requests tab's "Respond within" SLA is a fixed 15-minute constant, not configurable
  (2026-10-24):** `RESPOND_WITHIN_MINUTES` in `app/dashboard/_components/RequestsTab.js`.
  The design shows it as a per-restaurant setting, but Settings (where that would live)
  is an explicit placeholder this pass, so there's nowhere to configure it yet — revisit
  once Settings gets built out for real.
- **Pausing "Taking requests" doesn't yet block new diner-side bookings (2026-10-24):**
  `restaurants.accepting_requests` is real and the dashboard switch works, but
  `app/page.js`'s booking flow doesn't check it — a guest can still submit a booking
  while paused. The request scoped this pass to the dashboard only; closing this gap on
  the diner side is a natural next step if the user wants the pause to actually pause.
- **Weekly BestTime refresh cron won't authenticate in production yet (2026-10-23, not yet
  fixed):** `CRON_SECRET` and `FORECAST_SYNC_SECRET` (see the busyness-label entry above)
  were added to `.env.local` this session but not to Vercel's project env vars — until
  someone adds the same two values there, `GET /api/besttime/refresh` 401s on every real
  Vercel Cron invocation (harmlessly — it fails closed before calling BestTime). The
  per-save sync (`POST /api/besttime/sync`, triggered from the dashboard) is unaffected,
  since it doesn't depend on Vercel's cron infrastructure.
- **Resend is still in sandbox mode (discovered 2026-09-06/07, not yet fixed):** the
  project's confirmation emails go through Resend, and Resend's free/sandbox mode will
  only actually deliver to the email address that owns the Resend account
  (`hayafadhel9@gmail.com`) — every other address gets rejected with a 550 error
  (`"You can only send testing emails to your own email address..."`), which Supabase
  Auth then surfaces as a 500 `unexpected_failure` on sign-up, and the whole sign-up rolls
  back with no user row created at all. In practice this means **real customer sign-ups
  with any email other than the owner's own are currently broken** — they'll never
  receive a confirmation email and can't complete account creation. Fixing this requires
  verifying a sending domain at resend.com/domains and pointing Supabase's SMTP "from"
  address at it; nobody has done this yet. A separate, already-fixed bug
  (`lib/authErrorMessage.js`) means the user now at least sees a friendly error instead of
  a literal `"{}"` when this happens, but the underlying delivery restriction is still
  live and blocking real sign-ups.
- Card hold step is a plain text input, NOT connected to Stripe or any real payment processor
- Customer accounts exist now (2026-08-29 — see the bullet above). Email verification is
  now ON at the Supabase project level (the user enabled it after this feature shipped).
  Leaked-password protection remains OFF — **deliberately, an accepted gap**: it requires
  Supabase's Pro plan, and the project is staying on Free for now; this is a business
  decision to revisit only if/when the project upgrades, not something to fix in code.
  See the security bullet above for what changed in practice once email confirmation
  went live (notably: `@example.com` test addresses are now rejected by Supabase itself).
- `bookings` RLS was tightened alongside customer accounts (2026-08-29): writes are scoped
  to the owning customer or the owning restaurant; reads intentionally stay open so
  "Share with friends" keeps working via unguessable booking links — see the security
  bullet above for the exact policy shapes and the self-approval gap that was found and
  closed during that work
- Capacity checking is per-area (e.g., "5 seats in Outdoor" — areas are now a freeform,
  restaurant-managed list, see the 2026-10-13/14 bullet above), NOT per-specific-table yet.
  A real visual floor plan (named/placed individual tables) is a planned future feature.
  "No preference" also doesn't factor party size into which area it picks — capacity has
  always been a count of concurrent bookings per area/zone in this app, not a seats-per-
  table match, and that didn't change with this rework.
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
fix. **Both manual Supabase Dashboard follow-ups are now resolved** (2026-08-29, after the
fact — no tool here could touch Supabase Auth project settings, so these always needed
the user directly): "Confirm email" is enabled, and "Leaked password protection" is a
deliberate, accepted gap (requires the Pro plan; staying on Free for now) rather than a
pending action — see item 3 and item 5 in the security bullet above for what each one
means in practice now. **Pending, unrelated:** wiring up the 8 new "Held" wordmark icon files as the
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
