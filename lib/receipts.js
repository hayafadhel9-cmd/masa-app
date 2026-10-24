// Receipt math shared by the Tonight/Receipts/Analytics tabs — all derived
// client-side from a booking's `order_items` (now embedded on every loaded
// booking via `bookings?select=*,order_items(*),...`) and the restaurant's
// own settings, never stored as a total so it can't drift from its inputs.

const VAT_RATE = 0.05;

// Same weekday-index convention as the minimum-spend setting itself
// (lib/relativeDate.js-style: 0=Sunday..6=Saturday, from Date#getDay()).
export function minSpendApplies(restaurant, bookingDateStr) {
  if (!restaurant || !restaurant.min_spend_aed) return false;
  const weekday = new Date(`${bookingDateStr}T00:00:00`).getDay();
  return (restaurant.min_spend_nights || []).includes(weekday);
}

// { subtotal, vat, minSpendRequired, topUp, total } — all integers (AED has
// no smaller unit in this app, matching how every other price is handled).
export function computeReceiptTotals(booking, restaurant) {
  const items = booking.order_items || [];
  const subtotal = items.reduce((sum, item) => sum + item.price_aed * item.quantity, 0);
  const vat = Math.round(subtotal * VAT_RATE);
  const applies = minSpendApplies(restaurant, booking.booking_date);
  const minSpendRequired = applies ? (restaurant.min_spend_aed || 0) * booking.party_size : 0;
  const topUp = Math.max(0, minSpendRequired - subtotal);
  const total = subtotal + vat + topUp;
  return { subtotal, vat, minSpendRequired, topUp, total, applies };
}

export { VAT_RATE };
