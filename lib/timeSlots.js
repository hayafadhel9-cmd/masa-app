// Generates 30-minute booking slots between a restaurant's opening and
// closing time, converting from 24hr "HH:MM" storage to a friendly 12hr label.

export function generateTimeSlots(openingTime, closingTime) {
  const [openH, openM] = (openingTime || "18:00").split(":").map(Number);
  const [closeH, closeM] = (closingTime || "21:30").split(":").map(Number);

  const slots = [];
  let h = openH;
  let m = openM;

  // Guard against bad data causing an infinite loop
  let safety = 0;
  while ((h < closeH || (h === closeH && m <= closeM)) && safety < 100) {
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const minuteLabel = m === 0 ? "00" : String(m).padStart(2, "0");
    slots.push(`${hour12}:${minuteLabel} ${period}`);

    m += 30;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
    safety++;
  }

  return slots.length > 0 ? slots : ["7:00 PM"];
}
