"use client";

import { Accessibility, Baby, Nut } from "lucide-react";

// Shown from any tab (Requests/Tonight/Upcoming) when a guest's needs-badge
// icon is tapped. Reuses the real `booking_needs` data via
// lib/diningNeeds.js's diningNeedsFromRow — this is the dashboard's one
// shared read-only view of it, same shape as the diner app's own detail
// views (see app/page.js's NeedsDetailModal).
export default function GuestNeedsModal({ detail, onClose, t }) {
  if (!detail) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/50 flex items-center justify-center px-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[20px] p-5 bg-cream shadow-[0_8px_30px_rgba(43,31,33,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-charcoal mb-1">{t("guestNeeds")}</h3>
        <p className="text-xs text-muted mb-4">{detail.guestName}</p>
        <div className="flex flex-col gap-2.5 text-sm text-charcoal mb-4">
          {detail.needs.wheelchair && (
            <div className="flex items-center gap-2">
              <Accessibility size={16} className="text-burgundy flex-shrink-0" /> {t("wheelchairAccess")}
            </div>
          )}
          {detail.needs.highChair && (
            <div className="flex items-center gap-2">
              <Baby size={16} className="text-burgundy flex-shrink-0" /> {t("highChairNeed")}
            </div>
          )}
          {detail.needs.allergyOn && (
            <div className="flex items-start gap-2">
              <Nut size={16} className="text-burgundy flex-shrink-0 mt-0.5" />
              <span>
                {t("allergyNeed")}
                {detail.needs.allergy ? (
                  <>
                    : <strong>{detail.needs.allergy}</strong>
                  </>
                ) : (
                  ""
                )}
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted mb-5">{t("needsSavedByGuest")}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full py-3 text-sm font-semibold bg-burgundy text-offwhite"
        >
          {t("gotIt")}
        </button>
      </div>
    </div>
  );
}
