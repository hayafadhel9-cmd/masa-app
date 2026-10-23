"use client";

import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { Clock, Check, Users, MapPin, CreditCard, Cake, Heart, Briefcase, X } from "lucide-react";
import { relativeDateLabel } from "../../../lib/relativeDate";
import { zoneCapacityInfo } from "../../../lib/zoneCapacity";
import { NeedsBadge, VisitBadge } from "./GuestBadges";
import { toLocalDateStr } from "../../../lib/date";

// Fixed for this pass — Settings (where a real per-restaurant SLA would be
// configured) is a placeholder, so there's nowhere to set this yet.
export const RESPOND_WITHIN_MINUTES = 15;
const URGENT_THRESHOLD_MINUTES = 5;

const OCCASION_ICONS = { Birthday: Cake, Anniversary: Heart, Business: Briefcase };

const DECLINE_REASONS = [
  { key: "fully_booked", labelKey: "declineReasonFullyBooked", msgKey: "declineMsgFullyBooked" },
  { key: "party_size", labelKey: "declineReasonPartySize", msgKey: "declineMsgPartySize" },
  { key: "closed", labelKey: "declineReasonClosed", msgKey: "declineMsgClosed" },
  { key: "other", labelKey: "declineReasonOther", msgKey: "declineMsgOther" },
];

function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || name;
}

export function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl p-4 bg-card">
      <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-1">{label}</div>
      <div className="font-serif text-2xl text-charcoal">{value}</div>
    </div>
  );
}

