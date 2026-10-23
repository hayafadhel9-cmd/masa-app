"use client";

import { useEffect, useState } from "react";

// Held's in-app replacement for the browser's confirm() — used anywhere a
// destructive action (remove, delete) needs a yes/no first. One shared
// component so every confirm in the app looks and behaves the same, in
// English and Arabic/RTL alike (no direction-specific classes needed here:
// it's just centered/full-width content, which mirrors for free under the
// document's own dir="rtl").
//
// Controlled by the caller: `open` plus the copy/handlers for whatever
// action is currently pending. Render once per page, near the root of its
// JSX, and drive it from one `confirmState`-shaped piece of state — see
// app/dashboard/settings/page.js for the pattern.
export default function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) {
  // Mounted a beat longer than `open` so the slide-down/fade-out can play
  // before the sheet actually leaves the DOM, instead of just vanishing.
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
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onCancel]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-md rounded-t-[28px] bg-cream px-5 pt-3 pb-8 transition-transform duration-200 ease-out ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-tan mx-auto mb-5" />
        <h3 className="font-serif text-xl text-burgundy mb-1">{title}</h3>
        {description ? (
          <p className="text-sm text-muted mb-5">{description}</p>
        ) : (
          <div className="mb-4" />
        )}
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)] mb-3"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-sm font-medium text-burgundy py-2"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
