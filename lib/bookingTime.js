// Bookings store time as text like "7:00 PM" and a separate date column.
// This combines them into a real Date object so we can check the
// free-cancellation cutoff, which varies per restaurant.

export function getBookingDateTime(booking) {
  if (!booking.booking_time || !booking.booking_date) return null;
  const [time, modifier] = booking.booking_time.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  const d = new Date(booking.booking_date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function canFreelyCancel(booking, noticeHours = 2) {
  if (booking.status !== "pending" && booking.status !== "confirmed") return false;
  const dt = getBookingDateTime(booking);
  if (!dt) return false;
  const cutoff = new Date(dt.getTime() - noticeHours * 60 * 60 * 1000);
  return new Date() < cutoff;
}
