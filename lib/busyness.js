// Combines a cached BestTime.app weekly forecast (restaurant_forecasts) with
// Held's own live booking counts to label how busy a selected time slot
// looks. Pure/shared so both the client-rendered Booking screen and any
// future server code can use the exact same math.

// BestTime's day_int is 0=Monday..6=Sunday — NOT JS Date#getDay()'s
// 0=Sunday..6=Saturday — so this can't just be `date.getDay()`.
export function dayIntFromDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat, local time
  return (jsDay + 6) % 7; // 0=Mon..6=Sun
}

// "8:00 PM" -> 20. Slots are always on the hour or half-hour; a :30 slot
// shares its hour's forecast value, since BestTime's forecast is hourly.
export function hour24FromSlot(slot) {
  if (!slot) return null;
  const [time, modifier] = slot.split(" ");
  let [hours] = time.split(":").map(Number);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours;
}

// `forecast` is the cached { "0": [24 ints 0-100], ..., "6": [...] } map
// (restaurant_forecasts.forecast), or null/{} if BestTime never found this
// venue. Returns null (not 0) when there's no data for this slot, so callers
// can tell "definitely quiet" from "we don't know".
export function bestTimeValueForSlot(forecast, dateStr, slot) {
  if (!forecast || !dateStr || !slot) return null;
  const dayArr = forecast[String(dayIntFromDateStr(dateStr))];
  const hour = hour24FromSlot(slot);
  if (!Array.isArray(dayArr) || hour == null) return null;
  const v = dayArr[hour];
  return typeof v === "number" ? v : null;
}

// Held's own occupancy for a slot, as a 0-100 percentage of total configured
// seating capacity across all areas. null when capacity isn't fully
// configured (same "don't show a misleading partial signal" rule the
// existing time/seating availability already follows).
export function occupancyPctForSlot(areas, remaining) {
  if (remaining == null) return null;
  const totalCapacity = (areas || []).reduce((sum, a) => sum + (a.capacity ?? 0), 0);
  if (totalCapacity <= 0) return null;
  const booked = totalCapacity - remaining;
  return Math.min(100, Math.max(0, (booked / totalCapacity) * 100));
}

// The higher of the two signals wins; null only when neither is available
// (BestTime has nothing AND there's no bookings signal either) — the caller
// should show nothing in that case, not a 0/"Quiet" label.
export function combineBusyness(bestTimeValue, occupancyPct) {
  if (bestTimeValue == null && occupancyPct == null) return null;
  return Math.max(bestTimeValue ?? 0, occupancyPct ?? 0);
}

export function busynessLevel(value) {
  if (value == null) return null;
  if (value < 40) return "quiet";
  if (value <= 75) return "lively";
  return "busy";
}

export const BUSYNESS_DOT_COUNT = { quiet: 1, lively: 2, busy: 3 };
