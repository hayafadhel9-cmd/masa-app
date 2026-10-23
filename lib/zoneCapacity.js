// "X of Y seats taken in {zone} at {time}" context shown on a dashboard
// booking card — reuses the exact same capacity semantics and counting
// convention already used for availability elsewhere in the app
// (lib/areas.js / app/page.js's resolveAssignedArea): capacity is a count of
// concurrent pending+confirmed bookings in that area/slot, not a sum of
// party sizes, and an unconfigured area (capacity null/undefined) shows
// nothing rather than a misleading total.
export function zoneCapacityInfo(booking, allBookings, areas) {
  if (!booking.zone) return null;
  const area = areas.find((a) => a.name === booking.zone);
  if (!area || area.capacity === null || area.capacity === undefined) return null;
  const taken = allBookings.filter(
    (b) =>
      b.zone === booking.zone &&
      b.booking_date === booking.booking_date &&
      b.booking_time === booking.booking_time &&
      (b.status === "pending" || b.status === "confirmed")
  ).length;
  return { taken, total: area.capacity };
}
