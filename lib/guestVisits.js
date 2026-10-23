// "Nth visit" badge logic for the restaurant dashboard — a returning-guest
// signal computed client-side from the restaurant's own already-loaded
// bookings list, not a stored column (so it can never drift out of sync with
// the bookings it's derived from).

// A booking counts as a "visit" toward this total once it's been accepted
// (or already happened) — a request that was never confirmed, or a no-show,
// isn't a visit.
const VISIT_COUNTING_STATUSES = new Set(["pending", "confirmed", "dined"]);

// Same guest, two ways to recognize them: a logged-in diner by `user_id`, or
// — since `bookings.user_id` can be null for pre-account bookings — by
// `guest_phone` as a fallback so walk-in-style/no-account guests still get
// credit for repeat visits.
function guestKey(booking) {
  return booking.user_id ? `u:${booking.user_id}` : `p:${booking.guest_phone}`;
}

// Returns a Map of booking id -> visit number (1 = first visit, 2 = second,
// ...) across the given bookings for one restaurant. Only bookings in
// VISIT_COUNTING_STATUSES get a number; everything else maps to 1 (so
// callers can treat "not present / 1" the same as "don't show a badge").
export function computeVisitNumbers(bookings) {
  const byGuest = new Map();
  for (const b of bookings) {
    if (!VISIT_COUNTING_STATUSES.has(b.status)) continue;
    const key = guestKey(b);
    if (!byGuest.has(key)) byGuest.set(key, []);
    byGuest.get(key).push(b);
  }
  const visitNumbers = new Map();
  for (const list of byGuest.values()) {
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    list.forEach((b, i) => visitNumbers.set(b.id, i + 1));
  }
  return visitNumbers;
}

function englishOrdinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// English uses an ordinal ("4th visit"); Arabic uses a non-ordinal
// "visit number N" construction instead ("الزيارة رقم 4") — genuinely
// different sentence shapes, not just a word swap, so this builds the whole
// string per language rather than routing through a single interpolated key.
export function visitBadgeText(n, lang) {
  return lang === "ar" ? `الزيارة رقم ${n}` : `${englishOrdinal(n)} visit`;
}
