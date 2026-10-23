import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { fetchBestTimeForecast } from "../../../../lib/besttime";

// Called by the dashboard settings page right after a restaurant saves its
// name or address — looks that venue up on BestTime and caches the result
// in restaurant_forecasts. Runs server-side only (BESTTIME_API_KEY never
// reaches the browser); the client just tells us which restaurant to sync,
// nothing more.
export async function POST(request) {
  const { restaurant_id } = await request.json().catch(() => ({}));
  if (!restaurant_id) {
    return NextResponse.json({ error: "restaurant_id is required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Session refresh is already handled globally by middleware.js on
        // every request (including this one) — this route only reads the
        // session, it doesn't need to persist a refreshed one itself.
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, address, owner_id")
    .eq("id", restaurant_id)
    .single();

  // Same owner check as every owner-scoped write in this app (mirrors
  // restaurant_areas' RLS) — a signed-in diner or a different restaurant's
  // owner can't trigger a sync for a restaurant they don't own.
  if (!restaurant || restaurant.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!restaurant.address) {
    return NextResponse.json({ ok: true, skipped: "no_address" });
  }

  let venueId, forecast;
  try {
    ({ venueId, forecast } = await fetchBestTimeForecast({
      name: restaurant.name,
      address: restaurant.address,
    }));
  } catch {
    // Never leak the BestTime key or raw upstream error details.
    return NextResponse.json({ error: "BestTime lookup failed" }, { status: 502 });
  }

  const { error: rpcError } = await supabase.rpc("sync_restaurant_forecast", {
    p_restaurant_id: restaurant.id,
    p_venue_id: venueId,
    p_forecast: forecast,
    p_name: restaurant.name,
    p_address: restaurant.address,
    p_secret: process.env.FORECAST_SYNC_SECRET,
  });

  if (rpcError) {
    return NextResponse.json({ error: "Could not save forecast" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, found: !!venueId });
}
