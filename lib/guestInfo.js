// Booking used to ask for a name and phone number on every single booking,
// even though login is required to book at all — meaning we already had both
// on the account. These helpers pull guest_name/guest_phone straight from the
// signed-in user instead, so the booking form doesn't have to ask again.
//
// `reservation_name` is an optional per-account override (set in Account
// settings) for customers who want their bookings to show a different name
// than the one on their account — a nickname, a shortened version, etc. When
// it's not set, we fall back to the account's full name.
export function guestNameFromUser(user) {
  const metadata = user?.user_metadata || {};
  const reservationName = metadata.reservation_name?.trim();
  return reservationName || metadata.full_name || "Guest";
}

export function guestPhoneFromUser(user) {
  return user?.user_metadata?.phone || "N/A";
}
