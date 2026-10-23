import { toLocalDateStr, addDays } from "./date";

// "Tonight" / "Tomorrow" / a short weekday+date — used throughout the
// dashboard (Requests card, Tonight list, Upcoming group headers) wherever a
// booking's date needs a human-friendly label instead of a raw ISO string.
// `t` is the real LanguageContext translator — `navTonight`/`relativeTomorrow`
// already carry the right word for both languages.
export function relativeDateLabel(dateStr, lang, t) {
  const today = toLocalDateStr(new Date());
  const tomorrow = toLocalDateStr(addDays(new Date(), 1));
  if (dateStr === today) return t("navTonight");
  if (dateStr === tomorrow) return t("relativeTomorrow");
  const formatter = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return formatter.format(new Date(`${dateStr}T00:00:00`));
}
