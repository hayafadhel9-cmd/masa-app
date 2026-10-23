// Server-only wrapper around BestTime.app's forecast API. Reads
// BESTTIME_API_KEY (no NEXT_PUBLIC_ prefix, so Next.js never inlines it into
// a client bundle) — only import this from app/api/besttime/* route
// handlers, which run exclusively on the server. Never log the key or any
// response that might echo it back.

const BESTTIME_FORECASTS_URL = "https://besttime.app/api/v1/forecasts";

// BestTime's analysis[] is one object per weekday (day_info.day_int,
// 0=Monday..6=Sunday) with a day_raw array of 24 hourly 0-100 busyness
// values. Reshaped into { "0": [24 ints], ..., "6": [...] } — the compact
// form restaurant_forecasts.forecast stores and lib/busyness.js reads.
//
// day_raw is NOT indexed by wall-clock hour (index 0 = midnight) — BestTime
// orders every day's array starting at 6 AM (their documented "BestTime
// Day", which runs 6am-to-5am so a nightlife venue's late night doesn't
// split across two calendar days), confirmed against a real response's
// parallel `hour_analysis[].hour` field, e.g. day_raw[2] lines up with
// hour_analysis's {hour: 8, ...} -> index 2 = 8am, index 0 = 6am. Rotated
// here into true wall-clock-hour indexing (index 0 = midnight) so
// lib/busyness.js (and anything else reading the stored forecast) can just
// do `forecast[dayInt][hour]` without this offset leaking everywhere else.
function toWallClockHours(dayRaw) {
  const out = new Array(24).fill(null);
  dayRaw.forEach((value, i) => {
    out[(6 + i) % 24] = value;
  });
  return out;
}

function toForecastMap(analysis) {
  const map = {};
  (analysis || []).forEach((day) => {
    const dayInt = day?.day_info?.day_int;
    if (dayInt == null || !Array.isArray(day.day_raw) || day.day_raw.length !== 24) return;
    map[String(dayInt)] = toWallClockHours(day.day_raw);
  });
  return map;
}

// Looks up (or re-looks-up) a venue's weekly forecast via POST
// /api/v1/forecasts. Pass `venueId` to refresh a venue BestTime already
// knows about (cheaper, more precise); otherwise pass `name`+`address` to
// search fresh. Returns { venueId, forecast } — venueId is null and
// forecast is {} when BestTime has no match for this venue; this is the
// normal "nothing found" outcome, not an error, so it never throws for that
// case (only for a missing API key or a network/HTTP failure).
export async function fetchBestTimeForecast({ venueId, name, address }) {
  const apiKey = process.env.BESTTIME_API_KEY;
  if (!apiKey) throw new Error("BESTTIME_API_KEY is not configured");

  const params = new URLSearchParams({ api_key_private: apiKey });
  if (venueId) {
    params.set("venue_id", venueId);
  } else {
    if (!name || !address) {
      throw new Error("fetchBestTimeForecast requires venueId, or both name and address");
    }
    params.set("venue_name", name.slice(0, 256));
    params.set("venue_address", address.slice(0, 1024));
  }

  const res = await fetch(`${BESTTIME_FORECASTS_URL}?${params.toString()}`, { method: "POST" });
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.venue_info?.venue_id) {
    return { venueId: null, forecast: {} };
  }

  return {
    venueId: body.venue_info.venue_id,
    forecast: toForecastMap(body.analysis),
  };
}
