import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchBestTimeForecast } from "../../../../lib/besttime";

// Weekly cron (see vercel.json) that refreshes every restaurant's BestTime
// forecast. Gated by CRON_SECRET — Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` on its own cron requests once that
// env var is set on the project; without it (or with the wrong value) this
// fails closed with 401 before ever calling BestTime, so a stray/guessed
// request can't burn BestTime credits. No user session exists here (nothing
// is "logged in" for a cron run), so this uses the plain anon client — the
// actual write authorization is sync_restaurant_forecast()'s own secret
// check, not a Postgres role or RLS policy (see schema.sql).
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, name, address, restaurant_forecasts(besttime_venue_id, synced_name, synced_address)")
    .not("address", "is", null);

  if (error) {
    return NextResponse.json({ error: "Could not load restaurants" }, { status: 500 });
  }

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of restaurants || []) {
    if (!r.address) {
      skipped++;
      continue;
    }
    const existing = Array.isArray(r.restaurant_forecasts)
      ? r.restaurant_forecasts[0]
      : r.restaurant_forecasts;
    // Name/address unchanged since the last sync -> refresh the same venue
    // by id (cheaper, more precise). Changed (or never synced) -> search
    // fresh, same as the per-save route.
    const sameVenue =
      existing?.besttime_venue_id && existing.synced_name === r.name && existing.synced_address === r.address;

    try {
      const { venueId, forecast } = await fetchBestTimeForecast(
        sameVenue ? { venueId: existing.besttime_venue_id } : { name: r.name, address: r.address }
      );
      const { error: rpcError } = await supabase.rpc("sync_restaurant_forecast", {
        p_restaurant_id: r.id,
        p_venue_id: venueId,
        p_forecast: forecast,
        p_name: r.name,
        p_address: r.address,
        p_secret: process.env.FORECAST_SYNC_SECRET,
      });
      if (rpcError) throw rpcError;
      synced++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ synced, skipped, failed });
}
