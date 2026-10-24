"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "../lib/supabase/client";
import { Search, MapPin, ChevronLeft, ChevronRight, Users, ShieldCheck, CreditCard, Check, Cake, Heart, Briefcase, Share2, Compass, BookMarked, Clock, User, Star, Plus, Accessibility, Baby, Nut, Receipt, X } from "lucide-react";
import { canFreelyCancel } from "../lib/bookingTime";
import {
  emptyDiningNeeds,
  hasDiningNeeds,
  diningNeedsSummary,
  diningNeedsRowForInsert,
  diningNeedsFromRow,
} from "../lib/diningNeeds";
import { generateTimeSlots, groupSlotsByHour, hourLabelOfSlot, isSlotUpcoming } from "../lib/timeSlots";
import { isOpenNow, formatClockLabel } from "../lib/openStatus";
import MenuSheet from "./components/MenuSheet";
import CustomerAuthForm from "./components/CustomerAuthForm";
import AddGuestsSheet from "./components/AddGuestsSheet";
import PayTabSheet from "./components/PayTabSheet";
import { useLanguage } from "../lib/LanguageContext";
import { passwordRuleMessage } from "../lib/passwordRules";
import { authErrorMessage } from "../lib/authErrorMessage";
import { guestNameFromUser, guestPhoneFromUser } from "../lib/guestInfo";
import { toLocalDateStr, addDays } from "../lib/date";
import { isAreaFull, allAreasConfigured, remainingAcrossAreas, pickAvailableArea } from "../lib/areas";
import { bestTimeValueForSlot, occupancyPctForSlot, combineBusyness, busynessLevel, BUSYNESS_DOT_COUNT } from "../lib/busyness";
import { computeReceiptTotals } from "../lib/receipts";
import { computePaymentAmounts, participantName, paymentChoiceDetail } from "../lib/payments";

// Sentinel value for "let the restaurant pick any area with space" — stored
// transiently in UI state only, never written to bookings.zone (which always
// ends up with a concrete area name or null, never this string).
const NO_PREFERENCE = "no_preference";

// Looks up live booking counts per area for one restaurant/date/time slot and
// resolves what `zone` a booking should actually be saved with — shared by a
// fresh booking (confirmBooking) and an edited one (submitEditBooking) so the
// two can't drift apart. `excludeBookingId` lets an edit ignore its own
// original row when counting (mirrors the existing `.neq("id", ...)` pattern
// used elsewhere for the same reason).
async function resolveAssignedArea(restaurantId, areaList, choice, date, slot, excludeBookingId) {
  if (areaList.length === 0) return { area: null, blocked: false };

  let query = supabase
    .from("bookings")
    .select("zone")
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", date)
    .eq("booking_time", slot)
    .in("status", ["pending", "confirmed"]);
  if (excludeBookingId) query = query.neq("id", excludeBookingId);
  const { data } = await query;
  const counts = {};
  (data || []).forEach((b) => {
    counts[b.zone] = (counts[b.zone] || 0) + 1;
  });

  if (areaList.length === 1) {
    const only = areaList[0];
    return { area: only.name, blocked: isAreaFull(only, counts[only.name] || 0) };
  }
  if (choice === NO_PREFERENCE) {
    const picked = pickAvailableArea(areaList, counts);
    return { area: picked?.name ?? null, blocked: !picked };
  }
  const chosen = areaList.find((a) => a.name === choice);
  if (!chosen) return { area: choice, blocked: false };
  return { area: chosen.name, blocked: isAreaFull(chosen, counts[chosen.name] || 0) };
}

// "No preference" + one chip per area, following the same label/chip style
// as the Booking screen's other sections. Shared by the main booking flow
// and the edit-existing-booking flow. Renders nothing for 0 or 1 areas —
// that case is auto-assigned with no UI, per the request.
function SeatingPreferenceSection({ areas, availability, selected, onSelect, t }) {
  if (!areas || areas.length < 2) return null;
  const anyAreaHasSpace = areas.some((a) => !availability[a.name]);
  return (
    <>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-taupe">{t("seatingPreference")}</label>
      <div className="flex flex-wrap gap-2 mt-3 mb-7">
        <button
          type="button"
          disabled={!anyAreaHasSpace}
          onClick={() => onSelect(NO_PREFERENCE)}
          className={`rounded-2xl px-4 py-2.5 text-xs font-semibold ${
            !anyAreaHasSpace
              ? "bg-tan/50 text-taupe opacity-60 cursor-not-allowed"
              : selected === NO_PREFERENCE
              ? "bg-burgundy text-offwhite"
              : "bg-tan text-charcoal"
          }`}
        >
          {t("noPreference")}
        </button>
        {areas.map((a) => {
          const full = !!availability[a.name];
          const isSelected = selected === a.name;
          return (
            <button
              key={a.id}
              type="button"
              disabled={full}
              onClick={() => onSelect(a.name)}
              className={`rounded-2xl px-4 py-2.5 text-xs font-semibold ${
                full
                  ? "bg-tan/50 text-taupe opacity-60 cursor-not-allowed"
                  : isSelected
                  ? "bg-burgundy text-offwhite"
                  : "bg-tan text-charcoal"
              }`}
            >
              {a.name}
            </button>
          );
        })}
      </div>
    </>
  );
}

const NEED_DEFS = [
  { key: "wheelchair", labelKey: "wheelchairAccess", Icon: Accessibility },
  { key: "highChair", labelKey: "highChairNeed", Icon: Baby },
  { key: "allergy", labelKey: "allergyNeed", Icon: Nut },
];

// The three dining-needs chips + conditional allergy text field, shared by
// the Booking screen's collapsible row and the Account screen's saved
// defaults. `needs` is the { wheelchair, highChair, allergyOn, allergy }
// shape from lib/diningNeeds.js; `onToggle` flips one chip, `onAllergyChange`
// updates the free-text field. Icon leads the label in every chip; unselected
// is burgundy-on-tan (the app's cream-family neutral surface), selected
// flips to cream-on-burgundy — both the icon and label share that color via
// currentColor, so the icon never looks disconnected from its own chip.
function DiningNeedsFields({ needs, onToggle, onAllergyChange, t, allergyInputRef }) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {NEED_DEFS.map(({ key, labelKey, Icon }) => {
          const on = key === "allergy" ? needs.allergyOn : needs[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={on}
              className={`inline-flex items-center gap-2 rounded-full px-4 min-h-[44px] text-xs font-semibold ${
                on ? "bg-burgundy text-offwhite" : "bg-tan text-burgundy"
              }`}
            >
              <Icon size={16} />
              {t(labelKey)}
            </button>
          );
        })}
      </div>
      {needs.allergyOn && (
        <input
          ref={allergyInputRef}
          value={needs.allergy}
          onChange={(e) => onAllergyChange(e.target.value)}
          placeholder={t("allergyPlaceholder")}
          maxLength={60}
          dir="auto"
          className="w-full rounded-full px-4 py-3 text-sm mt-3 outline-none bg-tan text-charcoal placeholder:text-taupe"
        />
      )}
    </>
  );
}

// Small tappable icon row shown on a My Bookings card — one icon per active
// need, burgundy at 16px, nothing rendered when the booking has none.
// Tapping opens the detail modal via `onOpen`, which is how the allergy
// free-text gets surfaced. `booking.booking_needs` is a single object or
// null here, not an array — `booking_needs.booking_id` is that table's
// primary key, so PostgREST embeds it as a to-one relation (see the matching
// note in app/dashboard/page.js's NeedsIcons).
function BookingNeedsIcons({ booking, onOpen }) {
  const needs = diningNeedsFromRow(booking.booking_needs);
  if (!hasDiningNeeds(needs)) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(booking, needs);
      }}
      className="inline-flex items-center gap-1 text-burgundy flex-shrink-0"
      aria-label="Dining needs"
    >
      {needs.wheelchair && <Accessibility size={16} />}
      {needs.highChair && <Baby size={16} />}
      {needs.allergyOn && <Nut size={16} />}
    </button>
  );
}

