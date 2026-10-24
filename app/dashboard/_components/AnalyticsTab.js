"use client";

import { useMemo, useState } from "react";
import { toLocalDateStr, addDays } from "../../../lib/date";
import { computeReceiptTotals, minSpendApplies } from "../../../lib/receipts";
import { generateTimeSlots, groupSlotsByHour, hourLabelOfSlot } from "../../../lib/timeSlots";
import { StatTile } from "./RequestsTab";

const PERIODS = [
  { key: "today", labelKey: "periodToday" },
  { key: "week", labelKey: "periodWeek" },
  { key: "month", labelKey: "periodMonth" },
];

// "This week"/"this month" are rolling windows ending today (last 7 / 30
// days, today included) rather than calendar week/month — sidesteps
// locale-specific week-start conventions (Fri/Sat weekend vs Sun-start)
// without needing to encode one.
function periodRange(period) {
  const today = toLocalDateStr(new Date());
  if (period === "today") return [today, today];
  if (period === "week") return [toLocalDateStr(addDays(new Date(), -6)), today];
  return [toLocalDateStr(addDays(new Date(), -29)), today];
}

export default function AnalyticsTab({ restaurant, bookings, t }) {
  const [period, setPeriod] = useState("today");
  const [start, end] = periodRange(period);

  const served = useMemo(
    () => bookings.filter((b) => b.booking_date >= start && b.booking_date <= end && b.receipt_status),
    [bookings, start, end]
  );

  const totalsPerBooking = useMemo(() => served.map((b) => computeReceiptTotals(b, restaurant)), [served, restaurant]);
  const revenue = totalsPerBooking.reduce((sum, x) => sum + x.total, 0);
  const guestsServed = served.reduce((sum, b) => sum + b.party_size, 0);
  const avgPerGuest = guestsServed > 0 ? Math.round(revenue / guestsServed) : 0;

  const minSpendApplicable = served.filter((b) => minSpendApplies(restaurant, b.booking_date));
  const minSpendReached = minSpendApplicable.filter((b) => computeReceiptTotals(b, restaurant).topUp === 0).length;

  // Traffic (not just served tabs) within the window, honored bookings only
  // (confirmed/dined — not pending/declined/cancelled/no-show), bucketed
  // into the restaurant's own half-hour slots grouped by hour so the x-axis
  // matches the real booking window exactly (handles an overnight-wrapping
  // restaurant the same way the booking screen's own hour picker does).
  const hourGroups = useMemo(() => {
    const slots = generateTimeSlots(restaurant.opening_time, restaurant.closing_time);
    const groups = groupSlotsByHour(slots);
    const traffic = bookings.filter(
      (b) => b.booking_date >= start && b.booking_date <= end && ["confirmed", "dined"].includes(b.status)
    );
    return groups.map((g) => ({
      label: g.label,
      count: traffic.filter((b) => hourLabelOfSlot(b.booking_time) === g.label).length,
    }));
  }, [bookings, start, end, restaurant.opening_time, restaurant.closing_time]);
  const maxHourCount = Math.max(1, ...hourGroups.map((g) => g.count));
  const hasTraffic = hourGroups.some((g) => g.count > 0);

  const topItems = useMemo(() => {
    const counts = new Map();
    served.forEach((b) => (b.order_items || []).forEach((oi) => counts.set(oi.name, (counts.get(oi.name) || 0) + oi.quantity)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [served]);

  return (
    <>
      <div className="inline-flex bg-tan rounded-full p-1 mb-6">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${period === p.key ? "bg-burgundy text-offwhite" : "text-charcoal"}`}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatTile label={t("statRevenue")} value={`AED ${revenue}`} />
        <StatTile label={t("statAvgPerGuest")} value={`AED ${avgPerGuest}`} />
        <StatTile label={t("statGuestsServed")} value={guestsServed} />
        <StatTile
          label={t("statMinSpendReached")}
          value={minSpendApplicable.length > 0 ? `${minSpendReached} / ${minSpendApplicable.length}` : "—"}
        />
      </div>

      <div className="rounded-2xl p-4 bg-card mb-6">
        <h3 className="font-serif text-base text-charcoal mb-4">{t("busiestTimesTitle")}</h3>
        {!hasTraffic ? (
          <p className="text-sm text-taupe">{t("noAnalyticsData")}</p>
        ) : (
          <>
            <div className="flex items-end gap-1 h-32 border-b border-charcoal/[0.12]">
              {hourGroups.map((g) => (
                <div key={g.label} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                  {g.count > 0 && <span className="text-[10px] font-semibold text-charcoal mb-1">{g.count}</span>}
                  <div
                    title={`${g.label}: ${g.count}`}
                    className="w-full max-w-[22px] rounded-t-[4px] bg-brass transition-opacity hover:opacity-80"
                    style={{ height: g.count > 0 ? `${Math.max(6, (g.count / maxHourCount) * 100)}%` : 0 }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-1.5">
              {hourGroups.map((g) => (
                <div key={g.label} className="flex-1 text-center text-[9px] text-taupe truncate">
                  {g.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl p-4 bg-card">
        <h3 className="font-serif text-base text-charcoal mb-4">{t("topSellingTitle")}</h3>
        {topItems.length === 0 ? (
          <p className="text-sm text-taupe">{t("noAnalyticsData")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topItems.map(([name, qty], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-5 text-xs font-semibold text-taupe flex-shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm text-charcoal truncate">{name}</span>
                <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-tan text-charcoal flex-shrink-0">{qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
