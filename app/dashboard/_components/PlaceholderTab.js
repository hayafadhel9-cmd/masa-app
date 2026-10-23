"use client";

// Receipts / Analytics — both are fully designed in the mockup this
// dashboard was rebuilt from, but the user explicitly scoped them as
// placeholders for this pass (Settings has since been built out for real —
// see SettingsTab.js). Same pattern already used elsewhere in the app for a
// deferred feature (see t("comingSoon") on the diner app's Payment methods
// screen).
export default function PlaceholderTab({ t }) {
  return (
    <div className="rounded-2xl p-8 bg-card text-center max-w-md mx-auto mt-10">
      <p className="font-serif text-lg text-charcoal mb-2">{t("comingSoon")}</p>
      <p className="text-sm text-muted">{t("dashboardPlaceholderBody")}</p>
    </div>
  );
}
