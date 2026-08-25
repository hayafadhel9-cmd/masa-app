"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { addMyBookingId } from "../../../lib/myBookings";
import { Cake, Heart, Briefcase, MapPin, Clock, Users, Check, BookmarkPlus } from "lucide-react";
import { useLanguage } from "../../../lib/LanguageContext";

const OCCASION_ICONS = {
  Birthday: Cake,
  Anniversary: Heart,
  Business: Briefcase,
};

export default function SharedBookingPage() {
  const { t } = useLanguage();
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("bookings")
        .select("*, restaurants(name, area, cuisine)")
        .eq("id", id)
        .single();
      setBooking(data || null);
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  function saveToMyBookings() {
    addMyBookingId(id);
    setSaved(true);
  }

  if (loading) {
    return <div className="max-w-md mx-auto min-h-screen bg-cream px-5 pt-10 text-taupe text-sm">Loading…</div>;
  }

  if (!booking) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-cream px-5 pt-10 text-center">
        <p className="text-sm text-muted">This booking link doesn't seem to be valid.</p>
      </div>
    );
  }

  const OccasionIcon = OCCASION_ICONS[booking.occasion] || null;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-cream px-5 pt-10 pb-10">
      <p className="text-xs font-bold uppercase tracking-widest text-taupe mb-2">You've been invited to</p>
      <h1 className="font-serif text-2xl text-charcoal mb-1">{booking.restaurants?.name}</h1>
      <div className="text-sm text-muted mb-6 flex items-center gap-1">
        <MapPin size={13} /> {booking.restaurants?.area} · {booking.restaurants?.cuisine}
      </div>

      <div className="rounded-[20px] p-4 bg-card mb-6">
        <div className="flex items-center gap-2 text-sm py-1.5">
          <Clock size={14} className="text-burgundy" />
          <span className="text-charcoal">{booking.booking_time}</span>
        </div>
        <div className="flex items-center gap-2 text-sm py-1.5">
          <Users size={14} className="text-burgundy" />
          <span className="text-charcoal">{booking.party_size} guests · {booking.zone}</span>
        </div>
        {booking.occasion && (
          <div className="flex items-center gap-2 text-sm py-1.5">
            {OccasionIcon ? <OccasionIcon size={14} className="text-burgundy" /> : null}
            <span className="text-charcoal">{booking.occasion}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm py-1.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-3 py-1 border ${
              booking.status === "confirmed" ? "text-burgundy border-burgundy" : "text-brass border-brass"
            }`}
          >
            {booking.status === "confirmed" ? t("confirmedStatus") : t("awaitingConfirmation")}
          </span>
        </div>
      </div>

      {saved ? (
        <div className="w-full rounded-full py-4 text-sm font-semibold flex items-center justify-center gap-2 bg-burgundy text-offwhite shadow-[0_6px_16px_rgba(74,23,41,0.3)]">
          <Check size={15} /> Saved to My Bookings
        </div>
      ) : (
        <button
          onClick={saveToMyBookings}
          className="w-full rounded-full py-4 text-sm font-semibold flex items-center justify-center gap-2 bg-brass text-charcoal"
        >
          <BookmarkPlus size={15} /> Save to My Bookings
        </button>
      )}

      <a href="/" className="block text-center text-xs mt-5 text-muted underline">
        Browse more restaurants
      </a>
    </div>
  );
}
