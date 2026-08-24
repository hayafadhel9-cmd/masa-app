"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Search, Star, MapPin, ChevronLeft, Users, ShieldCheck, AlertTriangle, CreditCard, Check, Trees, Wind, Home, Cake, Heart, Briefcase, Share2, Copy, Compass, BookMarked, Globe } from "lucide-react";
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

  async function confirmBooking() {
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

  async function cancelBooking(id) {
    if (!confirm("Cancel this reservation? The restaurant will be notified right away.")) return;
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
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

  return (
    <div className="mx-auto max-w-md min-h-screen bg-ivory px-5 pb-24 relative">
      {tab === "discover" && screen === "home" && (
        <>
          <div className="flex items-center justify-between pt-6 mb-1">
            <h1 className="font-serif text-2xl text-ink">
              {t("headline1")}
              <br />{t("headline2")}
            </h1>
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1.5 bg-white border border-neutral-200 flex-shrink-0 ml-2"
            >
              <Globe size={12} /> {lang === "en" ? "عربي" : "EN"}
            </button>
          </div>
          <p className="text-sm mb-4 text-neutral-600">{t("subheadline")}</p>

          <div className="flex items-center gap-2 rounded-full px-4 py-2.5 mb-4 bg-white border border-neutral-200">
            <Search size={16} className="text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          {loading && <p className="text-sm text-neutral-500">{t("loadingRestaurants")}</p>}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-neutral-500 py-8 text-center">{t("noRestaurants")}</p>
          )}

          <div className="flex flex-col gap-3">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => openRestaurant(r)}
                className="text-left rounded-xl p-4 bg-white border border-neutral-200"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-serif text-lg text-ink">{r.name}</div>
                    <div className="text-xs mt-0.5 text-neutral-500">
                      {r.cuisine} · {r.area} · {r.price_tier}
                    </div>
                  </div>
                  {r.subscription_status === "trial" && (
                    <span className="text-[10px] rounded-full px-2 py-1 bg-amber-100 text-amber-700">
                      {t("trialPartner")}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "discover" && screen === "restaurant" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("home")} className="flex items-center gap-1 text-sm text-teal py-2">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-2xl text-ink">{active.name}</h2>
          <div className="text-xs mt-1 mb-4 flex items-center gap-2 text-neutral-500">
            <MapPin size={12} /> {active.area}
          </div>

          <div className="text-[10px] uppercase tracking-widest mb-2 text-neutral-400">
            {t("menuHighlights")}
          </div>
          <div className="flex flex-col gap-2 mb-5">
            {menuItems.length === 0 && (
              <p className="text-sm text-neutral-400">{t("noMenuItems")}</p>
            )}
            {menuItems.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-dashed border-neutral-200">
                <span className="text-ink">{m.name}</span>
                <span className="text-amber-700">AED {m.price_aed}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setScreen("book")}
            className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory"
          >
            {t("reserveTable")}
          </button>
        </div>
      )}

      {tab === "discover" && screen === "book" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("restaurant")} className="flex items-center gap-1 text-sm text-teal py-2">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-xl mb-4 text-ink">{t("reserveAt")} {active.name}</h2>

          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("date")}</label>
          <input
            type="date"
            value={bookingDate}
            min={toLocalDateStr(addDays(new Date(), active.min_advance_days ?? 0))}
            max={toLocalDateStr(addDays(new Date(), active.max_advance_days ?? 30))}
            onChange={(e) => setBookingDate(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 mb-4 outline-none bg-white border border-neutral-200"
          />

          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("partySize")}</label>
          <div className="flex items-center gap-3 mt-2 mb-4">
            <button
              type="button"
              onClick={() => setParty(Math.max(1, party - 1))}
              className="w-10 h-10 rounded-lg flex items-center justify-center bg-white border border-neutral-200 text-lg text-ink"
            >
              −
            </button>
            <div className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 bg-teal text-ivory">
              <Users size={14} /> {party}
            </div>
            <button
              type="button"
              onClick={() => setParty(Math.min(active.max_party_size ?? 14, party + 1))}
              className="w-10 h-10 rounded-lg flex items-center justify-center bg-white border border-neutral-200 text-lg text-ink"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 -mt-3 mb-4">
            {party >= (active.max_party_size ?? 14)
              ? `For groups larger than ${active.max_party_size ?? 14}, please contact the restaurant directly.`
              : "Enter your exact group size — we'll seat you at the right table."}
          </p>

          <label className="text-[10px] uppercase tracking-widest text-neutral-400">
            {t("timeTonight")} ({active.opening_time?.slice(0, 5) || "18:00"}–{active.closing_time?.slice(0, 5) || "21:30"})
          </label>
          <div className="grid grid-cols-4 gap-2 mt-2 mb-4">
            {generateTimeSlots(active.opening_time, active.closing_time).map((tm) => (
              <button
                key={tm}
                onClick={() => setTime(tm)}
                className={`rounded-lg py-2 text-xs border ${
                  time === tm ? "bg-teal text-ivory border-teal" : "bg-white text-ink border-neutral-200"
                }`}
              >
                {tm}
              </button>
            ))}
          </div>

          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("celebrating")}</label>
          <div className="grid grid-cols-4 gap-2 mt-2 mb-4">
            {OCCASIONS.map((o) => {
              const Icon = o.icon;
              const selected = occasion === o.label;
              return (
                <button
                  key={o.label}
                  onClick={() => setOccasion(o.label)}
                  className={`flex flex-col items-center gap-1 rounded-lg py-2.5 text-[11px] border ${
                    selected ? "bg-teal text-ivory border-teal" : "bg-white text-ink border-neutral-200"
                  }`}
                >
                  {Icon ? <Icon size={14} /> : <span className="h-[14px]" />}
                  {t(o.key)}
                </button>
              );
            })}
          </div>

          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("yourName")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fullName")}
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 mb-4 outline-none bg-white border border-neutral-200"
          />

          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("mobileNumber")}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 5X XXX XXXX"
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 mb-6 outline-none bg-white border border-neutral-200"
          />

          <button
            onClick={() => setScreen("zone")}
            className="w-full rounded-full py-3 text-sm font-medium bg-brass text-ink"
          >
            {t("continueSeating")}
          </button>
        </div>
      )}

      {tab === "discover" && screen === "zone" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("book")} className="flex items-center gap-1 text-sm text-teal py-2">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <h2 className="font-serif text-xl mb-1 text-ink">{t("whereSit")}</h2>
          <p className="text-sm mb-4 text-neutral-500">
            {active.name} · {bookingDate} · {party} guests · {time}
          </p>

          <div className="flex flex-col gap-3 mb-6">
            {(active.zones && active.zones.length > 0 ? active.zones : ["Indoor"]).map((z) => {
              const Icon = ZONE_ICONS[z] || Home;
              const selected = zone === z;
              const zk = ZONE_KEYS[z] || { label: null, desc: null };
              return (
                <button
                  key={z}
                  onClick={() => setZone(z)}
                  className={`flex items-center gap-3 rounded-xl p-4 text-left border ${
                    selected ? "bg-teal border-teal" : "bg-white border-neutral-200"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selected ? "bg-white/15" : "bg-neutral-100"
                    }`}
                  >
                    <Icon size={18} className={selected ? "text-brass" : "text-neutral-500"} />
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${selected ? "text-ivory" : "text-ink"}`}>
                      {zk.label ? t(zk.label) : z}
                    </div>
                    <div className={`text-xs ${selected ? "text-ivory/70" : "text-neutral-500"}`}>
                      {zk.desc ? t(zk.desc) : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setScreen("hold")}
            className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory"
          >
            {t("continueSecure")}
          </button>
        </div>
      )}

      {tab === "discover" && screen === "hold" && active && (
        <div className="pt-4">
          <button onClick={() => setScreen("book")} className="flex items-center gap-1 text-sm text-teal py-2">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("back")}
          </button>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-teal" />
            <h2 className="font-serif text-xl text-ink">{t("secureTable")}</h2>
          </div>
          <p className="text-sm mb-4 text-neutral-600">
            {active.name} {t("holdsTable")}
          </p>

          <div className="rounded-xl p-4 mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200">
            <AlertTriangle size={16} className="text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800">
              <span className="font-medium">
                {t("noShowFeeLabel", { fee: active.no_show_fee_aed })}
              </span>{" "}
              {t("freeCancelLabel", { hours: active.cancellation_notice_hours ?? 2 })}
            </div>
          </div>

          <label className="text-[10px] uppercase tracking-widest text-neutral-400">{t("cardNumber")}</label>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mt-2 mb-6 bg-white border border-neutral-200">
            <CreditCard size={16} className="text-neutral-400" />
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="4242 4242 4242 4242"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          <button
            onClick={confirmBooking}
            className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory mb-3"
          >
            {t("confirmHold")}
          </button>
          <p className="text-[11px] text-center text-neutral-400">{t("cardDisclaimer")}</p>
        </div>
      )}

      {tab === "discover" && screen === "confirmed" && lastBooking && (
        <div className="flex flex-col items-center justify-center text-center pt-24">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-teal">
            <Check className="text-brass" size={26} />
          </div>
          <h2 className="font-serif text-xl mb-1 text-ink">{t("tableRequested")}</h2>
          <p className="text-sm mb-6 text-neutral-600">
            {active.name} {t("hasBeenNotified")}
          </p>
          <div className="w-full rounded-xl p-4 text-sm text-left mb-6 bg-white border border-neutral-200">
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">{t("date")}</span>
              <span className="text-ink">{lastBooking.booking_date}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">{t("seating")}</span>
              <span className="text-ink">{lastBooking.zone}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">{t("time")}</span>
              <span className="text-ink">{lastBooking.booking_time}</span>
            </div>
            {lastBooking.occasion && (
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">{t("occasion")}</span>
                <span className="text-ink">{lastBooking.occasion}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => shareBooking(lastBooking)}
            className="w-full rounded-full py-3 text-sm font-medium mb-3 flex items-center justify-center gap-2 bg-brass text-ink"
          >
            <Share2 size={15} /> {t("shareFriends")}
          </button>
          <button
            onClick={() => setScreen("home")}
            className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory"
          >
            {t("done")}
          </button>
        </div>
      )}

      {tab === "myBookings" && (
        <div className="pt-6">
          <h2 className="font-serif text-2xl mb-1 text-ink">{t("myBookings")}</h2>
          <p className="text-sm mb-4 text-neutral-500">{t("myBookingsDesc")}</p>

          {myBookings.length === 0 && (
            <p className="text-sm text-neutral-400 py-8 text-center">{t("myBookingsEmpty")}</p>
          )}

          <div className="flex flex-col gap-3">
            {myBookings.map((b) => (
              <div key={b.id} className="rounded-xl p-4 bg-white border border-neutral-200">
                <div className="flex items-start justify-between mb-1">
                  <div className="font-serif text-lg text-ink">{b.restaurants?.name}</div>
                  {b.occasion && (
                    <span className="text-[10px] rounded-full px-2 py-1 bg-amber-100 text-amber-700">
                      {b.occasion}
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mb-3">
                  {b.restaurants?.area} · {b.booking_date} · {b.booking_time} · {b.zone} · {b.party_size} guests
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-medium ${
                      b.status === "confirmed"
                        ? "text-green-700"
                        : b.status === "declined" || b.status === "cancelled"
                        ? "text-red-700"
                        : b.status === "no-show"
                        ? "text-red-700"
                        : "text-amber-700"
                    }`}
                  >
                    {b.status === "pending"
                      ? t("awaitingConfirmation")
                      : b.status === "cancelled"
                      ? t("cancelled")
                      : b.status}
                  </span>
                  <button
                    onClick={() => shareBooking(b)}
                    className="flex items-center gap-1 text-xs rounded-full px-3 py-1.5 bg-neutral-100 text-ink"
                  >
                    <Share2 size={12} /> {t("share")}
                  </button>
                </div>
                <div className="flex gap-2">
                  {canFreelyCancel(b, b.restaurants?.cancellation_notice_hours ?? 2) && (
                    <button
                      onClick={() => cancelBooking(b.id)}
                      className="flex-1 text-xs rounded-full px-3 py-2 bg-red-50 text-red-700 border border-red-200"
                    >
                      {t("cancelReservation")}
                    </button>
                  )}
                  <button
                    onClick={() => removeFromMyBookings(b.id)}
                    className="flex-1 text-xs rounded-full px-3 py-2 bg-neutral-100 text-neutral-600"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-6 pointer-events-none">
        <div className="flex gap-1 rounded-full p-1 bg-white border border-neutral-200 shadow-lg pointer-events-auto">
          <button
            onClick={() => setTab("discover")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium ${
              tab === "discover" ? "bg-teal text-ivory" : "text-neutral-500"
            }`}
          >
            <Compass size={14} /> {t("discover")}
          </button>
          <button
            onClick={() => setTab("myBookings")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium ${
              tab === "myBookings" ? "bg-teal text-ivory" : "text-neutral-500"
            }`}
          >
            <BookMarked size={14} /> {t("myBookings")}
          </button>
        </div>
      </div>
    </div>
  );
}
