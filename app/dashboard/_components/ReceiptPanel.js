"use client";

import { useState } from "react";
import { Plus, Minus, X, Trash2, CreditCard, Banknote } from "lucide-react";
import { supabase } from "../../../lib/supabase/client";
import { computeReceiptTotals } from "../../../lib/receipts";
import { computePaymentAmounts, participantName, paymentChoiceDetail } from "../../../lib/payments";

const STATUS_STYLE = {
  open: "bg-brass/20 text-charcoal",
  paid: "bg-green-50 text-green-700",
  not_paid: "bg-warn/10 text-warn",
};

function statusLabel(status, t) {
  if (status === "paid") return t("receiptPaidStatus");
  if (status === "not_paid") return t("receiptNotPaidStatus");
  return t("receiptOpenStatus");
}

// Shared by the Tonight tab (tapping a guest's status pill) and the
// Receipts tab (tapping a row) — one receipt editor so neither copy can
// drift. Staff add menu items to the tab, see the live subtotal/VAT/
// minimum-spend top-up/total (lib/receipts.js, derived from order_items,
// never stored), and mark the tab paid/not paid.
export default function ReceiptPanel({ booking, restaurant, menuItems, t, lang, onClose, reload }) {
  const [busy, setBusy] = useState(false);
  if (!booking) return null;

  const totals = computeReceiptTotals(booking, restaurant);
  const items = booking.order_items || [];
  const status = booking.receipt_status || "open";
  const paymentChoices = booking.booking_payment_choices || [];
  const totalTips = paymentChoices.reduce((sum, c) => sum + computePaymentAmounts(c, totals, booking).tipAed, 0);

  async function addItem(menuItem) {
    const existing = items.find((i) => i.menu_item_id === menuItem.id);
    setBusy(true);
    if (existing) {
      await supabase.from("order_items").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("order_items").insert({
        booking_id: booking.id,
        menu_item_id: menuItem.id,
        name: menuItem.name,
        price_aed: menuItem.price_aed,
        quantity: 1,
      });
    }
    await reload();
    setBusy(false);
  }

  async function changeQuantity(item, delta) {
    setBusy(true);
    if (item.quantity + delta <= 0) {
      await supabase.from("order_items").delete().eq("id", item.id);
    } else {
      await supabase.from("order_items").update({ quantity: item.quantity + delta }).eq("id", item.id);
    }
    await reload();
    setBusy(false);
  }

  async function removeItem(item) {
    setBusy(true);
    await supabase.from("order_items").delete().eq("id", item.id);
    await reload();
    setBusy(false);
  }

  async function saveNote(item, notes) {
    if ((item.notes || "") === notes) return;
    await supabase.from("order_items").update({ notes: notes || null }).eq("id", item.id);
    await reload();
  }

  async function setStatus(newStatus) {
    setBusy(true);
    await supabase
      .from("bookings")
      .update({
        receipt_status: newStatus,
        receipt_paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", booking.id);
    await reload();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-charcoal/50 flex items-center justify-center px-5" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[20px] p-5 bg-cream shadow-[0_8px_30px_rgba(43,31,33,0.25)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="font-serif text-xl text-charcoal">{booking.guest_name}</h3>
            <p className="text-xs text-muted">
              {booking.zone} · {booking.booking_time} · {t("guestsCount", { count: booking.party_size })}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("done")} className="text-taupe flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold mt-2 mb-4 ${STATUS_STYLE[status]}`}>
          {statusLabel(status, t)}
        </span>

        <div className="flex flex-col gap-2 mb-4">
          {items.length === 0 && <p className="text-xs text-taupe">{t("noMenuItems")}</p>}
          {items.map((item) => (
            <OrderItemRow
              key={item.id}
              item={item}
              busy={busy}
              onChangeQuantity={changeQuantity}
              onRemove={removeItem}
              onSaveNote={saveNote}
              t={t}
            />
          ))}
        </div>

        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-2">{t("addItemLabel")}</div>
          {menuItems.length === 0 ? (
            <p className="text-xs text-taupe">{t("noMenuItems")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {menuItems.map((mi) => (
                <button
                  key={mi.id}
                  type="button"
                  onClick={() => addItem(mi)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold bg-tan text-charcoal disabled:opacity-50"
                >
                  <Plus size={11} /> {mi.name} · AED {mi.price_aed}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4 bg-card mb-4 text-sm">
          <div className="flex justify-between py-1 text-muted">
            <span>{t("subtotalLabel")}</span>
            <span>AED {totals.subtotal}</span>
          </div>
          {totals.topUp > 0 && (
            <div className="flex justify-between py-1 text-muted">
              <span>{t("minSpendTopUpLabel")}</span>
              <span>AED {totals.topUp}</span>
            </div>
          )}
          {totals.fees.map((fee, i) => (
            <div key={i} className="flex justify-between py-1 text-muted">
              <span>{lang === "ar" ? fee.name_ar : fee.name_en}</span>
              <span>AED {fee.value}</span>
            </div>
          ))}
          <div className="flex justify-between py-1 text-muted">
            <span>{t("vatLabel")}</span>
            <span>AED {totals.vat}</span>
          </div>
          <div className="flex justify-between py-1.5 mt-1 border-t border-charcoal/[0.08] font-semibold text-charcoal">
            <span>{t("totalLabel")}</span>
            <span>AED {totals.total}</span>
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-card mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-3">{t("guestsWillPayLabel")}</div>
          {paymentChoices.length === 0 ? (
            <p className="text-xs text-taupe">{t("noPaymentChoiceYet")}</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-2">
                {paymentChoices.map((c) => {
                  const amounts = computePaymentAmounts(c, totals, booking);
                  const Icon = c.method === "card" ? CreditCard : Banknote;
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 text-sm">
                      <Icon size={14} className="text-taupe flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-charcoal">{participantName(booking, c.user_id)}</span>
                      <span className="text-xs text-taupe flex-shrink-0">{paymentChoiceDetail(c, t)}</span>
                      <span className="font-semibold text-charcoal flex-shrink-0">AED {amounts.youPayAed}</span>
                    </div>
                  );
                })}
              </div>
              {totalTips > 0 && (
                <div className="flex justify-between pt-2 mt-1 border-t border-charcoal/[0.08] text-sm">
                  <span className="text-muted">{t("totalTipsLabel")}</span>
                  <span className="font-semibold text-charcoal">AED {totalTips}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          {status === "open" && (
            <>
              <button
                type="button"
                onClick={() => setStatus("not_paid")}
                disabled={busy}
                className="flex-1 rounded-full py-3 text-sm font-semibold bg-tan text-charcoal disabled:opacity-50"
              >
                {t("markAsNotPaid")}
              </button>
              <button
                type="button"
                onClick={() => setStatus("paid")}
                disabled={busy}
                className="flex-1 rounded-full py-3 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-50"
              >
                {t("markAsPaid")}
              </button>
            </>
          )}
          {status !== "open" && (
            <button
              type="button"
              onClick={() => setStatus("open")}
              disabled={busy}
              className="w-full rounded-full py-3 text-sm font-semibold bg-tan text-charcoal disabled:opacity-50"
            >
              {t("reopenTab")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// One line item — name/price, quantity stepper, remove, and a small note
// input (e.g. "no onions") shown to the diner on their own Tab screen.
// Local `note` state so typing doesn't round-trip to the server on every
// keystroke; saved once on blur.
function OrderItemRow({ item, busy, onChangeQuantity, onRemove, onSaveNote, t }) {
  const [note, setNote] = useState(item.notes || "");

  return (
    <div className="rounded-2xl p-2.5 bg-card">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-charcoal truncate">{item.name}</div>
          <div className="text-xs text-taupe">AED {item.price_aed}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onChangeQuantity(item, -1)}
            disabled={busy}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-tan text-charcoal disabled:opacity-50"
          >
            <Minus size={12} />
          </button>
          <span className="w-5 text-center text-sm font-semibold text-charcoal">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onChangeQuantity(item, 1)}
            disabled={busy}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-tan text-charcoal disabled:opacity-50"
          >
            <Plus size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item)}
          disabled={busy}
          aria-label={t("delete")}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-warn/10 text-warn flex-shrink-0 disabled:opacity-50"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => onSaveNote(item, note.trim())}
        placeholder={t("itemNotePlaceholder")}
        className="w-full mt-2 rounded-full px-3 py-1.5 text-xs outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
      />
    </div>
  );
}
