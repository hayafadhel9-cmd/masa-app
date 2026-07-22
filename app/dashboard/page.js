"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Check, X, Clock, CalendarDays, LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bookings, setBookings] = useState([]);

  const loadBookings = useCallback(async (restaurantId) => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("booking_time");
    setBookings(data || []);
  }, []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("restaurants").select("*");
      setRestaurants(data || []);
      if (data && data.length > 0) setSelected(data[0].id);
    }
    load();
  }, []);

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
  const noShows = bookings.filter((b) => b.status === "no-show");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const platformCut = (fee) => Math.round(fee * 0.18);

  return (
    <div className="mx-auto max-w-2xl min-h-screen bg-white">
      <div className="px-6 py-4 flex items-center justify-between bg-teal">
        <div className="flex items-center gap-2 text-ivory text-sm font-medium">
          <LayoutDashboard size={18} className="text-brass" /> Partner dashboard
        </div>
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
      </div>

      {restaurant && (
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-ink">{restaurant.name}</h2>
            {restaurant.subscription_status === "trial" ? (
              <span className="text-[10px] font-medium rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">
                Free trial
              </span>
            ) : (
              <span className="text-[10px] font-medium rounded-full px-2.5 py-1 bg-green-100 text-green-700">
                Active subscription
              </span>
            )}
          </div>
        </div>
      )}

      <div className="px-6 pb-10">
        <div className="flex items-center gap-2 mt-4 mb-2">
          <span className="text-[10px] uppercase tracking-widest font-medium text-amber-700">
            Needs response
          </span>
          <span className="text-[10px] rounded-full px-1.5 bg-amber-100 text-amber-700">{pending.length}</span>
        </div>

        {pending.length === 0 && (
          <p className="text-xs py-3 text-neutral-400">No new requests right now.</p>
        )}

        <div className="flex flex-col gap-2 mb-5">
          {pending.map((b) => (
            <div key={b.id} className="rounded-lg p-3 flex items-center justify-between bg-amber-50 border border-amber-100">
              <div>
                <div className="text-sm font-medium text-ink flex items-center gap-2">
                  {b.guest_name} · {b.party_size} guests
                  {b.occasion && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-200 text-amber-800">
                      {b.occasion}
                    </span>
                  )}
                </div>
                <div className="text-xs flex items-center gap-1 mt-0.5 text-neutral-500">
                  <Clock size={11} /> {b.booking_time} · {b.zone} · {b.guest_phone}
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

        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest font-medium text-teal">Confirmed</span>
          <span className="text-[10px] rounded-full px-1.5 bg-green-100 text-green-700">{confirmed.length}</span>
        </div>
        <div className="flex flex-col gap-2 mb-5">
          {confirmed.map((b) => (
            <div key={b.id} className="rounded-lg p-3 flex items-center justify-between bg-green-50 border border-green-100">
              <div>
                <div className="text-sm font-medium text-ink flex items-center gap-2">
                  {b.guest_name} · {b.party_size} guests
                  {b.occasion && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                      {b.occasion}
                    </span>
                  )}
                </div>
                <div className="text-xs flex items-center gap-1 mt-0.5 text-neutral-500">
                  <CalendarDays size={11} /> {b.booking_time} · {b.zone} · card •••• {b.card_last4}
                </div>
              </div>
              <button
                onClick={() => markNoShow(b.id)}
                className="text-[10px] rounded-full px-2 py-1 bg-amber-100 text-amber-700"
              >
                Mark no-show
              </button>
            </div>
          ))}
        </div>

        {noShows.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest font-medium text-red-700">
                Charged no-shows
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
                        {b.guest_name} · {b.party_size} guests
                        {b.occasion && (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                            {b.occasion}
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-medium text-red-700">Charged AED {total}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-[11px] text-neutral-500">
                        Restaurant keeps AED {total - cut} · Masa fee AED {cut}
                      </div>
                      <button
                        onClick={() => dismissNoShow(b.id)}
                        className="text-[10px] rounded-full px-2 py-1 bg-white border border-red-200 text-red-700"
                      >
                        Dismiss
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
                Cancelled by guest
              </span>
              <span className="text-[10px] rounded-full px-1.5 bg-neutral-200 text-neutral-600">{cancelled.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cancelled.map((b) => (
                <div key={b.id} className="rounded-lg p-3 bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-sm font-medium text-neutral-500">
                      {b.guest_name} · {b.party_size} guests
                    </span>
                    <span className="text-xs text-neutral-400">{b.booking_time} · table freed</span>
                  </div>
                  <button
                    onClick={() => archiveCancelled(b.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center bg-neutral-200 ml-3 flex-shrink-0"
                    aria-label="Dismiss"
                  >
                    <X size={13} className="text-neutral-600" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
