// Generates 30-minute booking slots between a restaurant's opening and
// closing time, converting from 24hr "HH:MM" storage to a friendly 12hr label.
// Handles restaurants that stay open past midnight (e.g. 18:00 to 02:00).

export function generateTimeSlots(openingTime, closingTime) {
  const [openH, openM] = (openingTime || "18:00").split(":").map(Number);
  const [closeH, closeM] = (closingTime || "21:30").split(":").map(Number);

  const openTotal = openH * 60 + openM;
  let closeTotal = closeH * 60 + closeM;

  // If closing time is earlier in the clock than opening time, it means
  // the restaurant stays open past midnight — push closing into "next day".
  if (closeTotal <= openTotal) {
    closeTotal += 24 * 60;
  }

  const slots = [];
  let current = openTotal;
  let safety = 0;

  while (current <= closeTotal && safety < 100) {
    const wrapped = current % (24 * 60);
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const minuteLabel = m === 0 ? "00" : String(m).padStart(2, "0");
    slots.push(`${hour12}:${minuteLabel} ${period}`);

    current += 30;
    safety++;
  }

  return slots.length > 0 ? slots : ["7:00 PM"];
}

// Groups a flat slot list (e.g. from generateTimeSlots) into per-hour buckets,
// preserving chronological order, for a two-step hour → minute picker. Each
// group's `slots` only contains minutes that are real bookable times (an
// hour near closing may have just ":00", no ":30").
export function groupSlotsByHour(slots) {
  const groups = [];
  const byLabel = new Map();
  slots.forEach((slot) => {
    const [hourPart, rest] = slot.split(":");
    const [minute, period] = rest.split(" ");
    const label = `${hourPart} ${period}`;
    if (!byLabel.has(label)) {
      const group = { label, slots: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    byLabel.get(label).slots.push({ minute, full: slot });
  });
  return groups;
}

// "6:00 PM" / "6:30 PM" -> "6 PM" — the hour-chip label a given slot belongs to.
export function hourLabelOfSlot(slot) {
  if (!slot) return null;
  const [hourPart, rest] = slot.split(":");
  const period = rest.split(" ")[1];
  return `${hourPart} ${period}`;
}
