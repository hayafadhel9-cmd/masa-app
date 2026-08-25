"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Search, MapPin, ChevronLeft, Users, ShieldCheck, AlertTriangle, CreditCard, Check, Trees, Wind, Home, Cake, Heart, Briefcase, Share2, Compass, BookMarked, Globe, Clock } from "lucide-react";
import { addMyBookingId, getMyBookingIds, removeMyBookingId } from "../lib/myBookings";
import { canFreelyCancel } from "../lib/bookingTime";
import { generateTimeSlots } from "../lib/timeSlots";
import { useLanguage } from "../lib/LanguageContext";

const ZONE_ICONS = {
  Indoor: Home,
  Outdoor: Trees,
  "Shisha Terrace": Wind,
};

const ZONE_KEYS = {
  Indoor: { label: "indoor", desc: "indoorDesc" },
  Outdoor: { label: "outdoor", desc: "outdoorDesc" },
  "Shisha Terrace": { label: "shishaTerrace", desc: "shishaDesc" },
};

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function DinerPage() {
  const { lang, setLang, t } = useLanguage();

  const OCCASIONS = [
    { label: "None", key: "occasionNone", icon: null },
    { label: "Birthday", key: "occasionBirthday", icon: Cake },
    { label: "Anniversary", key: "occasionAnniversary", icon: Heart },
    { label: "Business", key: "occasionBusiness", icon: Briefcase },
  ];

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState("");
  const [party, setParty] = useState(2);
  const [time, setTime] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [zone, setZone] = useState(null);
  const [occasion, setOccasion] = useState("None");
  const [tab, setTab] = useState("discover");
  const [myBookings, setMyBookings] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [lastBooking, setLastBooking] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [zoneAvailability, setZoneAvailability] = useState({});
  const [timeAvailability, setTimeAvailability] = useState({});
  const [bookingsView, setBookingsView] = useState("current");

  useEffect(() => {
    async function loadRestaurants() {
      const { data, error } = await supabase.from("restaurants").select("*");
      if (error) {
        console.error("Error loading restaurants:", error.message);
      } else {
        setRestaurants(data || []);
      }
      setLoading(false);
    }
    loadRestaurants();
  }, []);

  async function openRestaurant(r) {
    setActive(r);
    setZone((r.zones && r.zones[0]) || "Indoor");
    const slots = generateTimeSlots(r.opening_time, r.closing_time);
    setTime(slots[0]);
    const defaultDate = addDays(new Date(), r.min_advance_days ?? 0);
    setBookingDate(toLocalDateStr(defaultDate));
    setParty(2);
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", r.id)
      .order("sort_order");
    setMenuItems(data || []);
    setScreen("restaurant");
  }

  // Real availability per time slot, aggregated across every zone — only shown
  // when ALL of the restaurant's zones have a configured capacity. If even one
  // zone is untracked (unlimited), we can't claim a slot is "full" overall, so
  // we deliberately show nothing rather than a misleading partial count.
  async function loadTimeAvailability() {
    if (!active) return;
    const zones = active.zones && active.zones.length > 0 ? active.zones : ["Indoor"];
    const capacity = active.zone_capacity || {};
    const allTracked = zones.every((z) => (Number(capacity[z]) || 0) > 0);
    if (!allTracked) {
      setTimeAvailability({});
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("zone, booking_time")
      .eq("restaurant_id", active.id)
      .eq("booking_date", bookingDate)
      .in("status", ["pending", "confirmed"]);
    const counts = {};
    (data || []).forEach((b) => {
      counts[b.booking_time] = counts[b.booking_time] || {};
      counts[b.booking_time][b.zone] = (counts[b.booking_time][b.zone] || 0) + 1;
    });
    const availability = {};
    generateTimeSlots(active.opening_time, active.closing_time).forEach((slot) => {
      let remaining = 0;
      zones.forEach((z) => {
        const cap = Number(capacity[z]) || 0;
        const used = counts[slot]?.[z] || 0;
        remaining += Math.max(0, cap - used);
      });
      availability[slot] = remaining;
    });
    setTimeAvailability(availability);
  }

  useEffect(() => {
    if ((screen === "restaurant" || screen === "book") && active) {
      loadTimeAvailability();
    }
  }, [screen, active, bookingDate]);

  async function loadZoneAvailability() {
    if (!active) return;
    const zones = active.zones && active.zones.length > 0 ? active.zones : ["Indoor"];
    const capacity = active.zone_capacity || {};
    const { data } = await supabase
      .from("bookings")
      .select("zone")
      .eq("restaurant_id", active.id)
      .eq("booking_date", bookingDate)
      .eq("booking_time", time)
      .in("status", ["pending", "confirmed"]);
    const counts = {};
    (data || []).forEach((b) => {
      counts[b.zone] = (counts[b.zone] || 0) + 1;
    });
    const availability = {};
    zones.forEach((z) => {
      const cap = Number(capacity[z]) || 0;
      availability[z] = cap > 0 && (counts[z] || 0) >= cap;
    });
    setZoneAvailability(availability);
  }

  useEffect(() => {
    if (screen === "zone" && active) {
      loadZoneAvailability();
    }
  }, [screen, active, bookingDate, time]);

  async function confirmBooking() {
    const capacity = active.zone_capacity || {};
    const cap = Number(capacity[zone]) || 0;
    if (cap > 0) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", active.id)
        .eq("booking_date", bookingDate)
        .eq("booking_time", time)
        .eq("zone", zone)
        .in("status", ["pending", "confirmed"]);
      if ((count || 0) >= cap) {
        const zoneLabel = ZONE_KEYS[zone]?.label ? t(ZONE_KEYS[zone].label) : zone;
        alert(t("zoneJustFilled", { zone: zoneLabel }));
        setScreen("zone");
        loadZoneAvailability();
        return;
      }
    }
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        restaurant_id: active.id,
        guest_name: name || "Guest",
        guest_phone: phone || "N/A",
        party_size: party,
        zone: zone,
        occasion: occasion === "None" ? null : occasion,
        booking_time: time,
        booking_date: bookingDate,
        card_last4: cardNumber.slice(-4) || "4242",
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Booking failed:", error.message);
      alert("Something went wrong submitting your booking. Check the console for details.");
      return;
    }
    addMyBookingId(data.id);
    setLastBooking(data);
    setScreen("confirmed");
  }

  async function loadMyBookings() {
    const ids = getMyBookingIds();
    if (ids.length === 0) {
      setMyBookings([]);
      return;
    }
    const { data } = await supabase.from("bookings").select("*, restaurants(name, area, cancellation_notice_hours)").in("id", ids);
    const ordered = ids.map((id) => data?.find((b) => b.id === id)).filter(Boolean);
    setMyBookings(ordered);
  }

  function shareBooking(booking) {
    const url = `${window.location.origin}/booking/${booking.id}`;
    const restaurantName = booking.restaurants?.name || active?.name || "our table";
    if (navigator.share) {
      navigator.share({ title: "My reservation", text: `Join me at ${restaurantName}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied — send it to your friends!");
    }
  }

  async function cancelBooking(booking) {
    const confirmMsg =
      booking.status === "confirmed" ? t("confirmCancelReservation") : t("confirmCancelRequest");
    if (!confirm(confirmMsg)) return;
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    loadMyBookings();
  }

  function removeFromMyBookings(id) {
    removeMyBookingId(id);
    loadMyBookings();
  }

  useEffect(() => {
    if (tab === "myBookings") {
      loadMyBookings();
    }
  }, [tab]);

  const filtered = restaurants.filter(
    (r) =>
      query.trim() === "" ||
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      (r.cuisine || "").toLowerCase().includes(query.toLowerCase())
  );

  const currentBookings = myBookings.filter((b) => b.status === "pending" || b.status === "confirmed");
  const pastBookings = myBookings.filter((b) =>
    ["dined", "no-show", "cancelled", "declined"].includes(b.status)
  );
  const visibleBookings = bookingsView === "current" ? currentBookings : pastBookings;

  const trackingTimeAvailability = Object.keys(timeAvailability).length > 0;

  return (
    <div className="mx-auto max-w-md min-h-screen bg-cream px-5 pb-28 relative">
      {tab === "discover" && screen === "home" && (
        <>
          <div className="flex items-center justify-between pt-6 mb-1">
            <div className="font-serif text-[52px] font-extrabold text-burgundy leading-none">Held</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="flex items-center gap-1 text-xs rounded-full px-2.5 py-2 bg-tan text-burgundy font-medium"
              >
                <Globe size={12} /> {lang === "en" ? "عربي" : "EN"}
              </button>
            </div>
          </div>
          <div className="w-8 h-0.5 bg-brass my-3.5" />
          <p className="text-sm mb-5 text-muted">{t("subheadline")}</p>

          <div className="flex items-center gap-2 rounded-full px-4 py-3 mb-5 bg-card border border-tan">
            <Search size={16} className="text-taupe" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
            />
          </div>

          {loading && <p className="text-sm text-muted">{t("loadingRestaurants")}</p>}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted py-8 text-center">{t("noRestaurants")}</p>
          )}

          <div className="flex flex-col gap-4">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => openRestaurant(r)}
                className="w-full text-left rounded-[20px] p-3.5 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]"
              >
                <div className="font-serif text-base text-charcoal">{r.name}</div>
                <div className="text-xs mt-1 text-muted">
                  {r.cuisine} · {r.area} · {r.price_tier}
                </div>
                {r.subscription_status === "trial" && (
                  <span className="inline-block text-[10px] font-semibold rounded-full px-2.5 py-1 mt-2 border border-brass text-brass">
                    {t("trialPartner")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "discover" && screen === "restaurant" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("home")} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>

          <h2 className="font-serif text-2xl text-charcoal mt-2">{active.name}</h2>
          <div className="text-xs mt-2 text-muted">
            {active.cuisine} · {active.price_tier}
          </div>
          <div className="text-xs mt-1.5 mb-1 flex items-center gap-2 text-muted">
            <MapPin size={12} /> {active.area}
          </div>
          <div className="text-xs mb-5 flex items-center gap-2 text-muted">
            <Clock size={12} /> {active.opening_time?.slice(0, 5) || "18:00"}–{active.closing_time?.slice(0, 5) || "21:30"}
          </div>

          {trackingTimeAvailability && (
            <>
              <div className="text-[11px] font-bold uppercase tracking-widest mb-3 text-taupe">
                {t("availableTonight")}
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {generateTimeSlots(active.opening_time, active.closing_time).map((tm) => {
                  const remaining = timeAvailability[tm];
                  const full = remaining === 0;
                  return (
                    <div
                      key={tm}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        full ? "bg-tan/50 text-taupe" : "bg-tan text-charcoal"
                      }`}
                    >
                      {tm} · {full ? t("slotFull") : t("tablesLeft", { count: remaining })}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="text-[11px] font-bold uppercase tracking-widest mb-3 text-taupe">
            {t("menuHighlights")}
          </div>
          <div className="flex flex-col gap-2 mb-6">
            {menuItems.length === 0 && (
              <p className="text-sm text-taupe">{t("noMenuItems")}</p>
            )}
            {menuItems.map((m) => (
              <div key={m.id} className="flex items-center gap-3 text-sm py-2.5 px-3 rounded-2xl bg-card">
                {m.photo_url ? (
                  <img src={m.photo_url} alt={m.name} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-tan flex-shrink-0" />
                )}
                <span className="text-charcoal flex-1">{m.name}</span>
                <span className="text-brass font-medium">AED {m.price_aed}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setScreen("book")}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]"
          >
            {t("reserveTable")}
          </button>
        </div>
      )}

      {tab === "discover" && screen === "book" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("restaurant")} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-xl mt-2 text-charcoal">
            {t("reserveAt")} <span className="italic text-burgundy">{active.name}</span>
          </h2>
          <div className="w-8 h-0.5 bg-brass my-3.5" />

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("date")}</label>
          <input
            type="date"
            value={bookingDate}
            min={toLocalDateStr(addDays(new Date(), active.min_advance_days ?? 0))}
            max={toLocalDateStr(addDays(new Date(), active.max_advance_days ?? 30))}
            onChange={(e) => setBookingDate(e.target.value)}
            className="w-full rounded-full px-4 py-3 text-sm mt-2 mb-5 outline-none bg-tan text-charcoal font-medium"
          />

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("partySize")}</label>
          <div className="flex items-center justify-between mt-2 mb-5 rounded-2xl px-4 py-3 bg-card">
            <span className="text-sm font-semibold text-charcoal flex items-center gap-2">
              <Users size={14} /> {t("partySize")}
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setParty(Math.max(1, party - 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-tan text-burgundy text-lg"
              >
                −
              </button>
              <div className="text-base font-semibold text-charcoal min-w-[16px] text-center">{party}</div>
              <button
                type="button"
                onClick={() => setParty(Math.min(active.max_party_size ?? 14, party + 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-tan text-burgundy text-lg"
              >
                +
              </button>
            </div>
          </div>
          <p className="text-[11px] text-taupe -mt-3 mb-5">
            {party >= (active.max_party_size ?? 14)
              ? t("partySizeMaxNote", { max: active.max_party_size ?? 14 })
              : t("partySizeHint")}
          </p>

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">
            {t("timeTonight")} ({active.opening_time?.slice(0, 5) || "18:00"}–{active.closing_time?.slice(0, 5) || "21:30"})
          </label>
          <div className="grid grid-cols-3 gap-2 mt-2 mb-5">
            {generateTimeSlots(active.opening_time, active.closing_time).map((tm) => {
              const remaining = timeAvailability[tm];
              const full = trackingTimeAvailability && remaining === 0;
              const selected = time === tm;
              return (
                <button
                  key={tm}
                  disabled={full}
                  onClick={() => setTime(tm)}
                  className={`rounded-2xl py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5 ${
                    full
                      ? "bg-tan/50 text-taupe opacity-60 cursor-not-allowed"
                      : selected
                      ? "bg-burgundy text-offwhite"
                      : "bg-tan text-charcoal"
                  }`}
                >
                  {tm}
                  {trackingTimeAvailability && (
                    <span className={`text-[9px] font-medium ${full ? "text-warn" : selected ? "text-offwhite/70" : "text-muted"}`}>
                      {full ? t("slotFull") : t("tablesLeft", { count: remaining })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("celebrating")}</label>
          <div className="grid grid-cols-4 gap-2 mt-2 mb-5">
            {OCCASIONS.map((o) => {
              const Icon = o.icon;
              const selected = occasion === o.label;
              return (
                <button
                  key={o.label}
                  onClick={() => setOccasion(o.label)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] font-medium ${
                    selected ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                  }`}
                >
                  {Icon ? <Icon size={14} /> : <span className="h-[14px]" />}
                  {t(o.key)}
                </button>
              );
            })}
          </div>

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("yourName")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fullName")}
            className="w-full rounded-full px-4 py-3.5 text-sm mt-2 mb-3 outline-none bg-tan text-charcoal placeholder:text-taupe"
          />

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("mobileNumber")}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 5X XXX XXXX"
            className="w-full rounded-full px-4 py-3.5 text-sm mt-2 mb-6 outline-none bg-tan text-charcoal placeholder:text-taupe"
          />

          <button
            onClick={() => setScreen("zone")}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]"
          >
            {t("continueSeating")}
          </button>
        </div>
      )}

      {tab === "discover" && screen === "zone" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("book")} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-xl mt-2 text-charcoal">{t("whereSit")}</h2>
          <div className="w-8 h-0.5 bg-brass my-3.5" />
          <p className="text-sm mb-5 text-muted">
            {active.name} · {bookingDate} · {party} guests · {time}
          </p>

          <div className="flex flex-col gap-3 mb-6">
            {(active.zones && active.zones.length > 0 ? active.zones : ["Indoor"]).map((z) => {
              const Icon = ZONE_ICONS[z] || Home;
              const selected = zone === z;
              const full = !!zoneAvailability[z];
              const zk = ZONE_KEYS[z] || { label: null, desc: null };
              return (
                <button
                  key={z}
                  disabled={full}
                  onClick={() => setZone(z)}
                  className={`flex items-center gap-3.5 rounded-[20px] p-4 text-left shadow-[0_4px_14px_rgba(43,31,33,0.05)] border ${
                    full
                      ? "bg-tan/30 border-transparent opacity-55 cursor-not-allowed"
                      : selected
                      ? "bg-card border-brass shadow-[0_6px_18px_rgba(43,31,33,0.1)]"
                      : "bg-card border-transparent"
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selected && !full ? "bg-burgundy" : "bg-tan"
                    }`}
                  >
                    <Icon size={18} className={selected && !full ? "text-offwhite" : "text-burgundy"} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-charcoal">
                      {zk.label ? t(zk.label) : z}
                    </div>
                    <div className={`text-xs mt-0.5 ${full ? "text-warn font-medium" : "text-muted"}`}>
                      {full ? t("fullyBooked") : zk.desc ? t(zk.desc) : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setScreen("hold")}
            disabled={zoneAvailability[zone]}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)] disabled:opacity-50"
          >
            {t("continueSecure")}
          </button>
        </div>
      )}

      {tab === "discover" && screen === "hold" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("book")} className="flex items-center gap-1 text-sm text-burgundy py-2 font-medium">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <div className="flex items-center gap-2 mt-2 mb-1">
            <ShieldCheck size={18} className="text-burgundy" />
            <h2 className="font-serif text-xl text-charcoal">{t("secureTable")}</h2>
          </div>
          <p className="text-sm mb-5 text-muted">
            {active.name} {t("holdsTable")}
          </p>

          <div className="rounded-2xl p-4 mb-6 flex items-start gap-3 bg-card border border-brass/40">
            <AlertTriangle size={16} className="text-brass mt-0.5 flex-shrink-0" />
            <div className="text-xs text-charcoal">
              <span className="font-semibold">
                {t("noShowFeeLabel", { fee: active.no_show_fee_aed })}
              </span>{" "}
              <span className="text-muted">{t("freeCancelLabel", { hours: active.cancellation_notice_hours ?? 2 })}</span>
            </div>
          </div>

          <label className="text-[11px] font-bold uppercase tracking-widest text-taupe">{t("cardNumber")}</label>
          <div className="flex items-center gap-2 rounded-full px-4 py-3.5 mt-2 mb-6 bg-tan">
            <CreditCard size={16} className="text-muted" />
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="4242 4242 4242 4242"
              className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-taupe"
            />
          </div>

          <button
            onClick={confirmBooking}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)] mb-3"
          >
            {t("confirmHold")}
          </button>
          <p className="text-[11px] text-center text-taupe">{t("cardDisclaimer")}</p>
        </div>
      )}

      {tab === "discover" && screen === "confirmed" && lastBooking && (
        <div className="flex flex-col items-center justify-center text-center pt-24">
          <div className="w-[76px] h-[76px] rounded-full flex items-center justify-center mb-6 bg-burgundy shadow-[0_8px_20px_rgba(74,23,41,0.25)]">
            <Check className="text-offwhite" size={30} />
          </div>
          <h2 className="font-serif text-2xl mb-1 text-charcoal">
            {t("tableRequested")}
          </h2>
          <div className="w-8 h-0.5 bg-brass my-3.5" />
          <p className="text-sm mb-7 text-muted max-w-[260px]">
            <span className="italic text-burgundy">{active?.name}</span> {t("hasBeenNotified")}
          </p>
          <div className="w-full rounded-[22px] p-5 text-sm text-left mb-7 bg-card">
            <div className="flex justify-between py-1.5">
              <span className="text-muted">{t("date")}</span>
              <span className="text-charcoal font-medium">{lastBooking.booking_date}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted">{t("seating")}</span>
              <span className="text-charcoal font-medium">{lastBooking.zone}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted">{t("time")}</span>
              <span className="text-charcoal font-medium">{lastBooking.booking_time}</span>
            </div>
            {lastBooking.occasion && (
              <div className="flex justify-between py-1.5">
                <span className="text-muted">{t("occasion")}</span>
                <span className="text-charcoal font-medium">{lastBooking.occasion}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => shareBooking(lastBooking)}
            className="w-full rounded-full py-4 text-sm font-semibold mb-3 flex items-center justify-center gap-2 bg-brass text-charcoal"
          >
            <Share2 size={15} /> {t("shareFriends")}
          </button>
          <button
            onClick={() => setScreen("home")}
            className="w-full rounded-full py-4 text-sm font-semibold bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]"
          >
            {t("done")}
          </button>
        </div>
      )}

      {tab === "myBookings" && (
        <div className="pt-6">
          <h2 className="font-serif text-2xl mb-1 text-charcoal">{t("myBookings")}</h2>
          <p className="text-sm mb-5 text-muted">{t("myBookingsDesc")}</p>

          <div className="flex bg-tan rounded-full p-1 mb-5">
            <button
              onClick={() => setBookingsView("current")}
              className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
                bookingsView === "current" ? "bg-burgundy text-offwhite" : "text-muted"
              }`}
            >
              {t("currentBookings")}
            </button>
            <button
              onClick={() => setBookingsView("past")}
              className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
                bookingsView === "past" ? "bg-burgundy text-offwhite" : "text-muted"
              }`}
            >
              {t("pastBookings")}
            </button>
          </div>

          {visibleBookings.length === 0 && (
            <p className="text-sm text-taupe py-8 text-center">
              {bookingsView === "current" ? t("myBookingsEmpty") : t("pastBookingsEmpty")}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {visibleBookings.map((b) => {
              const statusInfo =
                b.status === "pending"
                  ? { label: t("awaitingConfirmation"), cls: "text-brass border-brass" }
                  : b.status === "confirmed"
                  ? { label: t("heldStatus"), cls: "text-burgundy border-burgundy" }
                  : b.status === "dined"
                  ? { label: t("dined"), cls: "text-taupe border-taupe" }
                  : b.status === "declined"
                  ? { label: t("declined"), cls: "text-warn border-warn" }
                  : b.status === "cancelled"
                  ? { label: t("cancelled"), cls: "text-warn border-warn" }
                  : b.status === "no-show"
                  ? { label: t("noShowStatus"), cls: "text-warn border-warn" }
                  : { label: b.status, cls: "text-muted border-muted" };
              return (
                <div key={b.id} className="rounded-[20px] p-4 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.05)]">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-serif text-lg text-charcoal">{b.restaurants?.name}</div>
                    {b.occasion && (
                      <span className="text-[10px] font-medium rounded-full px-2.5 py-1 border border-brass text-brass">
                        {b.occasion}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mb-3">
                    {b.restaurants?.area} · {b.booking_date} · {b.booking_time} · {b.zone} · {b.party_size} guests
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-3 py-1 border ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                    <button
                      onClick={() => shareBooking(b)}
                      className="flex items-center gap-1 text-xs font-medium rounded-full px-3 py-1.5 bg-tan text-charcoal"
                    >
                      <Share2 size={12} /> {t("share")}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {canFreelyCancel(b, b.restaurants?.cancellation_notice_hours ?? 2) && (
                      <button
                        onClick={() => cancelBooking(b)}
                        className="flex-1 text-xs font-semibold rounded-full px-3 py-2.5 text-warn underline"
                      >
                        {b.status === "confirmed" ? t("cancelReservation") : t("cancelRequest")}
                      </button>
                    )}
                    <button
                      onClick={() => removeFromMyBookings(b.id)}
                      className="flex-1 text-xs font-medium rounded-full px-3 py-2.5 bg-tan text-muted"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="fixed left-0 right-0 bottom-0 bg-cream border-t border-charcoal/[0.08] flex pb-3.5 pt-2">
        <button
          onClick={() => setTab("discover")}
          className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold ${
            tab === "discover" ? "text-burgundy" : "text-taupe"
          }`}
        >
          <Compass size={20} />
          {t("discover")}
        </button>
        <button
          onClick={() => setTab("myBookings")}
          className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold ${
            tab === "myBookings" ? "text-burgundy" : "text-taupe"
          }`}
        >
          <BookMarked size={20} />
          {t("myBookings")}
        </button>
      </div>
    </div>
  );
}
