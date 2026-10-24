"use client";

import SettingsForm from "./SettingsForm";

// Thin wrapper around the shared SettingsForm for use inside the dashboard
// shell's tab bar — the shell already has `restaurant` loaded (middleware
// guarantees one exists before /dashboard is reachable) and already owns
// `areas` (shared with RequestsTab's zone-capacity lines), so this just
// passes both through rather than letting the form fetch its own copies.
// The standalone /dashboard/settings page (onboarding + direct access)
// renders SettingsForm itself instead, with its own heading/back button.
export default function SettingsTab({ restaurant, areas, onAreasChanged, onRestaurantSaved, onSignOut }) {
  return (
    <SettingsForm
      restaurant={restaurant}
      showHeading={false}
      areas={areas}
      onAreasChanged={onAreasChanged}
      onSaved={onRestaurantSaved}
      onSignOut={onSignOut}
    />
  );
}
