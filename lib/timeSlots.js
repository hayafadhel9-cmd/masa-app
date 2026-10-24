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

// "7:30 PM" -> 1170 (minutes since midnight, clock-wrapped — a post-midnight
// slot like "1:00 AM" comes back as 60, not 1500, matching how the label
// itself reads on a clock face).
export function slotToMinutes(slot) {
  const [time, period] = slot.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

// Whether a generated slot is still ahead of `now`, correctly handling a
// restaurant whose window crosses midnight. Two separate wrap decisions:
// - A slot's raw clock value gets pushed a day forward whenever it reads
//   earlier than the opening hour — that's always a post-midnight slot
//   (e.g. "1:00 AM" when opening is 18:00), the same wrap generateTimeSlots
//   itself uses to build the list.
// - `now` only gets pushed forward the same way when it's genuinely still
//   inside *last night's* post-midnight spillover (closing time actually
//   crosses midnight, and now falls inside that extension) — never just
//   because it happens to read earlier than today's opening hour, which
//   would wrongly treat "it's 10am, tonight hasn't opened yet" the same as
//   "it's 1am, still in last night's open window", hiding every slot.
export function isSlotUpcoming(slot, openingTime, closingTime, now = new Date()) {
  const [openH, openM] = (openingTime || "18:00").split(":").map(Number);
  const [closeH, closeM] = (closingTime || "21:30").split(":").map(Number);
  const openTotal = openH * 60 + openM;
  let closeTotal = closeH * 60 + closeM;
  if (closeTotal <= openTotal) closeTotal += 24 * 60;

  const rawNow = now.getHours() * 60 + now.getMinutes();
  const nowInSpillover = closeTotal > 24 * 60 && rawNow < openTotal && rawNow + 24 * 60 <= closeTotal;
  const nowMinutes = nowInSpillover ? rawNow + 24 * 60 : rawNow;

  const rawSlot = slotToMinutes(slot);
  const slotMinutes = rawSlot < openTotal ? rawSlot + 24 * 60 : rawSlot;

  return slotMinutes >= nowMinutes;
}
