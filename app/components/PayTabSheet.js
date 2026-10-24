"use client";

import { useEffect, useState } from "react";
import { CreditCard, Banknote, Minus, Plus } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { computeReceiptTotals } from "../../lib/receipts";
import { computePaymentAmounts } from "../../lib/payments";

const CHIP = "min-h-[44px] rounded-full px-4 text-sm font-semibold flex-1";
const CHIP_ON = `${CHIP} bg-burgundy text-offwhite`;
const CHIP_OFF = `${CHIP} bg-tan text-charcoal`;

// "How will you pay?" — opened from the diner's Tab screen, either fresh or
// via "Change" on an existing choice. Self-contained like the other bottom
// sheets in this app (ConfirmSheet / MenuSheet / AddGuestsSheet): derives
// the current user's existing choice straight from `booking` (already
// embeds every participant's booking_payment_choices row), and owns its
// own form state and the one Supabase upsert that saves it.
export default function PayTabSheet({ booking, userId, onClose, onSaved, t }) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const open = !!booking;
  const existingChoice = booking ? (booking.booking_payment_choices || []).find((c) => c.user_id === userId) : null;

  const [method, setMethod] = useState(existingChoice?.method || null);
  const [splitType, setSplitType] = useState(existingChoice?.split_type || "full");
  const [splitPeople, setSplitPeople] = useState(existingChoice?.split_people || booking?.party_size || 2);
  const [splitItemIds, setSplitItemIds] = useState(() => new Set(existingChoice?.split_item_ids || []));
  const [tipPercent, setTipPercent] = useState(existingChoice?.tip_percent || null);
  const [tipCustom, setTipCustom] = useState(existingChoice?.tip_custom_amount ?? null);
  const [tipCustomMode, setTipCustomMode] = useState(!!existingChoice?.tip_custom_amount);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timeout = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const restaurant = booking.restaurants || {};
  const totals = computeReceiptTotals(booking, restaurant);
  const items = booking.order_items || [];

  function toggleItem(id) {
    setSplitItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickTipPercent(pct) {
    setTipPercent((prev) => (prev === pct ? null : pct));
    setTipCustomMode(false);
    setTipCustom(null);
  }

  function pickTipCustom() {
    setTipCustomMode(true);
    setTipPercent(null);
  }

  const previewChoice = {
    split_type: splitType,
    split_people: splitPeople,
    split_item_ids: [...splitItemIds],
    tip_percent: tipPercent,
    tip_custom_amount: tipCustomMode ? Number(tipCustom) || 0 : null,
  };
  const { shareAed, tipAed, youPayAed } = computePaymentAmounts(previewChoice, totals, booking);

  const canSave = !!method && !!splitType && (splitType !== "items" || splitItemIds.size > 0);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const payload = {
      booking_id: booking.id,
      user_id: userId,
      method,
      split_type: splitType,
      split_people: splitType === "even" ? splitPeople : null,
      split_item_ids: splitType === "items" ? [...splitItemIds] : null,
      tip_percent: tipPercentValueOrNull(tipPercent, tipCustomMode),
      tip_custom_amount: tipCustomMode ? Number(tipCustom) || 0 : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("booking_payment_choices")
      .upsert(payload, { onConflict: "booking_id,user_id" });
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    await onSaved?.();
    onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 transition-opacity duration-200 motion-reduce:duration-0 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md max-h-[88vh] flex flex-col rounded-t-[28px] bg-cream px-5 pt-3 pb-6 transition-transform duration-200 motion-reduce:duration-0 ease-out ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-tan mx-auto mb-4 flex-shrink-0" />
        <h3 className="font-serif text-xl text-charcoal mb-1 flex-shrink-0">{t("howWillYouPay")}</h3>
        <p className="text-sm text-muted mb-5 flex-shrink-0">{t("totalLabel")} AED {totals.total}</p>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-2">{t("payMethodLabel")}</div>
          <div className="flex gap-2 mb-5">
            <button type="button" onClick={() => setMethod("card")} className={method === "card" ? CHIP_ON : CHIP_OFF}>
              <span className="inline-flex items-center gap-1.5 justify-center">
                <CreditCard size={14} /> {t("payCard")}
              </span>
            </button>
            <button type="button" onClick={() => setMethod("cash")} className={method === "cash" ? CHIP_ON : CHIP_OFF}>
              <span className="inline-flex items-center gap-1.5 justify-center">
                <Banknote size={14} /> {t("payCash")}
              </span>
            </button>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-2">{t("splitLabel")}</div>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setSplitType("full")} className={splitType === "full" ? CHIP_ON : CHIP_OFF}>
              {t("splitFull")}
            </button>
            <button type="button" onClick={() => setSplitType("even")} className={splitType === "even" ? CHIP_ON : CHIP_OFF}>
              {t("splitEven")}
            </button>
            <button type="button" onClick={() => setSplitType("items")} className={splitType === "items" ? CHIP_ON : CHIP_OFF}>
              {t("splitItems")}
            </button>
          </div>

          {splitType === "even" && (
            <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-card mb-5">
              <span className="text-sm text-charcoal">{t("splitEvenBetween")}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSplitPeople((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-tan text-burgundy flex-shrink-0"
                >
                  <Minus size={14} />
                </button>
                <span className="text-base font-semibold text-charcoal min-w-[18px] text-center">{splitPeople}</span>
                <button
                  type="button"
                  onClick={() => setSplitPeople((n) => n + 1)}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-tan text-burgundy flex-shrink-0"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {splitType === "items" && (
            <div className="flex flex-col gap-1.5 mb-5">
              {items.length === 0 && <p className="text-xs text-taupe py-1">{t("noItemsYet")}</p>}
              {items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-card min-h-[44px]"
                >
                  <input
                    type="checkbox"
                    checked={splitItemIds.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 accent-burgundy flex-shrink-0"
                  />
                  <span className="flex-1 text-sm text-charcoal truncate">
                    {item.quantity} × {item.name}
                  </span>
                  <span className="text-sm text-taupe flex-shrink-0">AED {item.quantity * item.price_aed}</span>
                </label>
              ))}
            </div>
          )}

          {restaurant.accept_tips && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-2">{t("tipLabel")}</div>
              <div className="flex gap-2 mb-5 flex-wrap">
                {(restaurant.tip_percentages || []).map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => pickTipPercent(pct)}
                    className={tipPercent === pct ? CHIP_ON : CHIP_OFF}
                    style={{ flex: "1 1 auto" }}
                  >
                    {pct}%
                  </button>
                ))}
                {restaurant.allow_custom_tip && (
                  <button
                    type="button"
                    onClick={pickTipCustom}
                    className={tipCustomMode ? CHIP_ON : CHIP_OFF}
                    style={{ flex: "1 1 auto" }}
                  >
                    {t("tipOther")}
                  </button>
                )}
              </div>
              {tipCustomMode && (
                <input
                  type="number"
                  min="0"
                  value={tipCustom ?? ""}
                  onChange={(e) => setTipCustom(e.target.value)}
                  placeholder={t("aedUnit")}
                  className="w-full min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy -mt-2 mb-5"
                />
              )}
            </>
          )}

          <div className="rounded-2xl p-4 bg-card mb-5 text-sm">
            <div className="flex justify-between py-1 text-muted">
              <span>{t("yourShareLabel")}</span>
              <span>AED {shareAed}</span>
            </div>
            {restaurant.accept_tips && (
              <div className="flex justify-between py-1 text-muted">
                <span>{t("tipLabel")}</span>
                <span>AED {tipAed}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 mt-1 border-t border-charcoal/[0.08] font-semibold text-charcoal">
              <span>{t("youPayLabel")}</span>
              <span>AED {youPayAed}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full min-h-[44px] rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-50 flex-shrink-0"
        >
          {saving ? t("saving") : t("letRestaurantKnow")}
        </button>
        <p className="text-xs text-taupe text-center mt-3 flex-shrink-0">{t("payAtTableNote")}</p>
      </div>
    </div>
  );
}

function tipPercentValueOrNull(tipPercent, tipCustomMode) {
  return tipCustomMode ? null : tipPercent || null;
}
