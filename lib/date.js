// Local-timezone-safe date helpers — avoid `toISOString().slice(0,10)`, which
// shifts to UTC and can land on the wrong calendar day near midnight in most
// timezones this app is actually used in.

export function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
