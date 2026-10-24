"use client";

import { useEffect, useState } from "react";

// Bottom sheet showing a restaurant's diner-facing menu, opened from the
// Restaurant Detail screen's "View menu" button. `items` is expected to
// already have staff-only dishes filtered out by the caller — this
// component just renders whatever list it's handed.
//
// Modeled on ConfirmSheet's own mount/animate/Esc/backdrop-click behavior
// (see app/components/ConfirmSheet.js) so every bottom sheet in the app
// opens and closes the same way; this one just has a scrollable list and a
// plain "Close" button instead of a single confirm action.
export default function MenuSheet({ open, items, t, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

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

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 transition-opacity duration-200 motion-reduce:duration-0 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[600px] max-h-[80vh] flex flex-col rounded-t-[28px] bg-cream px-5 pt-3 pb-6 transition-transform duration-200 motion-reduce:duration-0 ease-out ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-tan mx-auto mb-4 flex-shrink-0" />
        <h3 className="font-serif text-xl text-burgundy mb-1 flex-shrink-0">{t("menu")}</h3>
        <p className="text-xs text-muted mb-4 flex-shrink-0">{t("menuSheetHint")}</p>

        <div className="flex-1 overflow-y-auto">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-charcoal/[0.06] last:border-0">
              {m.photo_url ? (
                <img src={m.photo_url} alt={m.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-tan flex-shrink-0" />
              )}
              <span className="flex-1 text-sm text-charcoal">{m.name}</span>
              <span className="text-brass font-semibold text-sm flex-shrink-0">AED {m.price_aed}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite flex-shrink-0"
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}
