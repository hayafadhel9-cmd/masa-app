// Shared seating-area capacity logic, used by both the main booking flow and
// the edit-existing-booking flow so the two can't drift apart.
//
// Capacity semantics (restaurant_areas.capacity):
//   null/undefined -> not configured -> unlimited, matches the app's existing
//     behavior for an untracked zone.
//   0               -> configured, zero seats -> never has space.
//   >0              -> seat/table count checked against concurrent
//     pending+confirmed bookings for that exact restaurant/date/time/area.

export function isAreaConfigured(area) {
  return area.capacity !== null && area.capacity !== undefined;
}

// Whether every area has an explicit capacity (including 0) — mirrors the
// app's existing "only show an aggregate full/not-full signal when nothing
// is ambiguous" rule for the date/time pickers.
export function allAreasConfigured(areas) {
  return areas.length > 0 && areas.every(isAreaConfigured);
}

export function isAreaFull(area, used) {
  return isAreaConfigured(area) && used >= area.capacity;
}

// Total remaining space across every area for one slot, given a map of
// area name -> bookings already placed there for that slot.
export function remainingAcrossAreas(areas, usedByArea) {
  return areas.reduce((sum, area) => {
    const cap = isAreaConfigured(area) ? area.capacity : 0;
    const used = usedByArea[area.name] || 0;
    return sum + Math.max(0, cap - used);
  }, 0);
}

// First area (in list order) with space for one more booking, given a map of
// area name -> bookings already placed there — used both for "No preference"
// and to silently auto-assign a restaurant's one and only area.
export function pickAvailableArea(areas, usedByArea) {
  return areas.find((area) => !isAreaFull(area, usedByArea[area.name] || 0)) || null;
}
