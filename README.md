# Masa — Downtown/DIFC restaurant reservations

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

## 2. Add your first restaurant (manually, for now)

In Supabase, go to **Table Editor → restaurants → Insert row**, and add one, e.g.:

| name | cuisine | area | price_tier | no_show_fee_aed | subscription_status |
|---|---|---|---|---|---|
| Ember & Vine | Modern European | DIFC | $$$$ | 150 | trial |

Then go to **menu_items → Insert row** and add 2-3 dishes, using the `id` from the restaurant you just created as `restaurant_id`.

(Later, you'd build a proper "add restaurant" form instead of doing this by hand — good next feature once the core flow works.)

## 3. Run it locally

```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```

Visit `http://localhost:3000` for the diner app, and `http://localhost:3000/dashboard` for the restaurant dashboard — open both side by side and test a real booking end to end.

## 4. Deploy for free

1. Push this project to a new GitHub repository
2. Go to https://vercel.com → **New Project** → import that GitHub repo
3. Under **Environment Variables**, add the same two keys from `.env.local`
4. Click **Deploy** — you'll get a live URL like `masa-app.vercel.app`

## What's real vs. what's next

**Already working:**
- Real database (not sample data) — restaurants and bookings persist
- Diner booking flow end to end
- Restaurant dashboard updates live when a new booking comes in (Supabase realtime)
- No-show marking + platform fee calculation

**Still needs building, roughly in order:**
1. A proper "add your restaurant" onboarding form (currently manual via Supabase table editor)
2. Restaurant login (currently anyone can view/edit any restaurant's dashboard — fine for testing, not for real partners)
3. Real Stripe integration (currently the card field is a plain text input, not connected to any payment processor)
4. WhatsApp/SMS alerts when a booking comes in (currently silent — restaurant has to check the dashboard)
5. Trial countdown + "subscribe now" flow once a free trial ends
