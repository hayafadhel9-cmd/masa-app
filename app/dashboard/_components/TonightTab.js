"use client";

import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { Check, Users, MapPin, Cake, Heart, Briefcase } from "lucide-react";
import { toLocalDateStr } from "../../../lib/date";
import { getBookingDateTime } from "../../../lib/bookingTime";
import { NeedsBadge, VisitBadge } from "./GuestBadges";
import { StatTile } from "./RequestsTab";

const OCCASION_ICONS = { Birthday: Cake, Anniversary: Heart, Business: Briefcase };

function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || name;
}

function NoShowModal({ booking, restaurant, onClose, onConfirm, t }) {
  if (!booking) return null;
  const perGuest = restaurant.no_show_fee_aed || 0;
  const total = perGuest * booking.party_size;
  return (
    <div className="fixed inset-0 z-50 bg-charcoal/50 flex items-center justify-center px-5" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[20px] p-5 bg-cream shadow-[0_8px_30px_rgba(43,31,33,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-charcoal mb-1">
          {t("noShowModalTitle", { name: firstName(booking.guest_name) })}
        </h3>
        <p className="text-xs text-muted mb-4">
          {t("guestsCount", { count: booking.party_size })} · {booking.booking_time}
        </p>
        <p className="text-sm text-charcoal mb-5">
          {t("noShowModalBody", { total, last4: booking.card_last4, count: booking.party_size, perGuest })}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full py-3 text-sm font-semibold bg-tan text-charcoal">
            {t("keepBooking")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(booking, total)}
            className="flex-1 rounded-full py-3 text-sm font-semibold bg-burgundy text-offwhite"
          >
            {t("chargeButton", { total })}
          </button>
        </div>
      </div>
    </div>
  );
}

const RECEIPT_STATUS_STYLE = {
  open: "bg-brass/20 text-charcoal",
  paid: "bg-green-50 text-green-700",
  not_paid: "bg-warn/10 text-warn",
};

function receiptStatusLabel(status, t) {
  if (status === "paid") return t("receiptPaidStatus");
  if (status === "not_paid") return t("receiptNotPaidStatus");
  return t("receiptOpenStatus");
}

export default function TonightTab({ restaurant, bookings, lang, t, reload, showToast, openNeedsModal, openReceipt, visitNumbers }) {
  const [noShowTarget, setNoShowTarget] = useState(null);
  const today = toLocalDateStr(new Date());

  const todays = useMemo(
    () =>
      bookings
        .filter((b) => b.booking_date === today && ["confirmed", "dined", "no-show"].includes(b.status))
        .sort((a, b) => getBookingDateTime(a) - getBookingDateTime(b)),
    [bookings, today]
  );

  const covers = todays
    .filter((b) => b.status !== "no-show")
    .reduce((sum, b) => sum + b.party_size, 0);
  const arrivedCount = todays.filter((b) => b.arrived || b.status === "dined").length;
  const noShowCount = todays.filter((b) => b.status === "no-show").length;

  const groups = useMemo(() => {
    const map = new Map();
    for (const b of todays) {
      if (!map.has(b.booking_time)) map.set(b.booking_time, []);
      map.get(b.booking_time).push(b);
    }
    return [...map.entries()];
  }, [todays]);

  async function handleArrive(booking) {
    // Arriving a guest opens their tab (receipt_status starts 'open') and
    // immediately surfaces the receipt editor — arriving someone is, in
    // practice, the moment staff seat them and start ordering for them.
    await supabase
      .from("bookings")
      .update({ arrived: true, arrived_at: new Date().toISOString(), receipt_status: "open" })
      .eq("id", booking.id);
    await reload();
    openReceipt(booking.id);
  }

  async function handleNoShowConfirm(booking, total) {
    setNoShowTarget(null);
    await supabase.from("bookings").update({ status: "no-show", charged: true }).eq("id", booking.id);
    reload();
    showToast(t("noShowToast", { total }), null);
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile label={t("statBookings")} value={todays.length} />
        <StatTile label={t("statCovers")} value={covers} />
        <StatTile label={t("statArrived")} value={arrivedCount} />
        <StatTile label={t("statNoShows")} value={noShowCount} />
      </div>

      {todays.length === 0 && <p className="text-sm text-muted py-6 text-center">{t("noBookingsTonight")}</p>}

      <div className="flex flex-col gap-4">
        {groups.map(([time, rows]) => (
          <div key={time} className="rounded-2xl bg-card overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-baseline gap-2">
              <span className="font-serif text-lg text-charcoal">{time}</span>
              <span className="text-xs text-muted">{t("guestsCount", { count: rows.reduce((s, b) => s + b.party_size, 0) })}</span>
            </div>
            <div className="divide-y divide-charcoal/[0.06]">
              {rows.map((b) => {
                const OccasionIcon = b.occasion ? OCCASION_ICONS[b.occasion] : null;
                const visitNumber = visitNumbers.get(b.id);
                const hasArrived = b.arrived || b.status === "dined";
                return (
                  <div key={b.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-serif text-base text-charcoal">{b.guest_name}</span>
                        <VisitBadge visitNumber={visitNumber} lang={lang} />
                        <NeedsBadge booking={b} guestName={b.guest_name} onOpen={openNeedsModal} />
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {t("guestsCount", { count: b.party_size })}
                        </span>
                        {b.zone && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {b.zone}
                          </span>
                        )}
                        {b.occasion && (
                          <span className="flex items-center gap-1 text-brass font-semibold">
                            {OccasionIcon && <OccasionIcon size={11} />} {t(`occasion${b.occasion}`)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {b.status === "no-show" ? (
                        <span className="rounded-full px-4 py-2 text-xs font-semibold bg-tan text-taupe">
                          {t("noShowButton")}
                        </span>
                      ) : hasArrived ? (
                        <button
                          type="button"
                          onClick={() => openReceipt(b.id)}
                          className={`rounded-full px-4 py-2 text-xs font-semibold ${RECEIPT_STATUS_STYLE[b.receipt_status || "open"]}`}
                        >
                          {receiptStatusLabel(b.receipt_status, t)}
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setNoShowTarget(b)}
                            className="rounded-full px-4 py-2 text-xs font-semibold bg-tan text-charcoal"
                          >
                            {t("noShowButton")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArrive(b)}
                            className="flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold bg-burgundy text-offwhite"
                          >
                            <Check size={12} /> {t("arrivedButton")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <NoShowModal
        booking={noShowTarget}
        restaurant={restaurant}
        onClose={() => setNoShowTarget(null)}
        onConfirm={handleNoShowConfirm}
        t={t}
      />
    </>
  );
}
