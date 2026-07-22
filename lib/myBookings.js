// Since there's no login system yet, each browser/phone remembers its own
// booking IDs locally. This is fine for saved/shared bookings (not sensitive),
// but should be replaced by real user accounts once you add authentication.

const KEY = "masa_my_booking_ids";

export function getMyBookingIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addMyBookingId(id) {
  if (typeof window === "undefined") return;
  const current = getMyBookingIds();
  if (!current.includes(id)) {
    window.localStorage.setItem(KEY, JSON.stringify([id, ...current]));
  }
}

export function removeMyBookingId(id) {
  if (typeof window === "undefined") return;
  const current = getMyBookingIds();
  window.localStorage.setItem(KEY, JSON.stringify(current.filter((x) => x !== id)));
}
