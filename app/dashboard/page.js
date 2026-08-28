"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { Check, X, Clock, CalendarDays, LayoutDashboard, LogOut, Settings, Globe } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

export default function DashboardPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("needsResponse");

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
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("booking_date")
      .order("booking_time");
    setBookings(data || []);
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
  }, [selected, loadBookings]);

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

  async function updateStatus(id, status) {
    await supabase.from("bookings").update({ status }).eq("id", id);
    loadBookings(selected);
  }

  async function markNoShow(id) {
    await supabase.from("bookings").update({ status: "no-show", charged: true }).eq("id", id);
    loadBookings(selected);
  }

  async function markDined(id) {
    await supabase.from("bookings").update({ status: "dined" }).eq("id", id);
    loadBookings(selected);
  }

  async function dismissNoShow(id) {
    await supabase.from("bookings").update({ status: "settled" }).eq("id", id);
    loadBookings(selected);
  }

  async function archiveCancelled(id) {
    await supabase.from("bookings").update({ status: "archived" }).eq("id", id);
    loadBookings(selected);
  }

  const restaurant = restaurants.find((r) => r.id === selected);
  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const dined = bookings.filter((b) => b.status === "dined");
  const noShows = bookings.filter((b) => b.status === "no-show");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const platformCut = (fee) => Math.round(fee * 0.18);

  const DASHBOARD_TABS = [
    { key: "needsResponse", label: t("needsResponseTab"), count: pending.length },
    { key: "confirmed", label: t("confirmedStatus"), count: confirmed.length },
    { key: "history", label: t("historyTab"), count: dined.length + noShows.length + cancelled.length },
  ];

  if (checkingAuth) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">{t("loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-2xl min-h-screen bg-white">
      <div className="px-6 py-4 flex items-center justify-between bg-teal">
        <div className="flex items-center gap-2 text-ivory text-sm font-medium">
          <LayoutDashboard size={18} className="text-brass" /> {t("partnerDashboard")}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selected || ""}
            onChange={(e) => setSelected(e.target.value)}
            className="text-xs rounded-md px-2 py-1 outline-none bg-teal text-ivory border border-white/20"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id} className="text-ink">
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-1 text-xs rounded-full px-2 py-1 bg-white/10 text-ivory"
          >
            <Globe size={12} /> {lang === "en" ? "عربي" : "EN"}
          </button>
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10"
            aria-label={t("settingsLabel")}
          >
            <Settings size={14} className="text-ivory" />
          </button>
          <button
            onClick={handleSignOut}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10"
            aria-label={t("signOut")}
          >
            <LogOut size={14} className="text-ivory" />
          </button>
        </div>
      </div>

      {restaurants.length === 0 && (
        <div className="px-6 py-10 text-sm text-neutral-500">
          {t("noRestaurantLinked")}
        </div>
      )}

      {restaurant && (
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-ink">{restaurant.name}</h2>
            {restaurant.subscription_status === "trial" ? (
              <span className="text-[10px] font-medium rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">
                {t("freeTrial")}
              </span>
            ) : (
              <span className="text-[10px] font-medium rounded-full px-2.5 py-1 bg-green-100 text-green-700">
                {t("activeSubscription")}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {DASHBOARD_TABS.map((tabDef) => (
              <button
                key={tabDef.key}
                onClick={() => setActiveTab(tabDef.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeTab === tabDef.key ? "bg-teal text-ivory" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {tabDef.label}
                <span
                  className={`text-[10px] rounded-full px-1.5 min-w-[16px] text-center ${
                    activeTab === tabDef.key ? "bg-white/20" : "bg-white"
                  }`}
                >
                  {tabDef.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 pb-10">
        {activeTab === "needsResponse" && (
        <>
        {pending.length === 0 && (
          <p className="text-xs py-3 text-neutral-400">{t("noNewRequests")}</p>
        )}

        <div className="flex flex-col gap-2 mb-5">
          {pending.map((b) => (
            <div key={b.id} className="rounded-lg p-3 flex items-center justify-between bg-amber-50 border border-amber-100">
              <div>
                <div className="text-sm font-medium text-ink flex items-center gap-2">
                  {b.guest_name} · {t("guestsCount", { count: b.party_size })}
                  {b.occasion && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-200 text-amber-800">
                      {b.occasion}
                    </span>
                  )}
                </div>
                <div className="text-xs flex items-center gap-1 mt-0.5 text-neutral-500">
                  <Clock size={11} /> {b.booking_date} · {b.booking_time} · {b.zone} · {b.guest_phone}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => updateStatus(b.id, "confirmed")}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-teal"
                >
                  <Check size={15} className="text-brass" />
                </button>
                <button
                  onClick={() => updateStatus(b.id, "declined")}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-200"
                >
                  <X size={15} className="text-neutral-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
        )}

        {activeTab === "confirmed" && (
        <>
        {confirmed.length === 0 && (
          <p className="text-xs py-3 text-neutral-400">{t("noConfirmedYet")}</p>
        )}
        <div className="flex flex-col gap-2">
          {confirmed.map((b) => (
            <div key={b.id} className="rounded-lg p-3 flex items-center justify-between bg-green-50 border border-green-100">
              <div>
                <div className="text-sm font-medium text-ink flex items-center gap-2">
                  {b.guest_name} · {t("guestsCount", { count: b.party_size })}
                  {b.occasion && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                      {b.occasion}
                    </span>
                  )}
                </div>
                <div className="text-xs flex items-center gap-1 mt-0.5 text-neutral-500">
                  <CalendarDays size={11} /> {b.booking_date} · {b.booking_time} · {b.zone} · card •••• {b.card_last4}
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => markDined(b.id)}
                  className="text-[10px] rounded-full px-2 py-1 bg-teal text-ivory"
                >
                  {t("markDined")}
                </button>
                <button
                  onClick={() => markNoShow(b.id)}
                  className="text-[10px] rounded-full px-2 py-1 bg-amber-100 text-amber-700"
                >
                  {t("markNoShow")}
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
        )}

        {activeTab === "history" && (
        <>
        {dined.length === 0 && noShows.length === 0 && cancelled.length === 0 && (
          <p className="text-xs py-3 text-neutral-400">{t("noHistoryYet")}</p>
        )}

        {dined.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest font-medium text-teal">{t("dined")}</span>
              <span className="text-[10px] rounded-full px-1.5 bg-teal/10 text-teal">{dined.length}</span>
            </div>
            <div className="flex flex-col gap-2 mb-5">
              {dined.map((b) => (
                <div key={b.id} className="rounded-lg p-3 bg-neutral-50 border border-neutral-200">
                  <div className="text-sm font-medium text-neutral-600 flex items-center gap-2">
                    {b.guest_name} · {t("guestsCount", { count: b.party_size })}
                    {b.occasion && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                        {b.occasion}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5 text-neutral-400">
                    {b.booking_date} · {b.booking_time} · {b.zone}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {noShows.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest font-medium text-red-700">
                {t("chargedNoShows")}
              </span>
              <span className="text-[10px] rounded-full px-1.5 bg-red-100 text-red-700">{noShows.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {noShows.map((b) => {
                const total = restaurant.no_show_fee_aed * b.party_size;
                const cut = platformCut(total);
                return (
                  <div key={b.id} className="rounded-lg p-3 bg-red-50 border border-red-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink flex items-center gap-2">
                        {b.guest_name} · {t("guestsCount", { count: b.party_size })}
                        {b.occasion && (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                            {b.occasion}
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-medium text-red-700">{t("chargedAed", { amount: total })}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-[11px] text-neutral-500">
                        {t("restaurantKeepsFee", { keep: total - cut, fee: cut })}
                      </div>
                      <button
                        onClick={() => dismissNoShow(b.id)}
                        className="text-[10px] rounded-full px-2 py-1 bg-white border border-red-200 text-red-700"
                      >
                        {t("dismiss")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {cancelled.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2 mt-5">
              <span className="text-[10px] uppercase tracking-widest font-medium text-neutral-500">
                {t("cancelledByGuest")}
              </span>
              <span className="text-[10px] rounded-full px-1.5 bg-neutral-200 text-neutral-600">{cancelled.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cancelled.map((b) => (
                <div key={b.id} className="rounded-lg p-3 bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-sm font-medium text-neutral-500">
                      {b.guest_name} · {t("guestsCount", { count: b.party_size })}
                    </span>
                    <span className="text-xs text-neutral-400">{b.booking_date} · {b.booking_time} · {t("tableFreed")}</span>
                  </div>
                  <button
                    onClick={() => archiveCancelled(b.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center bg-neutral-200 ml-3 flex-shrink-0"
                    aria-label={t("dismiss")}
                  >
                    <X size={13} className="text-neutral-600" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