function DeclineModal({ booking, onClose, onSubmit, t, lang }) {
  const [reason, setReason] = useState(DECLINE_REASONS[0].key);
  if (!booking) return null;
  const def = DECLINE_REASONS.find((r) => r.key === reason);
  const message = t(def.msgKey, {
    time: booking.booking_time,
    count: booking.party_size,
  });

  return (
    <div className="fixed inset-0 z-50 bg-charcoal/50 flex items-center justify-center px-5" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[20px] p-5 bg-cream shadow-[0_8px_30px_rgba(43,31,33,0.25)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-charcoal mb-1">
          {t("declineModalTitle", { name: firstName(booking.guest_name) })}
        </h3>
        <p className="text-xs text-muted mb-4">
          {relativeDateLabel(booking.booking_date, lang, t)}, {booking.booking_time} ·{" "}
          {t("guestsCount", { count: booking.party_size })} · {booking.zone}
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {DECLINE_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setReason(r.key)}
              className={`text-start rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-3 bg-card ${
                reason === r.key ? "ring-2 ring-burgundy" : ""
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  reason === r.key ? "border-burgundy" : "border-taupe"
                }`}
              >
                {reason === r.key && <span className="w-2 h-2 rounded-full bg-burgundy" />}
              </span>
              {t(r.labelKey)}
            </button>
          ))}
        </div>

        <div className="rounded-2xl p-4 bg-card border-s-4 border-brass mb-5">
          <p className="text-xs text-muted mb-1">
            <strong className="text-charcoal">{t("declinePreviewLabel", { name: firstName(booking.guest_name) })}</strong>
          </p>
          <p className="text-sm text-charcoal">{message}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full py-3 text-sm font-semibold bg-tan text-charcoal"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(booking, message)}
            className="flex-1 rounded-full py-3 text-sm font-semibold bg-burgundy text-offwhite"
          >
            {t("declineRequestButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RequestsTab({ bookings, areas, lang, t, reload, showToast, openNeedsModal, visitNumbers }) {
  const [declineTarget, setDeclineTarget] = useState(null);
  const today = toLocalDateStr(new Date());

  const pending = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "pending")
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [bookings]
  );

  const todays = useMemo(
    () => bookings.filter((b) => b.booking_date === today && ["pending", "confirmed", "dined"].includes(b.status)),
    [bookings, today]
  );
  const coversTonight = todays.reduce((sum, b) => sum + b.party_size, 0);
  const arrivedCount = todays.filter((b) => b.arrived || b.status === "dined").length;

  async function handleConfirm(booking) {
    await supabase.from("bookings").update({ status: "confirmed" }).eq("id", booking.id);
    reload();
    showToast(t("confirmedToast", { name: firstName(booking.guest_name) }), async () => {
      await supabase.from("bookings").update({ status: "pending" }).eq("id", booking.id);
      reload();
    });
  }

  async function handleDeclineSubmit(booking, message) {
    setDeclineTarget(null);
    await supabase.from("bookings").update({ status: "declined", decline_reason: message }).eq("id", booking.id);
    reload();
    showToast(t("declinedToast", { name: firstName(booking.guest_name) }), async () => {
      await supabase.from("bookings").update({ status: "pending", decline_reason: null }).eq("id", booking.id);
      reload();
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile label={t("statWaiting")} value={pending.length} />
        <StatTile label={t("statCoversTonight")} value={coversTonight} />
        <StatTile label={t("statArrived")} value={`${arrivedCount} / ${todays.length}`} />
        <StatTile label={t("statRespondWithin")} value={t("minutesShort", { n: RESPOND_WITHIN_MINUTES })} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-taupe flex-shrink-0">
          {t("oldestFirst")}
        </span>
        <div className="h-px bg-charcoal/[0.08] flex-1" />
      </div>

      {pending.length === 0 && <p className="text-sm text-muted py-6 text-center">{t("noNewRequests")}</p>}

      <div className="flex flex-col gap-3">
        {pending.map((b) => {
          const minutesSinceCreated = Math.floor((Date.now() - new Date(b.created_at)) / 60000);
          const minutesLeft = Math.max(0, RESPOND_WITHIN_MINUTES - minutesSinceCreated);
          const urgent = minutesLeft <= URGENT_THRESHOLD_MINUTES;
          const OccasionIcon = b.occasion ? OCCASION_ICONS[b.occasion] : null;
          const capacity = zoneCapacityInfo(b, bookings, areas);
          const visitNumber = visitNumbers.get(b.id);

          return (
            <div key={b.id} className="rounded-2xl p-4 bg-card flex gap-4">
              <div className="flex-shrink-0 w-20 text-center sm:text-start">
                <div className="font-serif text-lg text-charcoal">{b.booking_time}</div>
                <div className="text-xs text-muted">{relativeDateLabel(b.booking_date, lang, t)}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-serif text-base text-charcoal">{b.guest_name}</span>
                  <VisitBadge visitNumber={visitNumber} lang={lang} />
                  <NeedsBadge booking={b} guestName={b.guest_name} onOpen={openNeedsModal} />
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted mb-1">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {t("guestsCount", { count: b.party_size })}
                  </span>
                  {b.zone && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {b.zone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CreditCard size={11} /> {t("cardEnding", { last4: b.card_last4 })}
                  </span>
                  {b.occasion && (
                    <span className="flex items-center gap-1 text-brass font-semibold">
                      {OccasionIcon && <OccasionIcon size={11} />} {t(`occasion${b.occasion}`)}
                    </span>
                  )}
                </div>
                {capacity && (
                  <div className="text-xs text-taupe">
                    {t("seatsTakenLine", { taken: capacity.taken, total: capacity.total, zone: b.zone, time: b.booking_time })}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 flex flex-col items-end justify-between gap-3">
                <div className={`flex items-center gap-1 text-xs ${urgent ? "text-warn font-semibold" : "text-muted"}`}>
                  <Clock size={11} />
                  {t("respondInMin", { n: minutesLeft })} · {t("minAgo", { n: minutesSinceCreated })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeclineTarget(b)}
                    className="rounded-full px-4 py-2 text-xs font-semibold bg-tan text-charcoal"
                  >
                    {t("decline")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirm(b)}
                    className="flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold bg-burgundy text-offwhite"
                  >
                    <Check size={12} /> {t("confirmRequest")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DeclineModal
        booking={declineTarget}
        onClose={() => setDeclineTarget(null)}
        onSubmit={handleDeclineSubmit}
        t={t}
        lang={lang}
      />
    </>
  );
}
