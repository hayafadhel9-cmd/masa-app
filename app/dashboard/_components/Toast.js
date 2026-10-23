"use client";

import { useEffect } from "react";

const AUTO_DISMISS_MS = 6000;

// Bottom-center confirmation toast with an optional "Undo" action, used by
// the Requests and Tonight tabs after confirming/declining/marking a no-show.
// `toast` is { message, onUndo? } | null, owned by the dashboard shell so
// only one can ever be showing at a time.
export default function Toast({ toast, onDismiss, t }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed left-0 right-0 bottom-6 z-50 flex justify-center px-6 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full pl-5 pr-2 py-2 bg-charcoal text-offwhite shadow-[0_10px_30px_rgba(43,31,33,0.35)] max-w-md">
        <span className="text-sm">{toast.message}</span>
        {toast.onUndo && (
          <button
            type="button"
            onClick={() => {
              toast.onUndo();
              onDismiss();
            }}
            className="flex-shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 bg-offwhite/15"
          >
            {t("undo")}
          </button>
        )}
      </div>
    </div>
  );
}
