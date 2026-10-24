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

// { subtotal, fees, feesTotal, vat, minSpendRequired, topUp, total } — all
// money fields integers (AED has no smaller unit in this app, matching how
// every other price is handled).
//
// Fees come from `booking.fee_snapshot` (set once, at the moment the tab
// opened — see TonightTab.js's handleArrive) rather than the restaurant's
// live `restaurant_fees` list, so a later Settings edit never changes a
// receipt that already started; a booking with no snapshot (no tab, or a
// tab opened before this feature existed) simply has no fees. Order is
// subtotal -> minimum-spend top-up -> each fee (a percent fee is a % of
// subtotal specifically, not of the top-up or other fees) -> VAT (5% of
// everything above it) -> total — matches the receipt's own display order.
export function computeReceiptTotals(booking, restaurant) {
  const items = booking.order_items || [];
  const subtotal = items.reduce((sum, item) => sum + item.price_aed * item.quantity, 0);
  const applies = minSpendApplies(restaurant, booking.booking_date);
  const minSpendRequired = applies ? (restaurant?.min_spend_aed || 0) * booking.party_size : 0;
  const topUp = Math.max(0, minSpendRequired - subtotal);

  const feeRules = booking.fee_snapshot || [];
  const fees = feeRules.map((f) => ({
    name_en: f.name_en,
    name_ar: f.name_ar,
    type: f.type,
    amount: f.amount,
    value: f.type === "percent" ? Math.round(subtotal * (f.amount / 100)) : f.amount,
  }));
  const feesTotal = fees.reduce((sum, f) => sum + f.value, 0);

  const vat = Math.round((subtotal + topUp + feesTotal) * VAT_RATE);
  const total = subtotal + topUp + feesTotal + vat;

  return { subtotal, fees, feesTotal, vat, minSpendRequired, topUp, total, applies };
}

export { VAT_RATE };
