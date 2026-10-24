"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import {
  Inbox,
  UtensilsCrossed,
  CalendarDays,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Globe,
} from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";
import { computeVisitNumbers } from "../../lib/guestVisits";
import GuestNeedsModal from "./_components/GuestNeedsModal";
import Toast from "./_components/Toast";
import RequestsTab from "./_components/RequestsTab";
import TonightTab from "./_components/TonightTab";
import UpcomingTab from "./_components/UpcomingTab";
import ReceiptsTab from "./_components/ReceiptsTab";
import AnalyticsTab from "./_components/AnalyticsTab";
import ReceiptPanel from "./_components/ReceiptPanel";
import SettingsTab from "./_components/SettingsTab";

const NAV_ITEMS = [
  { key: "requests", labelKey: "navRequests", Icon: Inbox },
  { key: "tonight", labelKey: "navTonight", Icon: UtensilsCrossed },
  { key: "upcoming", labelKey: "navUpcoming", Icon: CalendarDays },
  { key: "receipts", labelKey: "navReceipts", Icon: Receipt },
  { key: "analytics", labelKey: "navAnalytics", Icon: BarChart3 },
  { key: "settings", labelKey: "settingsLabel", Icon: SettingsIcon },
];

export default function DashboardPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [areas, setAreas] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeTab, setActiveTab] = useState("requests");
  const [toast, setToast] = useState(null);
  const [needsDetail, setNeedsDetail] = useState(null);
  const [openReceiptId, setOpenReceiptId] = useState(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/dashboard/login");
        return;
      }
      setCheckingAuth(false);
    }
    checkAuth();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/dashboard/login");
  }

  const loadBookings = useCallback(async (restaurantId) => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("bookings")
      .select("*, booking_needs(*), order_items(*)")
      .eq("restaurant_id", restaurantId);
    setBookings(data || []);
  }, []);

  const loadAreas = useCallback(async (restaurantId) => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("restaurant_areas")
      .select("*")
      .eq("restaurant_id", restaurantId);
    setAreas(data || []);
  }, []);

  const loadMenuItems = useCallback(async (restaurantId) => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order");
    setMenuItems(data || []);
  }, []);

  useEffect(() => {
    if (checkingAuth) return;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", userData.user?.id);
      setRestaurants(data || []);
      if (data && data.length > 0) setSelected(data[0].id);
    }
    load();
  }, [checkingAuth]);

  useEffect(() => {
    loadBookings(selected);
    loadAreas(selected);
    loadMenuItems(selected);
  }, [selected, loadBookings, loadAreas, loadMenuItems]);

  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel("bookings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `restaurant_id=eq.${selected}` },
        () => loadBookings(selected)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected, loadBookings]);

  const restaurant = restaurants.find((r) => r.id === selected);
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const visitNumbers = useMemo(() => computeVisitNumbers(bookings), [bookings]);
  // Looked up fresh from `bookings` on every render (not a snapshot taken
  // when the panel opened) so edits inside ReceiptPanel — which reload the
  // whole bookings list — are reflected immediately instead of the panel
  // showing stale line items until it's closed and reopened.
  const openReceiptBooking = bookings.find((b) => b.id === openReceiptId) || null;

  function showToast(message, onUndo) {
    setToast({ message, onUndo });
  }

  async function toggleAccepting() {
    if (!restaurant) return;
    const next = !restaurant.accepting_requests;
    setTogglingAvailability(true);
    await supabase.from("restaurants").update({ accepting_requests: next }).eq("id", restaurant.id);
    setRestaurants((prev) => prev.map((r) => (r.id === restaurant.id ? { ...r, accepting_requests: next } : r)));
    setTogglingAvailability(false);
    showToast(next ? t("toastResumed") : t("toastPaused"), null);
  }

  if (checkingAuth || (!checkingAuth && restaurants.length === 0 && !selected)) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center text-sm text-taupe">{t("loading")}</div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6 text-center">
        <p className="text-sm text-muted max-w-sm">{t("noRestaurantLinked")}</p>
      </div>
    );
  }

  const activeLabelKey = NAV_ITEMS.find((n) => n.key === activeTab)?.labelKey || "navRequests";
  // Settings is the one surface styled as a centered ~760px column (see
  // SettingsForm.js) — its header row is centered the same way here so the
  // title/date/switch line up with the cards below, instead of spanning the
  // same full width every other tab uses.
  const isSettingsTab = activeTab === "settings";
  const todayLabel = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-cream flex">
      <aside className="w-60 flex-shrink-0 bg-burgundy text-tan flex flex-col px-5 py-6">
        <div className="font-serif text-2xl text-brass font-extrabold leading-none mb-1">Held</div>
        <div className="w-6 h-0.5 bg-brass mb-1.5" />
        <div className="text-[10px] font-bold uppercase tracking-widest text-tan/70 mb-6">{t("forRestaurants")}</div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ key, labelKey, Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-start ${
                  active ? "bg-burgundyLight text-offwhite font-semibold" : "text-tan/80"
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{t(labelKey)}</span>
                {key === "requests" && pendingCount > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-brass text-burgundy text-[10px] font-bold flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1.5 bg-offwhite/10 text-tan"
          >
            <Globe size={12} /> {lang === "en" ? "عربي" : "EN"}
          </button>
          <button
            onClick={handleSignOut}
            aria-label={t("signOut")}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-offwhite/10 text-tan"
          >
            <LogOut size={14} />
          </button>
        </div>

        {restaurants.length > 1 ? (
          <select
            value={selected || ""}
            onChange={(e) => setSelected(e.target.value)}
            className="text-sm rounded-lg px-2 py-1.5 bg-burgundyLight text-offwhite border border-offwhite/20"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id} className="text-charcoal">
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          restaurant && (
            <div>
              <div className="font-serif text-base text-offwhite">{restaurant.name}</div>
              {restaurant.area && <div className="text-xs text-tan/70">{restaurant.area}</div>}
            </div>
          )
        )}
      </aside>

      <main className={`flex-1 min-w-0 py-8 overflow-y-auto ${isSettingsTab ? "px-4" : "px-8"}`}>
        <div className={isSettingsTab ? "w-full max-w-[760px] mx-auto" : undefined}>
          <div className="flex items-start justify-between gap-4 mb-7">
            <div>
              <h1 className="font-serif text-3xl text-charcoal">{t(activeLabelKey)}</h1>
              <p className="text-sm text-muted mt-1">{todayLabel}</p>
              {!restaurant.accepting_requests && <p className="text-xs text-warn mt-1">{t("pausedNotice")}</p>}
            </div>
            <button
              type="button"
              onClick={toggleAccepting}
              disabled={togglingAvailability}
              className="flex items-center gap-2.5 flex-shrink-0 disabled:opacity-60"
            >
              <span className="text-sm font-medium text-charcoal">
                {restaurant.accepting_requests ? t("takingRequests") : t("requestsPaused")}
              </span>
              <span
                className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                  restaurant.accepting_requests ? "bg-green-700" : "bg-tan"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    restaurant.accepting_requests ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {activeTab === "requests" && (
          <RequestsTab
            restaurant={restaurant}
            bookings={bookings}
            areas={areas}
            lang={lang}
            t={t}
            reload={() => loadBookings(selected)}
            showToast={showToast}
            openNeedsModal={setNeedsDetail}
            visitNumbers={visitNumbers}
          />
        )}
        {activeTab === "tonight" && (
          <TonightTab
            restaurant={restaurant}
            bookings={bookings}
            lang={lang}
            t={t}
            reload={() => loadBookings(selected)}
            showToast={showToast}
            openNeedsModal={setNeedsDetail}
            openReceipt={setOpenReceiptId}
            visitNumbers={visitNumbers}
          />
        )}
        {activeTab === "upcoming" && (
          <UpcomingTab
            restaurant={restaurant}
            bookings={bookings}
            lang={lang}
            t={t}
            openNeedsModal={setNeedsDetail}
            visitNumbers={visitNumbers}
          />
        )}
        {activeTab === "receipts" && (
          <ReceiptsTab restaurant={restaurant} bookings={bookings} lang={lang} t={t} openReceipt={setOpenReceiptId} />
        )}
        {activeTab === "analytics" && <AnalyticsTab restaurant={restaurant} bookings={bookings} t={t} />}
        {activeTab === "settings" && (
          <SettingsTab
            restaurant={restaurant}
            areas={areas}
            onAreasChanged={() => loadAreas(selected)}
            onRestaurantSaved={(saved) => setRestaurants((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      <GuestNeedsModal detail={needsDetail} onClose={() => setNeedsDetail(null)} t={t} />
      <ReceiptPanel
        booking={openReceiptBooking}
        restaurant={restaurant}
        menuItems={menuItems}
        t={t}
        lang={lang}
        onClose={() => setOpenReceiptId(null)}
        reload={() => loadBookings(selected)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} t={t} />
    </div>
  );
}
