"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { ChevronLeft, Globe } from "lucide-react";
import { useLanguage } from "../../../lib/LanguageContext";
import SettingsForm from "../_components/SettingsForm";

// Standalone route, kept for two cases the dashboard shell's Settings tab
// can't handle itself: onboarding (a brand-new owner with no restaurant row
// yet — middleware exempts exactly this path from requiring one) and any
// direct link/bookmark to /dashboard/settings. Everything else — the actual
// form — lives in SettingsForm now, shared with the Settings tab
// (app/dashboard/_components/SettingsTab.js) so neither copy can drift from
// the other.
export default function DashboardSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center text-sm text-taupe">Loading…</div>}>
      <DashboardSettingsInner />
    </Suspense>
  );
}

function DashboardSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, setLang, t } = useLanguage();
  const isOnboarding = searchParams.get("onboarding") === "true";
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [restaurant, setRestaurant] = useState(null);
  const [pendingRestaurantName, setPendingRestaurantName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/dashboard/login");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", userData.user?.id)
        .single();

      if (data) {
        setRestaurant(data);
      } else if (userData.user?.user_metadata?.pending_restaurant_name) {
        // First time here after signing up on the dashboard sign-up screen
        // (2026-10-24), which collects the restaurant name up front — carry
        // it over so onboarding isn't asking for it twice.
        setPendingRestaurantName(userData.user.user_metadata.pending_restaurant_name);
      }
      setCheckingAuth(false);
    }
    load();
  }, [router]);

  if (checkingAuth) {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-sm text-taupe">{t("loading")}</div>;
  }

  if (!restaurant && !isOnboarding) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-cream px-6 pt-16 text-sm text-muted">
        {t("noRestaurantLinked")}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto min-h-screen bg-cream px-6 pb-16">
      <div className="flex items-center justify-between pt-4 mb-2">
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1 text-sm text-burgundy font-medium py-2">
          <ChevronLeft size={16} className="rtl:rotate-180" /> {isOnboarding ? t("skipForNow") : t("backToDashboard")}
        </button>
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1.5 bg-tan text-charcoal flex-shrink-0"
        >
          <Globe size={12} /> {lang === "en" ? "عربي" : "EN"}
        </button>
      </div>

      <SettingsForm
        restaurant={restaurant}
        isOnboarding={isOnboarding}
        pendingRestaurantName={pendingRestaurantName}
        onSaved={(saved) => {
          if (isOnboarding) {
            router.push("/dashboard");
            return;
          }
          setRestaurant(saved);
        }}
      />
    </div>
  );
}