function NeedsDetailModal({ detail, onClose, t }) {
  if (!detail) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/50 flex items-center justify-center px-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[20px] p-5 bg-cream shadow-[0_8px_30px_rgba(43,31,33,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-charcoal mb-1">{t("diningNeeds")}</h3>
        <p className="text-xs text-muted mb-4">{detail.booking.restaurants?.name}</p>
        <div className="flex flex-col gap-2.5 text-sm text-charcoal mb-5">
          {detail.needs.wheelchair && (
            <div className="flex items-center gap-2">
              <Accessibility size={16} className="text-burgundy flex-shrink-0" /> {t("wheelchairAccess")}
            </div>
          )}
          {detail.needs.highChair && (
            <div className="flex items-center gap-2">
              <Baby size={16} className="text-burgundy flex-shrink-0" /> {t("highChairNeed")}
            </div>
          )}
          {detail.needs.allergyOn && (
            <div className="flex items-start gap-2">
              <Nut size={16} className="text-burgundy flex-shrink-0 mt-0.5" />
              <span>
                {t("allergyNeed")}
                {detail.needs.allergy ? `: ${detail.needs.allergy}` : ""}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-sm font-medium text-burgundy py-2"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
}

const RATING_GOLD = "#C9A24B";
const RATING_TAN = "#D6CBB2";
const RATING_DISMISSED_KEY = "masa_rating_dismissed_ids";

function getDismissedRatingIds() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RATING_DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

function dismissRatingPromptId(bookingId) {
  const current = getDismissedRatingIds();
  if (!current.includes(bookingId)) {
    window.localStorage.setItem(RATING_DISMISSED_KEY, JSON.stringify([...current, bookingId]));
  }
}

// A single star, filled gold from the left up to `average / 5` and tan the
// rest of the way, with a hard (not gradient) edge via an SVG clip-path. The
// clip rect uses plain numeric/percentage SVG coordinates, not CSS logical
// properties, so the fill direction stays physically left-to-right
// regardless of the page's `dir` — this is what keeps it unmirrored in RTL.
// First name of everyone sharing a booking besides the current viewer — the
// booker (booking.guest_name, the same point-in-time snapshot shown to
// restaurant staff) plus any joined guest (booking_guests.guest_name,
// snapshotted the same way when they accepted their invite). null when
// nobody else is on the booking, so callers can skip the "Shared with…"
// line entirely rather than rendering it empty.
function sharedWithNames(booking, currentUserId) {
  const names = [];
  if (booking.user_id && booking.user_id !== currentUserId && booking.guest_name) {
    names.push(booking.guest_name.trim().split(" ")[0]);
  }
  (booking.booking_guests || []).forEach((g) => {
    if (g.user_id && g.user_id !== currentUserId && g.guest_name) {
      names.push(g.guest_name.trim().split(" ")[0]);
    }
  });
  return names.length > 0 ? names.join(", ") : null;
}

// One open-or-closed tab's full receipt — restaurant name, a status line,
// the itemized card (items/notes, VAT, bold total), the minimum-spend
// progress bar (hidden entirely when no minimum spend applies that night),
// the "Shared with…" line, and — only while the tab is still open — the
// "How will you pay?" flow. Reused by the Tab screen's Current view and by
// tapping a Past card to see its full receipt (where the payment flow no
// longer applies, since the tab's already settled).
function TabReceiptCard({ booking, currentUserId, statusWord, lang, t, onOpenPay }) {
  const totals = computeReceiptTotals(booking, booking.restaurants);
  const items = booking.order_items || [];
  const shared = sharedWithNames(booking, currentUserId);
  const minSpendReached = totals.applies && totals.topUp === 0;
  const minSpendPct =
    totals.applies && totals.minSpendRequired > 0
      ? Math.min(100, (totals.subtotal / totals.minSpendRequired) * 100)
      : 0;

  const choices = booking.booking_payment_choices || [];
  const myChoice = choices.find((c) => c.user_id === currentUserId);
  const covered = choices.reduce((sum, c) => sum + computePaymentAmounts(c, totals, booking).shareAed, 0);
  const remaining = Math.max(0, totals.total - covered);

  return (
    <div>
      <div className="font-serif text-xl text-charcoal mb-1">{booking.restaurants?.name}</div>
      <div className="text-xs text-muted mb-4">
        {booking.zone} · {t("guestsCount", { count: booking.party_size })} · {statusWord}
      </div>

      <div className="rounded-2xl p-4 bg-card mb-3">
        {items.length === 0 ? (
          <p className="text-xs text-taupe py-1">{t("noItemsYet")}</p>
        ) : (
          <div className="flex flex-col gap-3 mb-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="text-charcoal">
                    {item.quantity} × {item.name}
                  </div>
                  {item.notes && <div className="text-xs text-taupe mt-0.5">{item.notes}</div>}
                </div>
                <span className="text-charcoal flex-shrink-0">AED {item.quantity * item.price_aed}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-charcoal/[0.08] pt-3 flex flex-col gap-1.5">
          {totals.fees.map((fee, i) => (
            <div key={i} className="flex justify-between text-sm text-muted">
              <span>{lang === "ar" ? fee.name_ar : fee.name_en}</span>
              <span>AED {fee.value}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm text-muted">
            <span>{t("vatLabel")}</span>
            <span>AED {totals.vat}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-charcoal">
            <span>{t("totalLabel")}</span>
            <span>AED {totals.total}</span>
          </div>
        </div>
      </div>

      {totals.applies && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-tan overflow-hidden">
            <div className="h-full rounded-full bg-brass" style={{ width: `${minSpendPct}%` }} />
          </div>
          <p className="text-xs text-taupe mt-1.5">
            {minSpendReached ? t("minSpendReached") : t("minSpendLeft", { amount: totals.topUp })}
          </p>
        </div>
      )}

      {shared && <p className="text-xs text-taupe mb-5">{t("sharedWith", { names: shared })}</p>}

      {booking.receipt_status === "open" && onOpenPay && (
        <div>
          {choices.length > 0 && (
            <>
              <div className="text-[11px] font-bold uppercase tracking-widest text-taupe mb-3">
                {t("howYourePaying")}
              </div>
              <div className="flex flex-col gap-2 mb-3">
                {choices.map((c) => {
                  const amounts = computePaymentAmounts(c, totals, booking);
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-2xl px-4 py-3 bg-card">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-charcoal truncate">
                          {participantName(booking, c.user_id)} · {c.method === "card" ? t("payCard") : t("payCash")}
                        </div>
                        <div className="text-xs text-taupe">{paymentChoiceDetail(c, t)}</div>
                      </div>
                      <span className="text-sm font-semibold text-charcoal flex-shrink-0">AED {amounts.youPayAed}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs text-taupe">{t("coveredAmount", { amount: covered })}</span>
                {remaining <= 0 ? (
                  <span className="text-xs font-semibold text-green-700">{t("fullBillCovered")}</span>
                ) : (
                  <span className="text-xs text-taupe">{t("stillToCoverAmount", { amount: remaining })}</span>
                )}
              </div>
            </>
          )}

          {myChoice ? (
            <button type="button" onClick={() => onOpenPay(booking)} className="text-sm font-medium text-burgundy underline">
              {t("change")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenPay(booking)}
              className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]"
            >
              {t("howWillYouPay")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RatingStar({ average, size = 14 }) {
  const clipId = `rating-star-${useId()}`;
  const fillPercent = Math.max(0, Math.min(100, (average / 5) * 100));
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="flex-shrink-0">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={`${fillPercent}%`} height="24" />
        </clipPath>
      </defs>
      <path
        d="M12 2.5l2.9 6.3 6.8.7-5.1 4.6 1.5 6.7-6.1-3.5-6.1 3.5 1.5-6.7-5.1-4.6 6.8-.7z"
        fill={RATING_TAN}
      />
      <path
        d="M12 2.5l2.9 6.3 6.8.7-5.1 4.6 1.5 6.7-6.1-3.5-6.1 3.5 1.5-6.7-5.1-4.6 6.8-.7z"
        fill={RATING_GOLD}
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

// Tappable 1-5 star row used both in the rating prompt and reused inline for
// read-only display (via `readOnly`) of a rating the customer already gave.
function StarPicker({ value, onChange, readOnly, size = 28 }) {
  return (
    <div className="flex items-center gap-1.5" style={{ direction: "ltr" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? "cursor-default" : ""}
          aria-label={`${n}`}
        >
          <Star size={size} fill={n <= value ? RATING_GOLD : RATING_TAN} stroke="none" />
        </button>
      ))}
    </div>
  );
}

function RatingPromptModal({ booking, value, setValue, comment, setComment, submitting, submitted, onSubmit, onDismiss, t }) {
  return (
    <div className="fixed inset-0 z-50 bg-charcoal/50 flex items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-[20px] p-5 bg-cream shadow-[0_8px_30px_rgba(43,31,33,0.25)]">
        {submitted ? (
          <div className="py-6 text-center">
            <Check size={28} className="text-burgundy mx-auto mb-3" />
            <p className="text-sm font-medium text-charcoal">{t("thanksForRating")}</p>
          </div>
        ) : (
          <>
            <h3 className="font-serif text-xl text-charcoal mb-1">{t("rateVisitTitle")}</h3>
            <p className="text-sm text-muted mb-4">
              {t("rateVisitSubtitle", { name: booking.restaurants?.name || "" })}
            </p>
            <div className="text-xs text-muted mb-4">
              {booking.booking_date} · {t("guestsCount", { count: booking.party_size })}
            </div>
            <div className="flex justify-center mb-4">
              <StarPicker value={value} onChange={setValue} size={32} />
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("addCommentPlaceholder")}
              rows={3}
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe mb-4 resize-none"
            />
            <button
              onClick={onSubmit}
              disabled={submitting || value === 0}
              className="w-full rounded-full py-3 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60 mb-3"
            >
              {submitting ? t("pleaseWait") : t("submitRating")}
            </button>
            <button onClick={onDismiss} className="w-full text-center text-xs text-muted underline">
              {t("notNow")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Shared by the date strip and the hour row — fades items near the left/right
// edges of a horizontally-scrolling container. Symmetric, so it needs no
// RTL-specific handling (see the 2026-10-04 edge-fade bullet in PROJECT_STATUS.md).
const EDGE_FADE_STYLE = {
  WebkitMaskImage:
    "linear-gradient(to right, transparent 0, rgba(0,0,0,0.4) 12px, black 40px, black calc(100% - 40px), rgba(0,0,0,0.4) calc(100% - 12px), transparent 100%)",
  maskImage:
    "linear-gradient(to right, transparent 0, rgba(0,0,0,0.4) 12px, black 40px, black calc(100% - 40px), rgba(0,0,0,0.4) calc(100% - 12px), transparent 100%)",
};

// Real bookable dates for a restaurant's min/max advance-booking window,
// each with a locale-correct short weekday label (not hardcoded "Su/Mo/Tu…").
function generateDateStrip(minAdvanceDays, maxAdvanceDays, locale) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const min = minAdvanceDays ?? 0;
  const max = maxAdvanceDays ?? 30;
  const days = [];
  for (let i = min; i <= max; i++) {
    const d = addDays(new Date(), i);
    days.push({ value: toLocalDateStr(d), weekday: formatter.format(d), day: d.getDate() });
  }
  return days;
}

export default function DinerPage() {
  const { lang, setLang, t } = useLanguage();

  const OCCASIONS = [
    { label: "None", key: "occasionNone", icon: null },
    { label: "Birthday", key: "occasionBirthday", icon: Cake },
    { label: "Anniversary", key: "occasionAnniversary", icon: Heart },
    { label: "Business", key: "occasionBusiness", icon: Briefcase },
  ];

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [active, setActive] = useState(null);
  const dateStripRef = useRef(null);
  const hourStripRef = useRef(null);
  const [query, setQuery] = useState("");
  const [party, setParty] = useState(2);
  const [time, setTime] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [areas, setAreas] = useState([]);
  const [seatingChoice, setSeatingChoice] = useState(NO_PREFERENCE);
  const [occasion, setOccasion] = useState("None");
  const [tab, setTab] = useState("discover");
  const [myBookings, setMyBookings] = useState([]);
  const [cardNumber, setCardNumber] = useState("");
  const [lastBooking, setLastBooking] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [areaAvailability, setAreaAvailability] = useState({});
  const [timeAvailability, setTimeAvailability] = useState({});
  // Cached BestTime.app weekly forecast for `active` (restaurant_forecasts.forecast),
  // or null if never synced / BestTime found nothing. Public-read like areas/menu
  // items — fetched the same way, no auth needed.
  const [forecast, setForecast] = useState(null);
  const [bookingsView, setBookingsView] = useState("current");
  const [reviewedBookingIds, setReviewedBookingIds] = useState(new Set());
  const [ratingPromptBooking, setRatingPromptBooking] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [activeRestaurantRating, setActiveRestaurantRating] = useState(null);
  // Restaurant Detail's "Tonight" row — a quick-pick time for *today*
  // specifically, kept separate from `time`/`bookingDate` (which the actual
  // booking flow uses, defaulted by openRestaurant() to today + the
  // restaurant's own min_advance_days) so tapping a tonight card never
  // silently changes the booking flow's defaults until the diner actually
  // taps "Book for <time>" on the floating book bar.
  const [selectedTonightTime, setSelectedTonightTime] = useState(null);
  const [tonightAvailability, setTonightAvailability] = useState({});
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  // Tab feature — the diner's own open/closed receipts (bookings they made
  // or were added to as a guest), independent from `myBookings` above
  // (which is about reservation status, not payment/order state).
  const [tabView, setTabView] = useState("current");
  const [tabBookings, setTabBookings] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [viewingPastTab, setViewingPastTab] = useState(null);
  const [guestsSheetBooking, setGuestsSheetBooking] = useState(null);
  // "How will you pay?" — the booking currently being paid for (or null).
  // A fresh choice vs. editing an existing one ("Change") is told apart
  // purely by whether the current user already has a row in that
  // booking's booking_payment_choices, not by separate state here.
  const [payingBooking, setPayingBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editParty, setEditParty] = useState(2);
  const [editTime, setEditTime] = useState("");
  const [editZone, setEditZone] = useState(null);
  const [editTimeAvailability, setEditTimeAvailability] = useState({});
  const [editAreaAvailability, setEditAreaAvailability] = useState({});

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authConfirmationPending, setAuthConfirmationPending] = useState(false);
  const [pendingBookingAfterAuth, setPendingBookingAfterAuth] = useState(false);
  const [reservationName, setReservationName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountFullName, setAccountFullName] = useState("");
  const [savingAccountInfo, setSavingAccountInfo] = useState(false);
  const [accountInfoSaved, setAccountInfoSaved] = useState(false);
  const [accountView, setAccountView] = useState("main"); // "main" | "info" | "payment" | "needs"
  const [bookNeeds, setBookNeeds] = useState(emptyDiningNeeds());
  const [needsOpen, setNeedsOpen] = useState(false);
  const [needsFromAccount, setNeedsFromAccount] = useState(false);
  const [accountNeeds, setAccountNeeds] = useState(emptyDiningNeeds());
  const [savingAccountNeeds, setSavingAccountNeeds] = useState(false);
  const [accountNeedsSaved, setAccountNeedsSaved] = useState(false);
  const [needsDetail, setNeedsDetail] = useState(null); // { booking, needs } | null, for My Bookings
  const allergyInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setReservationName(user?.user_metadata?.reservation_name || "");
    setAccountPhone(user?.user_metadata?.phone || "");
    setAccountFullName(user?.user_metadata?.full_name || "");
    setAccountNeeds({ ...emptyDiningNeeds(), ...(user?.user_metadata?.dining_needs || {}) });
  }, [user]);

  async function handleSaveAccountNeeds() {
    setSavingAccountNeeds(true);
    setAccountNeedsSaved(false);
    const { error } = await supabase.auth.updateUser({ data: { dining_needs: accountNeeds } });
    setSavingAccountNeeds(false);
    if (error) {
      console.error("Saving dining needs failed:", error.message);
      alert(authErrorMessage(error, t));
      return;
    }
    setAccountNeedsSaved(true);
  }

  function toggleAccountNeed(key) {
    setAccountNeedsSaved(false);
    setAccountNeeds((prev) => ({ ...prev, [key === "allergy" ? "allergyOn" : key]: !prev[key === "allergy" ? "allergyOn" : key] }));
  }

  function setAccountAllergyText(text) {
    setAccountNeedsSaved(false);
    setAccountNeeds((prev) => ({ ...prev, allergy: text }));
  }

  function toggleBookNeed(key) {
    const stateKey = key === "allergy" ? "allergyOn" : key;
    setBookNeeds((prev) => ({ ...prev, [stateKey]: !prev[stateKey] }));
    setNeedsFromAccount(false);
    if (key === "allergy") {
      requestAnimationFrame(() => allergyInputRef.current?.focus());
    }
  }

  function setBookAllergyText(text) {
    setBookNeeds((prev) => ({ ...prev, allergy: text }));
    setNeedsFromAccount(false);
  }

  async function handleSaveAccountInfo() {
    setSavingAccountInfo(true);
    setAccountInfoSaved(false);
    const trimmedName = accountFullName.trim();
    const trimmedReservation = reservationName.trim();
    const trimmedPhone = accountPhone.trim();
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: trimmedName || null,
        reservation_name: trimmedReservation || null,
        phone: trimmedPhone || null,
      },
    });
    setSavingAccountInfo(false);
    if (error) {
      console.error("Saving account info failed:", error.message);
      alert(authErrorMessage(error, t));
      return;
    }
    setAccountFullName(trimmedName);
    setReservationName(trimmedReservation);
    setAccountPhone(trimmedPhone);
    setAccountInfoSaved(true);
  }

  function resetAuthForm() {
    setAuthEmail("");
    setAuthPassword("");
    setAuthFullName("");
    setAuthPhone("");
    setAuthError("");
    setAuthConfirmationPending(false);
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");

    if (authMode === "signup") {
      const passwordIssue = passwordRuleMessage(authPassword, t);
      if (passwordIssue) {
        setAuthError(passwordIssue);
        return;
      }
      setAuthLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: { data: { full_name: authFullName, phone: authPhone } },
      });
      setAuthLoading(false);
      if (error) {
        setAuthError(authErrorMessage(error, t));
        return;
      }
      if (!data.session) {
        setAuthConfirmationPending(true);
        return;
      }
      resetAuthForm();
      if (pendingBookingAfterAuth) {
        setPendingBookingAfterAuth(false);
        confirmBooking(data.user);
      } else {
        setScreen("home");
      }
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setAuthLoading(false);
    if (error) {
      setAuthError(authErrorMessage(error, t));
      return;
    }
    resetAuthForm();
    if (pendingBookingAfterAuth) {
      setPendingBookingAfterAuth(false);
      confirmBooking(data.user);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setAccountView("main");
    setTab("discover");
    setScreen("home");
  }

  useEffect(() => {
    async function loadRestaurants() {
      const { data, error } = await supabase.from("restaurants").select("*");
      if (error) {
        console.error("Error loading restaurants:", error.message);
      } else {
        setRestaurants(data || []);
      }
      setLoading(false);
    }
    loadRestaurants();
  }, []);

  async function openRestaurant(r) {
    setActive(r);
    setSeatingChoice(NO_PREFERENCE);
    const slots = generateTimeSlots(r.opening_time, r.closing_time);
    setTime(slots[0]);
    const defaultDate = addDays(new Date(), r.min_advance_days ?? 0);
    setBookingDate(toLocalDateStr(defaultDate));
    setParty(2);
    setSelectedTonightTime(null);
    setMenuSheetOpen(false);
    if (user && hasDiningNeeds(accountNeeds)) {
      setBookNeeds(accountNeeds);
      setNeedsFromAccount(true);
    } else {
      setBookNeeds(emptyDiningNeeds());
      setNeedsFromAccount(false);
    }
    setNeedsOpen(false);
    const { data: areaRows } = await supabase
      .from("restaurant_areas")
      .select("*")
      .eq("restaurant_id", r.id)
      .order("created_at");
    setAreas(areaRows || []);
    const { data: forecastRow } = await supabase
      .from("restaurant_forecasts")
      .select("forecast")
      .eq("restaurant_id", r.id)
      .maybeSingle();
    setForecast(forecastRow?.forecast && Object.keys(forecastRow.forecast).length > 0 ? forecastRow.forecast : null);
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", r.id)
      .order("sort_order");
    setMenuItems(data || []);
    setActiveRestaurantRating(null);
    const { data: ratings } = await supabase.from("reviews").select("rating").eq("restaurant_id", r.id);
    if (ratings && ratings.length > 0) {
      const average = ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length;
      setActiveRestaurantRating({ average, count: ratings.length });
    }
    setScreen("restaurant");
  }

  // Real availability per time slot, aggregated across every seating area —
  // only shown when ALL of the restaurant's areas have a configured capacity
  // (including an explicit 0). If even one area is untracked (null/unset
  // capacity), we can't claim a slot is "full" overall, so we deliberately
  // show nothing rather than a misleading partial count.
  async function loadTimeAvailability() {
    if (!active) return;
    if (!allAreasConfigured(areas)) {
      setTimeAvailability({});
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("zone, booking_time")
      .eq("restaurant_id", active.id)
      .eq("booking_date", bookingDate)
      .in("status", ["pending", "confirmed"]);
    const counts = {};
    (data || []).forEach((b) => {
      counts[b.booking_time] = counts[b.booking_time] || {};
      counts[b.booking_time][b.zone] = (counts[b.booking_time][b.zone] || 0) + 1;
    });
    const availability = {};
    generateTimeSlots(active.opening_time, active.closing_time).forEach((slot) => {
      availability[slot] = remainingAcrossAreas(areas, counts[slot] || {});
    });
    setTimeAvailability(availability);
  }

  useEffect(() => {
    if ((screen === "restaurant" || screen === "book") && active) {
      loadTimeAvailability();
    }
  }, [screen, active, areas, bookingDate]);

  // Same shape as loadTimeAvailability above, but hardcoded to *today's*
  // date rather than `bookingDate` — the Restaurant Detail screen's
  // "Tonight" row is always about tonight specifically, regardless of what
  // date the booking flow itself currently defaults to (a restaurant with
  // min_advance_days > 0 defaults `bookingDate` to a later day).
  async function loadTonightAvailability() {
    if (!active) return;
    if (!allAreasConfigured(areas)) {
      setTonightAvailability({});
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("zone, booking_time")
      .eq("restaurant_id", active.id)
      .eq("booking_date", toLocalDateStr(new Date()))
      .in("status", ["pending", "confirmed"]);
    const counts = {};
    (data || []).forEach((b) => {
      counts[b.booking_time] = counts[b.booking_time] || {};
      counts[b.booking_time][b.zone] = (counts[b.booking_time][b.zone] || 0) + 1;
    });
    const availability = {};
    generateTimeSlots(active.opening_time, active.closing_time).forEach((slot) => {
      availability[slot] = remainingAcrossAreas(areas, counts[slot] || {});
    });
    setTonightAvailability(availability);
  }

  useEffect(() => {
    if (screen === "restaurant" && active) {
      loadTonightAvailability();
    }
  }, [screen, active, areas]);

  async function loadAreaAvailability() {
    if (!active || areas.length < 2) {
      setAreaAvailability({});
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("zone")
      .eq("restaurant_id", active.id)
      .eq("booking_date", bookingDate)
      .eq("booking_time", time)
      .in("status", ["pending", "confirmed"]);
    const counts = {};
    (data || []).forEach((b) => {
      counts[b.zone] = (counts[b.zone] || 0) + 1;
    });
    const availability = {};
    areas.forEach((a) => {
      availability[a.name] = isAreaFull(a, counts[a.name] || 0);
    });
    setAreaAvailability(availability);
  }

  useEffect(() => {
    if (screen === "book" && active) {
      loadAreaAvailability();
    }
  }, [screen, active, areas, bookingDate, time]);

  async function confirmBooking(userOverride) {
    const bookingUser = userOverride || user;
    if (!bookingUser) {
      setPendingBookingAfterAuth(true);
      setScreen("authGate");
      return;
    }
    const { area: assignedArea, blocked } = await resolveAssignedArea(
      active.id,
      areas,
      seatingChoice,
      bookingDate,
      time,
      null
    );
    if (blocked) {
      alert(t("zoneJustFilled", { zone: assignedArea || "" }));
      loadAreaAvailability();
      loadTimeAvailability();
      return;
    }
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        restaurant_id: active.id,
        user_id: bookingUser.id,
        guest_name: guestNameFromUser(bookingUser),
        guest_phone: guestPhoneFromUser(bookingUser),
        party_size: party,
        zone: assignedArea,
        occasion: occasion === "None" ? null : occasion,
        booking_time: time,
        booking_date: bookingDate,
        card_last4: cardNumber.slice(-4) || "4242",
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Booking failed:", error.message);
      alert("Something went wrong submitting your booking. Check the console for details.");
      return;
    }
    if (hasDiningNeeds(bookNeeds)) {
      const { error: needsError } = await supabase
        .from("booking_needs")
        .insert(diningNeedsRowForInsert(data.id, bookNeeds));
      if (needsError) {
        console.error("Saving dining needs for this booking failed:", needsError.message);
      }
    }
    setLastBooking(data);
    setScreen("confirmed");
  }

  // The booking ids a user has joined as an added guest (Tab feature) —
  // shared by loadMyBookings (so a guest sees the booking in My Bookings
  // too) and loadTabBookings (so they see its tab).
  async function fetchGuestBookingIds(userId) {
    const { data } = await supabase.from("booking_guests").select("booking_id").eq("user_id", userId);
    return (data || []).map((g) => g.booking_id);
  }

  async function loadMyBookings() {
    if (!user) {
      setMyBookings([]);
      return;
    }
    const selectCols =
      "*, booking_needs(*), booking_guests(id, user_id, guest_name), restaurants(name, area, cancellation_notice_hours, opening_time, closing_time, max_party_size, restaurant_areas(id, name, capacity))";
    const guestBookingIds = await fetchGuestBookingIds(user.id);
    const [{ data: owned }, { data: asGuest }] = await Promise.all([
      supabase.from("bookings").select(selectCols).eq("user_id", user.id).order("created_at", { ascending: false }),
      guestBookingIds.length > 0
        ? supabase.from("bookings").select(selectCols).in("id", guestBookingIds)
        : Promise.resolve({ data: [] }),
    ]);
    const byId = new Map([...(owned || []), ...(asGuest || [])].map((b) => [b.id, b]));
    setMyBookings([...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  }

  // Tab feature — every booking (owned or joined as a guest) that has ever
  // had a tab opened (`receipt_status` not null), split into Current (open)
  // and Past (paid/not paid) on the Tab screen itself.
  async function loadTabBookings() {
    if (!user) {
      setTabBookings([]);
      return;
    }
    setTabLoading(true);
    const selectCols =
      "*, restaurants(name, min_spend_aed, min_spend_nights, accept_tips, tip_percentages, allow_custom_tip), order_items(*), booking_guests(id, user_id, guest_name), booking_payment_choices(*)";
    const guestBookingIds = await fetchGuestBookingIds(user.id);
    const [{ data: owned }, { data: asGuest }] = await Promise.all([
      supabase.from("bookings").select(selectCols).eq("user_id", user.id).not("receipt_status", "is", null),
      guestBookingIds.length > 0
        ? supabase.from("bookings").select(selectCols).in("id", guestBookingIds).not("receipt_status", "is", null)
        : Promise.resolve({ data: [] }),
    ]);
    const byId = new Map([...(owned || []), ...(asGuest || [])].map((b) => [b.id, b]));
    setTabBookings([...byId.values()]);
    setTabLoading(false);
  }

  useEffect(() => {
    loadTabBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (tab === "tab") loadTabBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openTabBookings = tabBookings.filter((b) => b.receipt_status === "open");
  const closedTabBookings = tabBookings
    .filter((b) => b.receipt_status === "paid" || b.receipt_status === "not_paid")
    .sort((a, b) => new Date(b.receipt_paid_at || b.booking_date) - new Date(a.receipt_paid_at || a.booking_date));
  const currentTabBooking = openTabBookings[0] || null;
  const hasOpenTab = openTabBookings.length > 0;

  // Live item and payment-choice updates while the diner is actually
  // looking at their open tab — so "Covered AED …" and a co-guest's new
  // choice show up without a manual refresh.
  useEffect(() => {
    if (!currentTabBooking || !(tab === "tab" && tabView === "current")) return;
    const channel = supabase
      .channel(`order_items_booking_${currentTabBooking.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `booking_id=eq.${currentTabBooking.id}` },
        () => loadTabBookings()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_payment_choices", filter: `booking_id=eq.${currentTabBooking.id}` },
        () => loadTabBookings()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTabBooking?.id, tab, tabView]);

  // Checks, once per login, for a dined booking the customer hasn't reviewed
  // and hasn't dismissed yet, and surfaces it as the rating prompt — this is
  // what makes it appear "the next time the customer opens the app" rather
  // than only when they happen to visit My Bookings.
  useEffect(() => {
    if (!user) {
      setReviewedBookingIds(new Set());
      setRatingPromptBooking(null);
      return;
    }
    let cancelled = false;
    async function checkForRatingPrompt() {
      const { data: reviews } = await supabase.from("reviews").select("booking_id").eq("user_id", user.id);
      if (cancelled) return;
      const reviewedSet = new Set((reviews || []).map((r) => r.booking_id));
      setReviewedBookingIds(reviewedSet);

      const { data: dined } = await supabase
        .from("bookings")
        .select("*, restaurants(name)")
        .eq("user_id", user.id)
        .eq("status", "dined");
      if (cancelled) return;
      const dismissed = getDismissedRatingIds();
      const candidate = (dined || []).find((b) => !reviewedSet.has(b.id) && !dismissed.includes(b.id));
      if (candidate) setRatingPromptBooking(candidate);
    }
    checkForRatingPrompt();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function openRatingPrompt(booking) {
    setRatingValue(0);
    setRatingComment("");
    setRatingSubmitted(false);
    setRatingPromptBooking(booking);
  }

  function dismissRatingPrompt() {
    if (ratingPromptBooking) dismissRatingPromptId(ratingPromptBooking.id);
    setRatingPromptBooking(null);
  }

  async function submitRating() {
    if (!ratingPromptBooking || ratingValue === 0) return;
    setSubmittingRating(true);
    const { error } = await supabase.from("reviews").insert({
      booking_id: ratingPromptBooking.id,
      restaurant_id: ratingPromptBooking.restaurant_id,
      user_id: user.id,
      rating: ratingValue,
      comment: ratingComment.trim() || null,
    });
    setSubmittingRating(false);
    if (error) {
      console.error("Submitting rating failed:", error.message);
      alert(t("authServerError"));
      return;
    }
    setReviewedBookingIds((prev) => new Set(prev).add(ratingPromptBooking.id));
    dismissRatingPromptId(ratingPromptBooking.id);
    setRatingSubmitted(true);
    setTimeout(() => setRatingPromptBooking(null), 1500);
  }

  function shareBooking(booking) {
    const url = `${window.location.origin}/booking/${booking.id}`;
    const restaurantName = booking.restaurants?.name || active?.name || "our table";
    if (navigator.share) {
      navigator.share({ title: "My reservation", text: `Join me at ${restaurantName}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied — send it to your friends!");
    }
  }

  async function cancelBooking(booking) {
    const confirmMsg =
      booking.status === "confirmed" ? t("confirmCancelReservation") : t("confirmCancelRequest");
    if (!confirm(confirmMsg)) return;
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    loadMyBookings();
  }

  function handleEditClick(booking) {
    if (!canFreelyCancel(booking, booking.restaurants?.cancellation_notice_hours ?? 2)) {
      alert(t("editWindowClosed", { hours: booking.restaurants?.cancellation_notice_hours ?? 2 }));
      return;
    }
    setEditingBooking(booking);
    setEditParty(booking.party_size);
    setEditTime(booking.booking_time);
    setEditZone(booking.zone);
  }

  async function loadEditTimeAvailability(booking) {
    const r = booking.restaurants;
    const editAreas = r.restaurant_areas || [];
    if (!allAreasConfigured(editAreas)) {
      setEditTimeAvailability({});
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("zone, booking_time")
      .eq("restaurant_id", booking.restaurant_id)
      .eq("booking_date", booking.booking_date)
      .in("status", ["pending", "confirmed"])
      .neq("id", booking.id);
    const counts = {};
    (data || []).forEach((x) => {
      counts[x.booking_time] = counts[x.booking_time] || {};
      counts[x.booking_time][x.zone] = (counts[x.booking_time][x.zone] || 0) + 1;
    });
    const availability = {};
    generateTimeSlots(r.opening_time, r.closing_time).forEach((slot) => {
      availability[slot] = remainingAcrossAreas(editAreas, counts[slot] || {});
    });
    setEditTimeAvailability(availability);
  }

  async function loadEditAreaAvailability(booking, time) {
    const r = booking.restaurants;
    const editAreas = r.restaurant_areas || [];
    if (editAreas.length < 2) {
      setEditAreaAvailability({});
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("zone")
      .eq("restaurant_id", booking.restaurant_id)
      .eq("booking_date", booking.booking_date)
      .eq("booking_time", time)
      .in("status", ["pending", "confirmed"])
      .neq("id", booking.id);
    const counts = {};
    (data || []).forEach((x) => {
      counts[x.zone] = (counts[x.zone] || 0) + 1;
    });
    const availability = {};
    editAreas.forEach((a) => {
      availability[a.name] = isAreaFull(a, counts[a.name] || 0);
    });
    setEditAreaAvailability(availability);
  }

  useEffect(() => {
    if (editingBooking) {
      loadEditTimeAvailability(editingBooking);
    }
  }, [editingBooking]);

  useEffect(() => {
    if (editingBooking && editTime) {
      loadEditAreaAvailability(editingBooking, editTime);
    }
  }, [editingBooking, editTime]);

  async function submitEditBooking() {
    const editAreas = editingBooking.restaurants?.restaurant_areas || [];
    const { area: assignedArea, blocked } = await resolveAssignedArea(
      editingBooking.restaurant_id,
      editAreas,
      editZone,
      editingBooking.booking_date,
      editTime,
      editingBooking.id
    );
    if (blocked) {
      alert(t("zoneJustFilled", { zone: assignedArea || "" }));
      loadEditAreaAvailability(editingBooking, editTime);
      return;
    }

    await supabase.from("bookings").update({ status: "edited" }).eq("id", editingBooking.id);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        restaurant_id: editingBooking.restaurant_id,
        user_id: user.id,
        guest_name: editingBooking.guest_name,
        guest_phone: editingBooking.guest_phone,
        party_size: editParty,
        zone: assignedArea,
        occasion: editingBooking.occasion,
        booking_time: editTime,
        booking_date: editingBooking.booking_date,
        card_last4: editingBooking.card_last4,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Edit booking failed:", error.message);
      alert("Something went wrong submitting your change. Check the console for details.");
      return;
    }

    // `booking_needs.booking_id` is that table's primary key, so PostgREST
    // embeds it as a single object (or null), not an array — see the same
    // note on NeedsIcons in app/dashboard/page.js.
    const existingNeeds = editingBooking.booking_needs;
    if (existingNeeds) {
      const { error: needsError } = await supabase.from("booking_needs").insert({
        booking_id: data.id,
        wheelchair: existingNeeds.wheelchair,
        high_chair: existingNeeds.high_chair,
        allergy: existingNeeds.allergy,
        allergy_detail: existingNeeds.allergy_detail,
      });
      if (needsError) {
        console.error("Carrying over dining needs to the edited booking failed:", needsError.message);
      }
    }

    setEditingBooking(null);
    setBookingsView("current");
    await loadMyBookings();
  }

  useEffect(() => {
    if (tab === "myBookings") {
      loadMyBookings();
    }
  }, [tab, user]);

  const filtered = restaurants.filter(
    (r) =>
      query.trim() === "" ||
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      (r.cuisine || "").toLowerCase().includes(query.toLowerCase())
  );

  const currentBookings = myBookings.filter((b) => b.status === "pending" || b.status === "confirmed");
  const pastBookings = myBookings.filter((b) =>
    ["dined", "no-show", "cancelled", "declined", "edited"].includes(b.status)
  );
  const visibleBookings = bookingsView === "current" ? currentBookings : pastBookings;

  const trackingTimeAvailability = Object.keys(timeAvailability).length > 0;

  // Busyness label for the selected date+time: the higher of BestTime's
  // cached forecast and Held's own occupancy (seats booked / total
  // configured capacity) for that slot. null when neither signal exists,
  // which the render below treats as "show nothing".
  const bestTimeValue = bestTimeValueForSlot(forecast, bookingDate, time);
  const occupancyPct = trackingTimeAvailability
    ? occupancyPctForSlot(areas, timeAvailability[time])
    : null;
  const busynessValue = combineBusyness(bestTimeValue, occupancyPct);
  const busynessLevelForSlot = busynessLevel(busynessValue);

  const dateStripDays = active
    ? generateDateStrip(active.min_advance_days, active.max_advance_days, lang === "ar" ? "ar" : "en-US")
    : [];

  // Defends against the selected date ever being off-strip or unset (which
  // would otherwise show the strip with no day highlighted) — falls back to
  // the first bookable date — and scrolls that selected day into view
  // whenever the Booking screen opens, since its default scroll position is
  // 0 but RTL and future-dated windows don't always put the selected day
  // there visually.
  useEffect(() => {
    if (screen !== "book" || dateStripDays.length === 0) return;
    if (!dateStripDays.some((d) => d.value === bookingDate)) {
      setBookingDate(dateStripDays[0].value);
      return;
    }
    const frame = requestAnimationFrame(() => {
      dateStripRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({
        inline: "center",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, active, bookingDate]);

  // Two-step time picker: hours grouped from the same real slot list the old
  // chip grid used, so the eventual `time` value (and saved booking_time) is
  // byte-for-byte identical to before — only how it's picked changed.
  const hourGroups = active ? groupSlotsByHour(generateTimeSlots(active.opening_time, active.closing_time)) : [];
  const selectedHourLabel = hourLabelOfSlot(time);
  const selectedHourGroup = hourGroups.find((g) => g.label === selectedHourLabel);

  function isSlotFull(slot) {
    return trackingTimeAvailability && timeAvailability[slot] === 0;
  }
  function isHourDisabled(group) {
    return trackingTimeAvailability && group.slots.every((s) => isSlotFull(s.full));
  }
  function selectHour(group) {
    const pick = group.slots.find((s) => !isSlotFull(s.full)) || group.slots[0];
    if (pick) setTime(pick.full);
  }

  // Defends against `time` ever being unset, off the real slot list, or
  // pointing at a now-full slot (e.g. after changing the date) — same
  // "always something selected" pattern as the date-strip fix above — by
  // falling back to the first genuinely available slot.
  useEffect(() => {
    if (screen !== "book" || hourGroups.length === 0) return;
    const flatSlots = hourGroups.flatMap((g) => g.slots.map((s) => s.full));
    if (!flatSlots.includes(time) || isSlotFull(time)) {
      const firstAvailable = flatSlots.find((s) => !isSlotFull(s)) || flatSlots[0];
      if (firstAvailable && firstAvailable !== time) setTime(firstAvailable);
      return;
    }
    const frame = requestAnimationFrame(() => {
      hourStripRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({
        inline: "center",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, active, bookingDate, timeAvailability]);

  const accountDisplayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || t("guest");
  const accountAvatarInitial = accountDisplayName.trim().charAt(0).toUpperCase() || "?";

  // Restaurant Detail screen — derived from `active`/`areas`/`tonightAvailability`,
  // computed fresh each render rather than cached in state since none of this
  // changes the booking flow's own state until the diner actually taps "Book".
  const isRestaurantDetailScreen = tab === "discover" && screen === "restaurant";
  const isOpen = active ? isOpenNow(active.opening_time, active.closing_time) : false;
  const tonightSlots = active
    ? generateTimeSlots(active.opening_time, active.closing_time)
        .filter((slot) => isSlotUpcoming(slot, active.opening_time, active.closing_time))
        .filter((slot) => tonightAvailability[slot] !== 0)
        .map((slot) => {
          const [slotTime, slotPeriod] = slot.split(" ");
          const occupancy = occupancyPctForSlot(areas, tonightAvailability[slot]);
          return { slot, time: slotTime, period: slotPeriod, almostFull: occupancy != null && occupancy >= 80 };
        })
    : [];
  const visibleMenuItems = menuItems.filter((m) => !m.staff_only);
  const menuPhotoItems = visibleMenuItems.filter((m) => m.photo_url);
  const lowestMenuPrice =
    visibleMenuItems.length > 0 ? Math.min(...visibleMenuItems.map((m) => m.price_aed)) : null;
  const minSpendTonightActive =
    !!active && active.min_spend_aed > 0 && (active.min_spend_nights || []).includes(new Date().getDay());

  function openDirections() {
    if (!active) return;
    const query = active.address || `${active.name}, ${active.area}`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
  }

  function handleBookTap() {
    if (selectedTonightTime) {
      setBookingDate(toLocalDateStr(new Date()));
      setTime(selectedTonightTime);
    }
    setScreen("book");
  }

  return (
    <div
      className={`mx-auto min-h-screen bg-cream pb-28 relative flex flex-col ${
        isRestaurantDetailScreen ? "max-w-[600px] px-6" : "max-w-md px-5"
      }`}
    >
      {tab === "discover" && screen === "home" && (
        <>
          <div className="font-serif text-[52px] font-extrabold text-burgundy leading-none pt-6">Held</div>
          <div className="w-8 h-0.5 bg-brass my-3.5" />
          <p className="text-sm mb-5 text-muted">{t("subheadline")}</p>

          <div className="flex items-center gap-2 rounded-full px-4 py-3 mb-5 bg-card border border-tan">
            <Search size={16} className="text-taupe" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
            />
          </div>

          {loading && <p className="text-sm text-muted">{t("loadingRestaurants")}</p>}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted py-8 text-center">{t("noRestaurants")}</p>
          )}

          <div className="flex flex-col gap-4">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => openRestaurant(r)}
                className="w-full text-left rounded-[20px] p-3.5 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]"
              >
                <div className="font-serif text-base text-charcoal">{r.name}</div>
                <div className="text-xs mt-1 text-muted">
                  {r.cuisine} · {r.area} · {r.price_tier}
                </div>
                {r.subscription_status === "trial" && (
                  <span className="inline-block text-[10px] font-semibold rounded-full px-2.5 py-1 mt-2 border border-brass text-brass">
                    {t("trialPartner")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "discover" && screen === "restaurant" && active && (
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setScreen("home")} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
              <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
            </button>
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="text-xs text-taupe font-medium py-2"
            >
              {lang === "en" ? "العربية" : "English"}
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted mb-2">
            {activeRestaurantRating && (
              <>
                <span className="flex items-center gap-1" style={{ direction: "ltr" }}>
                  <RatingStar average={activeRestaurantRating.average} size={13} />
                  <span className="font-bold text-charcoal">{activeRestaurantRating.average.toFixed(1)}</span>
                </span>
                <span className="text-taupe">·</span>
              </>
            )}
            <span>{active.cuisine}</span>
            <span className="text-taupe">·</span>
            <span>{active.price_tier}</span>
          </div>

          <h1 className="font-serif text-charcoal leading-tight text-[30px] sm:text-[38px]">{active.name}</h1>
          <div className="w-10 h-[3px] rounded-full bg-brass mt-3 mb-4" />

          <div className="flex flex-wrap gap-2 mb-7">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-tan bg-card px-3.5 py-2 text-xs">
              <Clock size={14} className={isOpen ? "text-green-700" : "text-taupe"} />
              {isOpen ? (
                <span>
                  <span className="text-green-700 font-semibold">{t("openStatus")}</span>{" "}
                  <span className="text-charcoal">
                    {formatClockLabel(active.opening_time, t)} {t("to")} {formatClockLabel(active.closing_time, t)}
                  </span>
                </span>
              ) : (
                <span className="text-taupe font-semibold">{t("closedStatus")}</span>
              )}
            </div>
            <button
              type="button"
              onClick={openDirections}
              className="inline-flex items-center gap-1.5 rounded-full border border-tan bg-card px-3.5 py-2 text-xs text-charcoal"
            >
              <MapPin size={14} className="text-taupe flex-shrink-0" />
              <span>
                {active.area}, Dubai <span className="text-taupe">· {t("directions")}</span>
              </span>
            </button>
          </div>

          {tonightSlots.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("tonightLabel")}</span>
                <span className="text-xs text-taupe">{t("timesOpenCount", { count: tonightSlots.length })}</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1" style={EDGE_FADE_STYLE}>
                {tonightSlots.map((s, i) => {
                  const selected = selectedTonightTime === s.slot;
                  return (
                    <button
                      key={s.slot}
                      type="button"
                      onClick={() => setSelectedTonightTime(s.slot)}
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={`motion-safe:animate-fade-up shrink-0 min-w-[64px] rounded-2xl px-3.5 py-3 flex flex-col items-center ${
                        selected ? "bg-burgundy text-offwhite" : "bg-card border border-tan text-charcoal"
                      }`}
                    >
                      <span className="text-base font-bold">{s.time}</span>
                      {s.almostFull ? (
                        <span className={`text-[10px] font-semibold mt-0.5 ${selected ? "text-offwhite" : "text-brass"}`}>
                          {t("almostFull")}
                        </span>
                      ) : (
                        <span className={`text-[10px] mt-0.5 ${selected ? "text-offwhite/70" : "text-taupe"}`}>
                          {s.period}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-taupe mt-2 mb-7">{t("pickAnotherDayHint")}</p>
            </>
          )}

          {visibleMenuItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuSheetOpen(true)}
              className="w-full flex items-center gap-3 rounded-2xl bg-card border border-tan px-4 py-3.5 mb-7"
            >
              {menuPhotoItems.length > 0 && (
                <div className="flex flex-shrink-0">
                  {menuPhotoItems.slice(0, 3).map((m, i) => (
                    <img
                      key={m.id}
                      src={m.photo_url}
                      alt=""
                      className={`w-10 h-10 rounded-full object-cover border-2 border-card ${i > 0 ? "-ms-3" : ""}`}
                    />
                  ))}
                </div>
              )}
              <div className="flex-1 min-w-0 text-start">
                <div className="font-serif text-base text-charcoal">{t("viewMenu")}</div>
                <div className="text-xs text-taupe">
                  {t("dishesFromPrice", { count: visibleMenuItems.length, price: lowestMenuPrice })}
                </div>
              </div>
              <ChevronRight size={18} className="text-taupe rtl:rotate-180 flex-shrink-0" />
            </button>
          )}

          <div className="h-28" />
        </div>
      )}

      {tab === "discover" && screen === "book" && active && (
        <div className="pt-[calc(20px+env(safe-area-inset-top))]">
          <button onClick={() => setScreen("restaurant")} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-xl mt-2 text-charcoal">
            {t("reserveAt")} <span className="italic text-burgundy">{active.name}</span>
          </h2>
          <div className="w-8 h-0.5 bg-brass my-3.5" />

          <label className="block text-[11px] font-bold uppercase tracking-widest text-taupe">{t("date")}</label>
          <div
            ref={dateStripRef}
            className="flex snap-x snap-mandatory overflow-x-auto mt-3 mb-7 pb-1"
            style={EDGE_FADE_STYLE}
          >
            {dateStripDays.map((d) => {
              const selected = bookingDate === d.value;
              const isPast = d.value < toLocalDateStr(new Date());
              return (
                <button
                  key={d.value}
                  data-selected={selected}
                  onClick={() => setBookingDate(d.value)}
                  className={`flex min-w-0 flex-[0_0_calc(100%/7)] snap-start flex-col items-center gap-1.5 ${
                    isPast ? "opacity-35" : ""
                  }`}
                >
                  <span className="w-full truncate text-center text-sm text-taupe">
                    {lang === "ar" ? d.weekday : d.weekday.slice(0, 2)}
                  </span>
                  <span
                    className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-[18px] ${
                      selected ? "bg-burgundy text-offwhite" : "text-charcoal"
                    }`}
                  >
                    {d.day}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-taupe">{t("partySize")}</label>
          <div
            className={`flex items-center justify-between mt-3 rounded-2xl px-4 py-3 bg-card ${
              party >= (active.max_party_size ?? 14) ? "mb-2" : "mb-7"
            }`}
          >
            <span className="text-sm font-semibold text-charcoal flex items-center gap-2">
              <Users size={14} /> {t("partySize")}
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setParty(Math.max(1, party - 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-tan text-burgundy text-lg"
              >
                −
              </button>
              <div className="text-base font-semibold text-charcoal min-w-[16px] text-center">{party}</div>
              <button
                type="button"
                onClick={() => setParty(Math.min(active.max_party_size ?? 14, party + 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-tan text-burgundy text-lg"
              >
                +
              </button>
            </div>
          </div>
          {party >= (active.max_party_size ?? 14) && (
            <p className="text-[11px] text-taupe mb-7">
              {t("partySizeMaxNote", { max: active.max_party_size ?? 14 })}
            </p>
          )}

          <label className="block text-[11px] font-bold uppercase tracking-widest text-taupe">{t("timeTonight")}</label>
          <div className="mt-3 mb-7">
            <div ref={hourStripRef} className="flex gap-2 overflow-x-auto pb-1" style={EDGE_FADE_STYLE}>
              {hourGroups.map((group) => {
                const disabled = isHourDisabled(group);
                const selected = group.label === selectedHourLabel;
                return (
                  <button
                    key={group.label}
                    data-selected={selected}
                    disabled={disabled}
                    onClick={() => selectHour(group)}
                    className={`shrink-0 min-w-[58px] rounded-2xl px-3 py-2.5 text-xs font-semibold ${
                      disabled
                        ? "bg-tan/50 text-taupe opacity-60 cursor-not-allowed"
                        : selected
                        ? "bg-burgundy text-offwhite"
                        : "bg-tan text-charcoal"
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {["00", "30"].map((minute) => {
                const slot = selectedHourGroup?.slots.find((s) => s.minute === minute);
                const disabled = !slot || isSlotFull(slot.full);
                const selected = !!slot && slot.full === time;
                return (
                  <button
                    key={minute}
                    disabled={disabled}
                    onClick={() => slot && setTime(slot.full)}
                    className={`rounded-2xl py-2.5 text-xs font-semibold ${
                      disabled
                        ? "bg-tan/50 text-taupe opacity-60 cursor-not-allowed"
                        : selected
                        ? "bg-burgundy text-offwhite"
                        : "bg-tan text-charcoal"
                    }`}
                  >
                    :{minute}
                  </button>
                );
              })}
            </div>

            {busynessLevelForSlot && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i < BUSYNESS_DOT_COUNT[busynessLevelForSlot] ? "bg-brass" : "bg-tan"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-taupe">
                  {t(`busy${busynessLevelForSlot[0].toUpperCase()}${busynessLevelForSlot.slice(1)}`, { time })}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-b border-charcoal/[0.08] mb-7">
            <button
              type="button"
              onClick={() => setNeedsOpen((v) => !v)}
              aria-expanded={needsOpen}
              className="w-full flex items-center gap-2.5 py-3 text-start"
            >
              <span
                className={`w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 bg-tan text-burgundy transition-transform duration-300 ${
                  needsOpen ? "rotate-45" : ""
                }`}
              >
                <Plus size={14} strokeWidth={2.6} />
              </span>
              <span className="text-sm">
                <span className="font-semibold text-charcoal">{t("diningNeedsPrompt")}</span>{" "}
                <span className="text-muted">{t("optionalLabel")}</span>
              </span>
              {!needsOpen && hasDiningNeeds(bookNeeds) && (
                <span className="ms-auto flex items-center gap-1.5 max-w-[55%]">
                  <span className="flex items-center gap-1 text-burgundy flex-shrink-0">
                    {bookNeeds.wheelchair && <Accessibility size={16} />}
                    {bookNeeds.highChair && <Baby size={16} />}
                    {bookNeeds.allergyOn && <Nut size={16} />}
                  </span>
                  <span className="text-xs text-muted text-end truncate">
                    {diningNeedsSummary(bookNeeds, t, lang)}
                  </span>
                </span>
              )}
            </button>
            <div
              style={{
                gridTemplateRows: needsOpen ? "1fr" : "0fr",
                transition: "grid-template-rows .35s cubic-bezier(.22,1,.36,1)",
              }}
              className="grid"
            >
              <div className="overflow-hidden">
                <div className="pb-4">
                  <DiningNeedsFields
                    needs={bookNeeds}
                    onToggle={toggleBookNeed}
                    onAllergyChange={setBookAllergyText}
                    t={t}
                    allergyInputRef={allergyInputRef}
                  />
                  {needsFromAccount && diningNeedsSummary(bookNeeds, t, lang) && (
                    <p className="text-xs text-muted mt-2.5">{t("filledFromAccount")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <SeatingPreferenceSection
            areas={areas}
            availability={areaAvailability}
            selected={seatingChoice}
            onSelect={setSeatingChoice}
            t={t}
          />

          <label className="block text-[11px] font-bold uppercase tracking-widest text-taupe">{t("celebrating")}</label>
          <div className="grid grid-cols-4 gap-2 mt-3 mb-7">
            {OCCASIONS.map((o) => {
              const Icon = o.icon;
              const selected = occasion === o.label;
              return (
                <button
                  key={o.label}
                  onClick={() => setOccasion(o.label)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] font-medium ${
                    selected ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                  }`}
                >
                  {Icon ? <Icon size={14} /> : <span className="h-[14px]" />}
                  {t(o.key)}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setScreen("hold")}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]"
          >
            {t("continueSeating")}
          </button>
        </div>
      )}

      {tab === "discover" && screen === "hold" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("book")} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <div className="flex items-center gap-2 mt-2 mb-1">
            <ShieldCheck size={18} className="text-burgundy" />
            <h2 className="font-serif text-xl text-charcoal">{t("secureTable")}</h2>
          </div>
          {active.no_show_fee_aed > 0 && (
            <div className="mb-6">
              <p className="text-xs text-taupe">
                {t("noShowFeeLine", { fee: active.no_show_fee_aed })}
              </p>
              <p className="text-xs text-taupe">
                {t("freeCancelLine", {
                  hours: active.cancellation_notice_hours ?? 2,
                  unit: (active.cancellation_notice_hours ?? 2) === 1 ? t("hourSingular") : t("hourPlural"),
                })}
              </p>
            </div>
          )}

          {active.no_show_fee_aed > 0 && (
            <>
              <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("cardNumber")}</label>
              <div className="flex items-center gap-2 rounded-full px-4 py-3.5 mt-2 mb-6 bg-tan">
                <CreditCard size={16} className="text-muted" />
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                  placeholder="4242 4242 4242 4242"
                  className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
                />
              </div>
            </>
          )}

          <button
            onClick={() => confirmBooking()}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)] mb-3"
          >
            {t("confirmHold")}
          </button>
          {active.no_show_fee_aed > 0 && (
            <p className="text-[11px] text-center text-taupe">{t("cardDisclaimer")}</p>
          )}
        </div>
      )}

      {tab === "discover" && screen === "authGate" && (
        <div className="pt-4 flex-1 flex flex-col">
          <button
            onClick={() => {
              setPendingBookingAfterAuth(false);
              resetAuthForm();
              setScreen("hold");
            }}
            className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium"
          >
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-xl mt-2 mb-5 text-charcoal">{t("signInToBook")}</h2>
          <CustomerAuthForm
            mode={authMode}
            setMode={setAuthMode}
            email={authEmail}
            setEmail={setAuthEmail}
            password={authPassword}
            setPassword={setAuthPassword}
            fullName={authFullName}
            setFullName={setAuthFullName}
            phone={authPhone}
            setPhone={setAuthPhone}
            error={authError}
            loading={authLoading}
            confirmationPending={authConfirmationPending}
            onSubmit={handleAuthSubmit}
            t={t}
          />
        </div>
      )}

      {tab === "discover" && screen === "confirmed" && lastBooking && (
        <div className="flex flex-col items-center justify-center text-center pt-24">
          <div className="w-[76px] h-[76px] rounded-full flex items-center justify-center mb-6 bg-burgundy shadow-[0_8px_20px_rgba(74,23,41,0.25)]">
            <Check className="text-offwhite" size={30} />
          </div>
          <h2 className="font-serif text-2xl mb-1 text-charcoal">
            {t("tableRequested")}
          </h2>
          <div className="w-8 h-0.5 bg-brass my-3.5" />
          <p className="text-sm mb-7 text-muted max-w-[260px]">
            <span className="italic text-burgundy">{active?.name}</span> {t("hasBeenNotified")}
          </p>
          <div className="w-full rounded-[22px] p-5 text-sm text-left mb-7 bg-card">
            <div className="flex justify-between py-1.5">
              <span className="text-muted">{t("date")}</span>
              <span className="text-charcoal font-medium">{lastBooking.booking_date}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted">{t("seating")}</span>
              <span className="text-charcoal font-medium">{lastBooking.zone}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted">{t("time")}</span>
              <span className="text-charcoal font-medium">{lastBooking.booking_time}</span>
            </div>
            {lastBooking.occasion && (
              <div className="flex justify-between py-1.5">
                <span className="text-muted">{t("occasion")}</span>
                <span className="text-charcoal font-medium">{lastBooking.occasion}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => shareBooking(lastBooking)}
            className="w-full rounded-full py-4 text-sm font-semibold mb-3 flex items-center justify-center gap-2 bg-brass text-charcoal"
          >
            <Share2 size={15} /> {t("shareFriends")}
          </button>
          <button
            onClick={() => setScreen("home")}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]"
          >
            {t("done")}
          </button>
        </div>
      )}

      {tab === "myBookings" && !user && (
        <div className="pt-6 flex-1 flex flex-col">
          <h2 className="font-serif text-2xl mb-2 text-charcoal">{t("myBookings")}</h2>
          <p className="text-sm text-muted mb-6">{t("myBookingsLoginPrompt")}</p>
          <CustomerAuthForm
            mode={authMode}
            setMode={setAuthMode}
            email={authEmail}
            setEmail={setAuthEmail}
            password={authPassword}
            setPassword={setAuthPassword}
            fullName={authFullName}
            setFullName={setAuthFullName}
            phone={authPhone}
            setPhone={setAuthPhone}
            error={authError}
            loading={authLoading}
            confirmationPending={authConfirmationPending}
            onSubmit={handleAuthSubmit}
            t={t}
          />
        </div>
      )}

      {tab === "myBookings" && user && editingBooking && (
        <div className="pt-4 flex-1 flex flex-col">
          <button onClick={() => setEditingBooking(null)} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-xl mt-2 text-charcoal">
            {t("editReservation")} <span className="italic text-burgundy">{editingBooking.restaurants?.name}</span>
          </h2>
          <div className="w-8 h-0.5 bg-brass my-3.5" />
          <p className="text-sm mb-5 text-muted">{editingBooking.booking_date}</p>

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("partySize")}</label>
          <div className="flex items-center justify-between mt-2 mb-5 rounded-2xl px-4 py-3 bg-card">
            <span className="text-sm font-semibold text-charcoal flex items-center gap-2">
              <Users size={14} /> {t("partySize")}
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setEditParty(Math.max(1, editParty - 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-tan text-burgundy text-lg"
              >
                −
              </button>
              <div className="text-base font-semibold text-charcoal min-w-[16px] text-center">{editParty}</div>
              <button
                type="button"
                onClick={() =>
                  setEditParty(Math.min(editingBooking.restaurants?.max_party_size ?? 14, editParty + 1))
                }
                className="w-10 h-10 rounded-full flex items-center justify-center bg-tan text-burgundy text-lg"
              >
                +
              </button>
            </div>
          </div>

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("timeTonight")}</label>
          <div className="grid grid-cols-3 gap-2 mt-2 mb-5">
            {generateTimeSlots(editingBooking.restaurants?.opening_time, editingBooking.restaurants?.closing_time).map(
              (tm) => {
                const remaining = editTimeAvailability[tm];
                const trackingEdit = Object.keys(editTimeAvailability).length > 0;
                const full = trackingEdit && remaining === 0;
                const selected = editTime === tm;
                return (
                  <button
                    key={tm}
                    disabled={full}
                    onClick={() => setEditTime(tm)}
                    className={`rounded-2xl py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5 ${
                      full
                        ? "bg-tan/50 text-taupe opacity-60 cursor-not-allowed"
                        : selected
                        ? "bg-burgundy text-offwhite"
                        : "bg-tan text-charcoal"
                    }`}
                  >
                    {tm}
                    {trackingEdit && (
                      <span className={`text-[9px] font-medium ${full ? "text-warn" : selected ? "text-offwhite/70" : "text-muted"}`}>
                        {full ? t("slotFull") : t("tablesLeft", { count: remaining })}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          <SeatingPreferenceSection
            areas={editingBooking.restaurants?.restaurant_areas || []}
            availability={editAreaAvailability}
            selected={editZone}
            onSelect={setEditZone}
            t={t}
          />

          <button
            onClick={submitEditBooking}
            disabled={editZone !== NO_PREFERENCE && !!editAreaAvailability[editZone]}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)] disabled:opacity-50"
          >
            {t("sendChangeRequest")}
          </button>
        </div>
      )}

      {tab === "myBookings" && user && !editingBooking && (
        <div className="pt-6 flex-1 flex flex-col">
          <h2 className="font-serif text-2xl mb-5 text-charcoal">{t("myBookings")}</h2>

          <div className="flex bg-tan rounded-full p-1 mb-5">
            <button
              onClick={() => setBookingsView("current")}
              className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
                bookingsView === "current" ? "bg-burgundy text-offwhite" : "text-muted"
              }`}
            >
              {t("currentBookings")}
            </button>
            <button
              onClick={() => setBookingsView("past")}
              className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
                bookingsView === "past" ? "bg-burgundy text-offwhite" : "text-muted"
              }`}
            >
              {t("pastBookings")}
            </button>
          </div>

          {visibleBookings.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-taupe text-center px-6">
                {bookingsView === "current" ? t("myBookingsEmpty") : t("pastBookingsEmpty")}
              </p>
            </div>
          ) : (
          <div className="flex flex-col gap-3">
            {visibleBookings.map((b) => {
              const statusInfo =
                b.status === "pending"
                  ? { label: t("awaitingConfirmation"), cls: "text-brass border-brass" }
                  : b.status === "confirmed"
                  ? { label: t("heldStatus"), cls: "text-burgundy border-burgundy" }
                  : b.status === "dined"
                  ? { label: t("dined"), cls: "text-taupe border-taupe" }
                  : b.status === "declined"
                  ? { label: t("declined"), cls: "text-warn border-warn" }
                  : b.status === "cancelled"
                  ? { label: t("cancelled"), cls: "text-warn border-warn" }
                  : b.status === "no-show"
                  ? { label: t("noShowStatus"), cls: "text-warn border-warn" }
                  : b.status === "edited"
                  ? { label: t("editedStatus"), cls: "text-taupe border-taupe" }
                  : { label: b.status, cls: "text-muted border-muted" };
              return (
                <div key={b.id} className="rounded-[20px] p-4 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-serif text-lg text-charcoal flex items-center gap-2">
                      {b.restaurants?.name}
                      <BookingNeedsIcons booking={b} onOpen={(booking, needs) => setNeedsDetail({ booking, needs })} />
                    </div>
                    {b.occasion && (
                      <span className="text-[10px] font-medium rounded-full px-2.5 py-1 border border-brass text-brass">
                        {b.occasion}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mb-3">
                    {b.restaurants?.area} · {b.booking_date} · {b.booking_time} · {b.zone} · {b.party_size} guests
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-3 py-1 border ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                    <button
                      onClick={() => shareBooking(b)}
                      className="flex items-center gap-1 text-xs font-medium rounded-full px-3 py-1.5 bg-tan text-charcoal"
                    >
                      <Share2 size={12} /> {t("share")}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(b.status === "pending" || b.status === "confirmed") && (
                      <button
                        onClick={() => handleEditClick(b)}
                        className="flex-1 text-xs font-medium rounded-full px-3 py-2.5 bg-tan text-charcoal"
                      >
                        {t("edit")}
                      </button>
                    )}
                    {b.user_id === user.id && (b.status === "pending" || b.status === "confirmed") && (
                      <button
                        onClick={() => setGuestsSheetBooking(b)}
                        className="flex-1 text-xs font-medium rounded-full px-3 py-2.5 bg-tan text-charcoal"
                      >
                        {t("addGuests")}
                      </button>
                    )}
                    {canFreelyCancel(b, b.restaurants?.cancellation_notice_hours ?? 2) && (
                      <button
                        onClick={() => cancelBooking(b)}
                        className="flex-1 text-xs font-semibold rounded-full px-3 py-2.5 text-warn underline"
                      >
                        {b.status === "confirmed" ? t("cancelReservation") : t("cancelRequest")}
                      </button>
                    )}
                    {b.status === "dined" && !reviewedBookingIds.has(b.id) && (
                      <button
                        onClick={() => openRatingPrompt(b)}
                        className="flex-1 text-xs font-medium rounded-full px-3 py-2.5 bg-tan text-charcoal"
                      >
                        {t("rateThisBooking")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {tab === "tab" && !user && (
        <div className="pt-6 flex-1 flex flex-col">
          <h2 className="font-serif text-2xl mb-2 text-charcoal">{t("tabNavLabel")}</h2>
          <p className="text-sm text-muted mb-6">{t("tabLoginPrompt")}</p>
          <CustomerAuthForm
            mode={authMode}
            setMode={setAuthMode}
            email={authEmail}
            setEmail={setAuthEmail}
            password={authPassword}
            setPassword={setAuthPassword}
            fullName={authFullName}
            setFullName={setAuthFullName}
            phone={authPhone}
            setPhone={setAuthPhone}
            error={authError}
            loading={authLoading}
            confirmationPending={authConfirmationPending}
            onSubmit={handleAuthSubmit}
            t={t}
          />
        </div>
      )}

      {tab === "tab" && user && (
        <div className="pt-6 flex-1 flex flex-col">
          <h2 className="font-serif text-2xl mb-5 text-charcoal">{t("tabNavLabel")}</h2>

          <div className="flex bg-tan rounded-full p-1 mb-5">
            <button
              onClick={() => {
                setTabView("current");
                setViewingPastTab(null);
              }}
              className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
                tabView === "current" ? "bg-burgundy text-offwhite" : "text-muted"
              }`}
            >
              {t("currentBookings")}
            </button>
            <button
              onClick={() => {
                setTabView("past");
                setViewingPastTab(null);
              }}
              className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
                tabView === "past" ? "bg-burgundy text-offwhite" : "text-muted"
              }`}
            >
              {t("pastBookings")}
            </button>
          </div>

          {tabView === "current" &&
            (currentTabBooking ? (
              <TabReceiptCard
                booking={currentTabBooking}
                currentUserId={user.id}
                statusWord={t("openStatus")}
                lang={lang}
                t={t}
                onOpenPay={setPayingBooking}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-taupe text-center px-6">{t("noOpenTab")}</p>
              </div>
            ))}

          {tabView === "past" &&
            (viewingPastTab ? (
              <div>
                <button
                  onClick={() => setViewingPastTab(null)}
                  className="flex items-center gap-1 text-sm text-burgundy py-2 mb-2 font-medium"
                >
                  <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
                </button>
                <TabReceiptCard
                  booking={viewingPastTab}
                  currentUserId={user.id}
                  statusWord={viewingPastTab.receipt_status === "paid" ? t("receiptPaidStatus") : t("receiptNotPaidStatus")}
                  lang={lang}
                  t={t}
                />
              </div>
            ) : closedTabBookings.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-taupe text-center px-6">{t("pastBookingsEmpty")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {closedTabBookings.map((b) => {
                  const shared = sharedWithNames(b, user.id);
                  const totals = computeReceiptTotals(b, b.restaurants);
                  const paid = b.receipt_status === "paid";
                  return (
                    <button
                      key={b.id}
                      onClick={() => setViewingPastTab(b)}
                      className="w-full text-left rounded-[20px] p-4 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)] flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-serif text-base text-charcoal truncate">{b.restaurants?.name}</div>
                        <div className="text-xs text-muted mt-1">
                          {b.booking_date}
                          {shared ? ` · ${t("withGuest", { name: shared })}` : ""}
                        </div>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <div className="text-sm font-semibold text-charcoal">AED {totals.total}</div>
                        <div className={`text-xs mt-1 ${paid ? "text-green-700" : "text-taupe"}`}>
                          {paid ? t("receiptPaidStatus") : t("receiptNotPaidStatus")}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      )}

      {tab === "account" && (
        <div className="pt-6 flex-1 flex flex-col">
          {!user ? (
            <>
              <h2 className="font-serif text-2xl mb-5 text-charcoal">{t("account")}</h2>
              <p className="text-sm text-muted mb-6">{t("accountLoginPrompt")}</p>
              <CustomerAuthForm
                mode={authMode}
                setMode={setAuthMode}
                email={authEmail}
                setEmail={setAuthEmail}
                password={authPassword}
                setPassword={setAuthPassword}
                fullName={authFullName}
                setFullName={setAuthFullName}
                phone={authPhone}
                setPhone={setAuthPhone}
                error={authError}
                loading={authLoading}
                confirmationPending={authConfirmationPending}
                onSubmit={handleAuthSubmit}
                t={t}
              />
            </>
          ) : accountView === "info" ? (
            <>
              <button
                onClick={() => setAccountView("main")}
                className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium"
              >
                <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
              </button>
              <h2 className="font-serif text-2xl mb-5 mt-2 text-charcoal">{t("accountInfo")}</h2>

              <div className="rounded-[20px] p-4 mb-4 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]">
                <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">
                  {t("fullName")}
                </label>
                <input
                  value={accountFullName}
                  onChange={(e) => {
                    setAccountFullName(e.target.value);
                    setAccountInfoSaved(false);
                  }}
                  className="w-full rounded-full px-4 py-3 text-sm mt-2 outline-none bg-tan text-charcoal placeholder:text-taupe"
                />
              </div>
              <div className="rounded-[20px] p-4 mb-4 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]">
                <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">
                  {t("reservationName")}
                </label>
                <input
                  value={reservationName}
                  onChange={(e) => {
                    setReservationName(e.target.value);
                    setAccountInfoSaved(false);
                  }}
                  placeholder={accountFullName}
                  className="w-full rounded-full px-4 py-3 text-sm mt-2 outline-none bg-tan text-charcoal placeholder:text-taupe"
                />
              </div>
              <div className="rounded-[20px] p-4 mb-4 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]">
                <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">
                  {t("mobileNumber")}
                </label>
                <input
                  value={accountPhone}
                  onChange={(e) => {
                    setAccountPhone(e.target.value);
                    setAccountInfoSaved(false);
                  }}
                  placeholder="+971 5X XXX XXXX"
                  className="w-full rounded-full px-4 py-3 text-sm mt-2 outline-none bg-tan text-charcoal placeholder:text-taupe"
                />
              </div>
              <div className="rounded-[20px] p-4 mb-5 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]">
                <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">
                  {t("email")}
                </label>
                <div className="text-sm text-charcoal mt-2">{user.email}</div>
              </div>

              <button
                onClick={handleSaveAccountInfo}
                disabled={
                  savingAccountInfo ||
                  (accountFullName.trim() === (user.user_metadata?.full_name || "").trim() &&
                    reservationName.trim() === (user.user_metadata?.reservation_name || "").trim() &&
                    accountPhone.trim() === (user.user_metadata?.phone || "").trim())
                }
                className="w-full rounded-full py-3 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60 text-center"
              >
                {savingAccountInfo ? t("saving") : t("saveChanges")}
              </button>
              {accountInfoSaved && (
                <p className="text-xs text-burgundy mt-2 flex items-center justify-center gap-1">
                  <Check size={12} /> {t("saved")}
                </p>
              )}
            </>
          ) : accountView === "needs" ? (
            <>
              <button
                onClick={() => setAccountView("main")}
                className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium"
              >
                <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
              </button>
              <h2 className="font-serif text-2xl mb-1 mt-2 text-charcoal">{t("diningNeeds")}</h2>
              <p className="text-sm text-muted mb-5">{t("diningNeedsAccountSub")}</p>

              <DiningNeedsFields
                needs={accountNeeds}
                onToggle={toggleAccountNeed}
                onAllergyChange={setAccountAllergyText}
                t={t}
              />

              <button
                onClick={handleSaveAccountNeeds}
                disabled={savingAccountNeeds}
                className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60 text-center mt-7"
              >
                {savingAccountNeeds ? t("saving") : t("save")}
              </button>
              {accountNeedsSaved && (
                <p className="text-xs text-burgundy mt-2 flex items-center justify-center gap-1">
                  <Check size={12} /> {t("diningNeedsSavedConfirm")}
                </p>
              )}
            </>
          ) : accountView === "payment" ? (
            <>
              <button
                onClick={() => setAccountView("main")}
                className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium"
              >
                <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
              </button>
              <h2 className="font-serif text-2xl mb-5 mt-2 text-charcoal">{t("paymentMethods")}</h2>
              <div className="rounded-[20px] p-6 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)] text-center">
                <p className="font-serif text-lg text-charcoal mb-2">{t("comingSoon")}</p>
                <p className="text-sm text-muted">{t("paymentMethodsComingSoonBody")}</p>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-serif text-2xl mb-5 text-charcoal">{t("account")}</h2>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-full bg-burgundy text-offwhite flex items-center justify-center font-serif text-xl flex-shrink-0">
                  {accountAvatarInitial}
                </div>
                <div>
                  <div className="font-serif text-lg text-charcoal">{accountDisplayName}</div>
                  <div className="text-xs text-muted">{user.email}</div>
                </div>
              </div>

              <div className="rounded-[20px] bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)] mb-4 divide-y divide-charcoal/[0.06] overflow-hidden">
                <button
                  onClick={() => setAccountView("info")}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-charcoal"
                >
                  <span>{t("accountInfo")}</span>
                  <ChevronRight size={16} className="text-taupe rtl:rotate-180" />
                </button>
                <button
                  onClick={() => setAccountView("payment")}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-charcoal"
                >
                  <span>{t("paymentMethods")}</span>
                  <ChevronRight size={16} className="text-taupe rtl:rotate-180" />
                </button>
                <button
                  onClick={() => setAccountView("needs")}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-charcoal"
                >
                  <span>{t("diningNeeds")}</span>
                  <span className="flex items-center gap-1.5 text-taupe">
                    <span className="max-w-[160px] truncate">
                      {diningNeedsSummary(accountNeeds, t, lang) || t("diningNeedsNone")}
                    </span>
                    <ChevronRight size={16} className="rtl:rotate-180" />
                  </span>
                </button>
                <button
                  onClick={() => setLang(lang === "en" ? "ar" : "en")}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-charcoal"
                >
                  <span>{t("language")}</span>
                  <span className="flex items-center gap-1.5 text-taupe">
                    {lang === "en" ? "عربي" : "English"}
                    <ChevronRight size={16} className="rtl:rotate-180" />
                  </span>
                </button>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full rounded-full px-4 py-3 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)] text-warn text-sm font-medium text-center"
              >
                {t("signOutCustomer")}
              </button>
            </>
          )}
        </div>
      )}

      <div className="fixed left-0 right-0 bottom-0">
        {isRestaurantDetailScreen && (
          <div className="mx-auto w-full max-w-[600px] px-6 pb-2">
            <div className="rounded-[24px] bg-cream/85 backdrop-blur-md border border-tan/60 shadow-[0_8px_24px_rgba(43,31,33,0.18)] px-4 pt-3 pb-3.5">
              {minSpendTonightActive && (
                <div className="text-[11px] text-taupe text-center pb-2 mb-2.5 border-b border-charcoal/[0.08]">
                  {t("minSpendTonight", { amount: active.min_spend_aed })}
                </div>
              )}
              <button
                type="button"
                onClick={handleBookTap}
                className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]"
              >
                {selectedTonightTime ? t("bookForTime", { time: selectedTonightTime }) : t("bookTable")}
              </button>
            </div>
          </div>
        )}
        <div className="bg-cream border-t border-charcoal/[0.08] flex pb-3.5 pt-2">
          <button
            onClick={() => setTab("discover")}
            className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold ${
              tab === "discover" ? "text-burgundy" : "text-taupe"
            }`}
          >
            <Compass size={20} />
            {t("discover")}
          </button>
          <button
            onClick={() => setTab("myBookings")}
            className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold ${
              tab === "myBookings" ? "text-burgundy" : "text-taupe"
            }`}
          >
            <BookMarked size={20} />
            {t("myBookings")}
          </button>
          <button
            onClick={() => setTab("tab")}
            className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold ${
              tab === "tab" ? "text-burgundy" : "text-taupe"
            }`}
          >
            <span className="relative">
              <Receipt size={20} />
              {hasOpenTab && (
                <span className="absolute -top-0.5 -end-0.5 w-2 h-2 rounded-full bg-burgundy" />
              )}
            </span>
            {t("tabNavLabel")}
          </button>
          <button
            onClick={() => setTab("account")}
            className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold ${
              tab === "account" ? "text-burgundy" : "text-taupe"
            }`}
          >
            <User size={20} />
            {t("account")}
          </button>
        </div>
      </div>

      <MenuSheet open={menuSheetOpen} items={visibleMenuItems} t={t} onClose={() => setMenuSheetOpen(false)} />
      <AddGuestsSheet booking={guestsSheetBooking} onClose={() => setGuestsSheetBooking(null)} t={t} />
      <PayTabSheet
        booking={payingBooking}
        userId={user?.id}
        onClose={() => setPayingBooking(null)}
        onSaved={loadTabBookings}
        t={t}
      />

      {ratingPromptBooking && (
        <RatingPromptModal
          booking={ratingPromptBooking}
          value={ratingValue}
          setValue={setRatingValue}
          comment={ratingComment}
          setComment={setRatingComment}
          submitting={submittingRating}
          submitted={ratingSubmitted}
          onSubmit={submitRating}
          onDismiss={dismissRatingPrompt}
          t={t}
        />
      )}
      <NeedsDetailModal detail={needsDetail} onClose={() => setNeedsDetail(null)} t={t} />
    </div>
  );
}
