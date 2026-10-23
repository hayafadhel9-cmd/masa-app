"use client";

import { Accessibility, Baby, Nut } from "lucide-react";
import { hasDiningNeeds, diningNeedsFromRow } from "../../../lib/diningNeeds";
import { visitBadgeText } from "../../../lib/guestVisits";

// Small circular-outline badge next to a guest's name wherever it appears
// (Requests card, Tonight row, Upcoming row) — one icon even when a guest
// has multiple needs (allergy takes priority as the most safety-relevant,
// then wheelchair, then high chair), tapping opens the full GuestNeedsModal
// with every need listed. Renders nothing for a guest with no saved needs.
export function NeedsBadge({ booking, guestName, onOpen }) {
  const needs = diningNeedsFromRow(booking.booking_needs);
  if (!hasDiningNeeds(needs)) return null;
  const Icon = needs.allergyOn ? Nut : needs.wheelchair ? Accessibility : Baby;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen({ guestName, needs });
      }}
      aria-label="Guest needs"
      className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-burgundy/40 text-burgundy flex-shrink-0"
    >
      <Icon size={13} />
    </button>
  );
}

// Gold dot + "4th visit" / "• الزيارة رقم 4" — only for a guest on their 2nd+
// visit; first-timers get nothing (not "1st visit").
export function VisitBadge({ visitNumber, lang }) {
  if (!visitNumber || visitNumber < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 text-brass text-xs font-semibold flex-shrink-0">
      <span className="w-1 h-1 rounded-full bg-brass" />
      {visitBadgeText(visitNumber, lang)}
    </span>
  );
}
