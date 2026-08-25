# Held — Downtown/DIFC restaurant reservations

Two pages:
- `/` — diner-facing app: browse restaurants, view menu, book a table, card hold for no-shows
- `/dashboard` — restaurant partner dashboard: accept/decline bookings, mark no-shows

This is real, working code (not a demo) — connect it to a free Supabase project and it's live.

---

## 1. Create a Supabase project (free)

1. Go to https://supabase.com → sign up → **New project**
2. Once it's created, go to **SQL Editor** → **New query**
3. Paste in everything from `schema.sql` (in this folder) → click **Run**
   - This creates your `restaurants`, `bookings`, `menu_items`, and `restaurant_tables` tables
4. Go to **Project Settings → API** — copy:
   - **Project URL**
   - **anon public key**

## 2. Run it locally

```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```

## 3. Add your first restaurant (through the app, no manual SQL needed)

Visit `http://localhost:3000/dashboard/login`, click **"New restaurant? Create an account"**,
and sign up. This creates your restaurant record and drops you into Settings, where you
can fill in cuisine/area/price tier, booking hours, seating zones + table counts,
no-show fee, and cancellation policy — and add menu dishes (name, price, and a real
uploaded photo) directly from the same page.

Visit `http://localhost:3000` for the diner app, and `http://localhost:3000/dashboard` for the restaurant dashboard — open both side by side and test a real booking end to end.

## 4. Deploy for free

1. Push this project to a new GitHub repository
2. Go to https://vercel.com → **New Project** → import that GitHub repo
3. Under **Environment Variables**, add the same two keys from `.env.local`
4. Click **Deploy** — you'll get a live URL like `masa-app.vercel.app`

## What's real vs. what's next

**Already working:**
- Real database (not sample data) — restaurants and bookings persist
- Restaurant sign-up/login (Supabase Auth) — each partner only sees and edits their own restaurant
- Self-serve restaurant settings: hours, price tier, seating zones + per-zone table counts, no-show fee, cancellation window
- Menu management with real photo uploads (Supabase Storage) — no manual SQL required
- Diner booking flow end to end, including per-zone availability ("fully booked" checks)
- Restaurant dashboard updates live when a new booking comes in (Supabase realtime)
- No-show marking + platform fee calculation
- English/Arabic bilingual diner-facing app with RTL layout

**Still needs building, roughly in order** (see `PROJECT_STATUS.md` for the full, current backlog):
1. Visual floor plan builder (drag/place individual tables, live status)
2. "Mark as completed" for confirmed bookings after the reservation time passes
3. Edit an existing booking (time/zone/party size)
4. Bill-split calculator
5. Arabic translation for the dashboard/settings/login pages
6. Customer login (separate from restaurant login), replacing the current localStorage-based "My Bookings"
7. Real Stripe integration (currently the card field is a plain text input, not connected to any payment processor)
8. In-app notifications, then real SMS/WhatsApp alerts (currently silent — restaurant has to check the dashboard)
