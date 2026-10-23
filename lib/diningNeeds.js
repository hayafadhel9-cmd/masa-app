// Shared shape for the "Anything we should know?" dining-needs fields used by
// the Booking screen, the Account screen's saved defaults, and the restaurant
// dashboard's read-only display. Kept in one place so the camelCase JS shape
// ({ wheelchair, highChair, allergyOn, allergy }) and the snake_case
// `booking_needs` table columns (wheelchair, high_chair, allergy, allergy_detail)
// never drift apart between the three call sites.

export function emptyDiningNeeds() {
  return { wheelchair: false, highChair: false, allergyOn: false, allergy: "" };
}

export function hasDiningNeeds(needs) {
  return !!(needs?.wheelchair || needs?.highChair || needs?.allergyOn);
}

// Short human-readable summary, e.g. "Wheelchair access, Allergy: tree nuts" —
// used for the collapsed Booking-screen row, the Account list row, and the
// dashboard detail view. `lang` only changes the list separator (matches the
// Arabic comma "، " used elsewhere in the app's Arabic copy).
export function diningNeedsSummary(needs, t, lang) {
  if (!needs) return "";
  const parts = [];
  if (needs.wheelchair) parts.push(t("wheelchairAccess"));
  if (needs.highChair) parts.push(t("highChairNeed"));
  if (needs.allergyOn) {
    const detail = needs.allergy?.trim();
    parts.push(detail ? `${t("allergyNeed")}: ${detail}` : t("allergyNeed"));
  }
  return parts.join(lang === "ar" ? "، " : ", ");
}

// camelCase state -> snake_case `booking_needs` row, ready to insert.
export function diningNeedsRowForInsert(bookingId, needs) {
  return {
    booking_id: bookingId,
    wheelchair: !!needs.wheelchair,
    high_chair: !!needs.highChair,
    allergy: !!needs.allergyOn,
    allergy_detail: needs.allergyOn ? needs.allergy?.trim() || null : null,
  };
}

// snake_case `booking_needs` row (or null/undefined if none exists for a
// booking) -> the camelCase state shape.
export function diningNeedsFromRow(row) {
  if (!row) return emptyDiningNeeds();
  return {
    wheelchair: !!row.wheelchair,
    highChair: !!row.high_chair,
    allergyOn: !!row.allergy,
    allergy: row.allergy_detail || "",
  };
}
