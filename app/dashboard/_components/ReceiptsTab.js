"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toLocalDateStr, addDays } from "../../../lib/date";
import { relativeDateLabel } from "../../../lib/relativeDate";
import { computeReceiptTotals } from "../../../lib/receipts";
import { computePaymentAmounts } from "../../../lib/payments";

const STATUS_STYLE = {
  open: "bg-brass/20 text-charcoal",
  paid: "bg-green-50 text-green-700",
  not_paid: "bg-warn/10 text-warn",
};

export default function ReceiptsTab({ restaurant, bookings, lang, t, openReceipt }) {
  const [date, setDate] = useState(() => toLocalDateStr(new Date()));

  const receipts = useMemo(
    () =>
      bookings
        .filter((b) => b.booking_date === date && b.receipt_status)
        .map((b) => ({ booking: b, totals: computeReceiptTotals(b, restaurant) }))
        .sort((a, b) => a.booking.booking_time.localeCompare(b.booking.booking_time)),
    [bookings, date, restaurant]
  );

  const billed = receipts.reduce((sum, r) => sum + r.totals.total, 0);
  const stillToCollect = receipts
    .filter((r) => r.booking.receipt_status !== "paid")
    .reduce((sum, r) => sum + r.totals.total, 0);
  const tips = receipts.reduce(
    (sum, r) =>
      sum +
      (r.booking.booking_payment_choices || []).reduce(
        (s, c) => s + computePaymentAmounts(c, r.totals, r.booking).tipAed,
        0
      ),
    0
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDate((d) => toLocalDateStr(addDays(new Date(d), -1)))}
            aria-label="Previous night"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-card text-charcoal"
          >
            <ChevronLeft size={16} className="rtl:rotate-180" />
          </button>
          <span className="font-serif text-lg text-charcoal min-w-[11ch] text-center">
            {relativeDateLabel(date, lang, t)}
          </span>
          <button
            type="button"
            onClick={() => setDate((d) => toLocalDateStr(addDays(new Date(d), 1)))}
            aria-label="Next night"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-card text-charcoal"
          >
            <ChevronRight size={16} className="rtl:rotate-180" />
          </button>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl px-4 py-2.5 bg-card text-end">
            <div className="text-[10px] font-bold uppercase tracking-widest text-taupe">{t("billedLabel")}</div>
            <div className="font-serif text-lg text-charcoal">AED {billed}</div>
          </div>
          <div className="rounded-2xl px-4 py-2.5 bg-card text-end">
            <div className="text-[10px] font-bold uppercase tracking-widest text-taupe">{t("stillToCollectLabel")}</div>
            <div className="font-serif text-lg text-charcoal">AED {stillToCollect}</div>
          </div>
          <div className="rounded-2xl px-4 py-2.5 bg-card text-end">
            <div className="text-[10px] font-bold uppercase tracking-widest text-taupe">{t("totalTipsLabel")}</div>
            <div className="font-serif text-lg text-charcoal">AED {tips}</div>
          </div>
        </div>
      </div>

      {receipts.length === 0 && <p className="text-sm text-muted py-6 text-center">{t("noReceiptsTonight")}</p>}

      <div className="flex flex-col gap-2">
        {receipts.map(({ booking, totals }) => (
          <button
            key={booking.id}
            type="button"
            onClick={() => openReceipt(booking.id)}
            className="w-full text-start rounded-2xl p-4 bg-card flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="font-serif text-base text-charcoal">{booking.guest_name}</div>
              <div className="text-xs text-muted">
                {booking.zone} · {booking.booking_time} · {t("guestsCount", { count: booking.party_size })}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-semibold text-charcoal">AED {totals.total}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[booking.receipt_status]}`}>
                {booking.receipt_status === "paid"
                  ? t("receiptPaidStatus")
                  : booking.receipt_status === "not_paid"
                  ? t("receiptNotPaidStatus")
                  : t("receiptOpenStatus")}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
