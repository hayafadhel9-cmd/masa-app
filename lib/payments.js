// "How will you pay?" math — how much of a tab one person's payment choice
// covers, shared by the diner's Tab screen (app/components/PayTabSheet.js,
// app/page.js's payment summary) and the restaurant's own receipt view
// (ReceiptPanel.js's "Guests will pay" card). Nothing here is ever stored:
// a choice only records *how* someone wants to split the bill
// (booking_payment_choices' split_type/split_people/split_item_ids), and
// this always recomputes the actual AED amount from the booking's current
// order_items/fees/VAT (lib/receipts.js's own totals) — so a later item
// change recalculates every existing choice automatically, same "never
// store a total" rule lib/receipts.js already documents.

// The AED share of the bill `choice` covers, before tip. `totals` is a
// lib/receipts.js computeReceiptTotals() result; `booking` supplies
// order_items (for an 'items' split) and party_size (the default person
// count for an 'even' split, when a choice predates a later party-size
// edit).
export function computeShareAed(choice, totals, booking) {
  if (!choice) return 0;
  if (choice.split_type === "even") {
    const people = Math.max(1, choice.split_people || booking.party_size || 1);
    return totals.total / people;
  }
  if (choice.split_type === "items") {
    const ids = new Set(choice.split_item_ids || []);
    const items = booking.order_items || [];
    const mySubtotal = items
      .filter((item) => ids.has(item.id))
      .reduce((sum, item) => sum + item.price_aed * item.quantity, 0);
    const fraction = totals.subtotal > 0 ? mySubtotal / totals.subtotal : 0;
    return totals.total * fraction;
  }
  return totals.total; // 'full'
}

// The AED tip on top of `shareAed`, per "Tip is on the guest's share" —
// either a percent of the share (one of the restaurant's own
// tip_percentages) or a flat custom amount, never both.
export function computeTipAed(choice, shareAed) {
  if (!choice) return 0;
  if (choice.tip_percent) return Math.round(shareAed * (choice.tip_percent / 100));
  if (choice.tip_custom_amount) return choice.tip_custom_amount;
  return 0;
}

// { shareAed, tipAed, youPayAed } — the full breakdown for one choice, all
// rounded to whole AED (this app has no smaller unit anywhere else either).
export function computePaymentAmounts(choice, totals, booking) {
  const shareAed = Math.round(computeShareAed(choice, totals, booking));
  const tipAed = computeTipAed(choice, shareAed);
  return { shareAed, tipAed, youPayAed: shareAed + tipAed };
}

// First name of whichever participant (booker or joined guest) `userId`
// belongs to — shared by the diner's "How you're paying" list (app/page.js)
// and the restaurant's own "Guests will pay" card (ReceiptPanel.js). Needs
// `booking.booking_guests` embedded alongside the usual `guest_name`/
// `user_id` columns on `booking` itself.
export function participantName(booking, userId) {
  if (booking.user_id === userId) return (booking.guest_name || "").trim().split(" ")[0];
  const guest = (booking.booking_guests || []).find((g) => g.user_id === userId);
  return guest?.guest_name ? guest.guest_name.trim().split(" ")[0] : "";
}

// The grey detail line under a payment choice, e.g. "Half + 10% tip" — the
// split description, plus the tip if one was added.
export function paymentChoiceDetail(choice, t) {
  let base;
  if (choice.split_type === "even") {
    base = choice.split_people === 2 ? t("splitHalfDetail") : t("splitEvenDetail", { n: choice.split_people });
  } else if (choice.split_type === "items") {
    base = t("splitItemsDetail", { count: (choice.split_item_ids || []).length });
  } else {
    base = t("splitFullDetail");
  }
  if (choice.tip_percent) return `${base} + ${t("tipDetailPercent", { pct: choice.tip_percent })}`;
  if (choice.tip_custom_amount) return `${base} + ${t("tipDetailCustom", { amount: choice.tip_custom_amount })}`;
  return base;
}
