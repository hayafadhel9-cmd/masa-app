"use client";

import { useMemo, useState } from "react";
import { Users, MapPin, Clock, Cake, Heart, Briefcase } from "lucide-react";
import { toLocalDateStr } from "../../../lib/date";
import { getBookingDateTime } from "../../../lib/bookingTime";
import { relativeDateLabel } from "../../../lib/relativeDate";
import { NeedsBadge, VisitBadge } from "./GuestBadges";

const OCCASION_ICONS = { Birthday: Cake, Anniversary: Heart, Business: Briefcase };

function groupByDate(bookings) {
  const map = new Map();
  for (const b of bookings) {
    if (!map.has(b.booking_date)) map.set(b.booking_date, []);
    map.get(b.booking_date).push(b);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function BookingRow({ b, lang, t, openNeedsModal, visitNumbers, rightSide }) {
  const OccasionIcon = b.occasion ? OCCASION_ICONS[b.occasion] : null;
  const visitNumber = visitNumbers.get(b.id);
  return (
    <div className="px-4 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-serif text-base text-charcoal">{b.guest_name}</span>
          <VisitBadge visitNumber={visitNumber} lang={lang} />
          <NeedsBadge booking={b} guestName={b.guest_name} onOpen={openNeedsModal} />
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
          <span className="flex items-center gap-1">
            <Clock size={11} /> {b.booking_time}
          </span>
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
      <div className="flex-shrink-0">{rightSide}</div>
    </div>
  );
}

export default function UpcomingTab({ restaurant, bookings, lang, t, openNeedsModal, visitNumbers }) {
  const [subTab, setSubTab] = useState("comingUp");
  const today = toLocalDateStr(new Date());

  const comingUp = useMemo(
    () =>
      bookings
        .filter((b) => b.booking_date > today && ["pending", "confirmed"].includes(b.status))
        .sort((a, b) => getBookingDateTime(a) - getBookingDateTime(b)),
    [bookings, today]
  );
  const past = useMemo(
    () =>
      bookings
        .filter((b) => ["dined", "no-show"].includes(b.status))
        .sort((a, b) => getBookingDateTime(b) - getBookingDateTime(a)),
    [bookings]
  );

  const groups = groupByDate(subTab === "comingUp" ? comingUp : past);
  const empty = subTab === "comingUp" ? comingUp.length === 0 : past.length === 0;

  return (
    <>
      <div className="inline-flex bg-tan rounded-full p-1 mb-6">
        <button
          type="button"
          onClick={() => setSubTab("comingUp")}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            subTab === "comingUp" ? "bg-burgundy text-offwhite" : "text-charcoal"
          }`}
        >
          {t("comingUpTab")}
        </button>
        <button
          type="button"
          onClick={() => setSubTab("past")}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            subTab === "past" ? "bg-burgundy text-offwhite" : "text-charcoal"
          }`}
        >
          {t("pastTab")}
        </button>
      </div>

      {empty && (
        <p className="text-sm text-muted py-6 text-center">
          {subTab === "comingUp" ? t("noUpcomingBookings") : t("noPastBookings")}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {groups.map(([date, rows]) => {
          const totalGuests = rows.reduce((s, b) => s + b.party_size, 0);
          return (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-taupe flex-shrink-0">
                  {relativeDateLabel(date, lang, t)} · {t("guestsCount", { count: totalGuests })}
                </span>
                <div className="h-px bg-charcoal/[0.08] flex-1" />
              </div>
              <div className="rounded-2xl bg-card divide-y divide-charcoal/[0.06] overflow-hidden">
                {rows.map((b) => {
                  let rightSide;
                  if (subTab === "comingUp") {
                    rightSide = (
                      <span className="rounded-full px-4 py-2 text-xs font-semibold bg-tan text-charcoal">
                        {t("confirmedStatus")}
                      </span>
                    );
                  } else if (b.status === "no-show") {
                    const total = (restaurant.no_show_fee_aed || 0) * b.party_size;
                    rightSide = (
                      <span className="rounded-full px-4 py-2 text-xs font-semibold bg-tan text-taupe">
                        {t("noShowChargedPill", { amount: total })}
                      </span>
                    );
                  } else {
                    rightSide = (
                      <span className="rounded-full px-4 py-2 text-xs font-semibold bg-cream text-charcoal border border-charcoal/10">
                        {t("dined")}
                      </span>
                    );
                  }
                  return (
                    <BookingRow
                      key={b.id}
                      b={b}
                      lang={lang}
                      t={t}
                      openNeedsModal={openNeedsModal}
                      visitNumbers={visitNumbers}
                      rightSide={rightSide}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
