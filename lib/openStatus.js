// Whether a restaurant is open right now, given its daily opening/closing
// time ("HH:MM" 24hr strings) — handles a restaurant that stays open past
// midnight the same way lib/timeSlots.js does (closing <= opening means the
// window rolls into the next day), by checking both "now, today's window"
// and "now, as a continuation of yesterday's window".
export function isOpenNow(openingTime, closingTime, now = new Date()) {
  const [openH, openM] = (openingTime || "18:00").split(":").map(Number);
  const [closeH, closeM] = (closingTime || "21:30").split(":").map(Number);
  const openTotal = openH * 60 + openM;
  let closeTotal = closeH * 60 + closeM;
  if (closeTotal <= openTotal) closeTotal += 24 * 60;

  const nowTotal = now.getHours() * 60 + now.getMinutes();
  const inTodaysWindow = nowTotal >= openTotal && nowTotal <= closeTotal;
  const inYesterdaysSpillover = nowTotal + 24 * 60 >= openTotal && nowTotal + 24 * 60 <= closeTotal;
  return inTodaysWindow || inYesterdaysSpillover;
}

// "18:00" -> "6 PM", "18:30" -> "6:30 PM", "00:00" -> "midnight" (via the
// translator), "12:00" -> "noon". Digits are left as plain numerals, same as
// every other number this app already displays untranslated (prices, counts).
export function formatClockLabel(hhmm, t) {
  const [h, m] = (hhmm || "0:00").split(":").map(Number);
  if (h === 0 && m === 0) return t("midnight");
  if (h === 12 && m === 0) return t("noon");
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
