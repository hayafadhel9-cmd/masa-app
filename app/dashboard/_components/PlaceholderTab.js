"use client";

// Receipts / Analytics / Settings-tab — all three are fully designed in the
// mockup this dashboard was rebuilt from, but the user explicitly scoped
// them as placeholders for this pass. Same pattern already used elsewhere in
// the app for a deferred feature (see t("comingSoon") on the diner app's
// Payment methods screen). `ctaLabel`/`onCta` are only passed for the
// Settings tab, which links out to the real, already-built
// /dashboard/settings page rather than hiding it behind a dead end.
export default function PlaceholderTab({ t, ctaLabel, onCta }) {
  return (
    <div className="rounded-2xl p-8 bg-card text-center max-w-md mx-auto mt-10">
      <p className="font-serif text-lg text-charcoal mb-2">{t("comingSoon")}</p>
      <p className="text-sm text-muted mb-5">{t("dashboardPlaceholderBody")}</p>
      {ctaLabel && (
        <button type="button" onClick={onCta} className="rounded-full px-5 py-2.5 text-sm font-semibold bg-burgundy text-offwhite">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
