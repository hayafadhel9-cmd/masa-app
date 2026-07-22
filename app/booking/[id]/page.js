"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { addMyBookingId } from "../../../lib/myBookings";
import { Cake, Heart, Briefcase, MapPin, Clock, Users, Check, BookmarkPlus } from "lucide-react";

const OCCASION_ICONS = {
  Birthday: Cake,
  Anniversary: Heart,
  Business: Briefcase,
};

export default function SharedBookingPage() {
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
    return <div className="max-w-md mx-auto min-h-screen bg-ivory px-5 pt-10 text-neutral-500 text-sm">Loading…</div>;
  }

  if (!booking) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-ivory px-5 pt-10 text-center">
        <p className="text-sm text-neutral-500">This booking link doesn't seem to be valid.</p>
      </div>
    );
  }

  const OccasionIcon = OCCASION_ICONS[booking.occasion] || null;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-ivory px-5 pt-10 pb-10">
      <p className="text-xs uppercase tracking-widest text-neutral-400 mb-2">You've been invited to</p>
      <h1 className="font-serif text-2xl text-ink mb-1">{booking.restaurants?.name}</h1>
      <div className="text-sm text-neutral-500 mb-6 flex items-center gap-1">
        <MapPin size={13} /> {booking.restaurants?.area} · {booking.restaurants?.cuisine}
      </div>

      <div className="rounded-xl p-4 bg-white border border-neutral-200 mb-6">
        <div className="flex items-center gap-2 text-sm py-1.5">
          <Clock size={14} className="text-neutral-400" />
          <span className="text-ink">{booking.booking_time}</span>
        </div>
        <div className="flex items-center gap-2 text-sm py-1.5">
          <Users size={14} className="text-neutral-400" />
          <span className="text-ink">{booking.party_size} guests · {booking.zone}</span>
        </div>
        {booking.occasion && (
          <div className="flex items-center gap-2 text-sm py-1.5">
            {OccasionIcon ? <OccasionIcon size={14} className="text-neutral-400" /> : null}
            <span className="text-ink">{booking.occasion}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm py-1.5">
          <span
            className={`text-xs font-medium ${
              booking.status === "confirmed" ? "text-green-700" : "text-amber-700"
            }`}
          >
            {booking.status === "confirmed" ? "Confirmed" : "Awaiting confirmation"}
          </span>
        </div>
      </div>

      {saved ? (
        <div className="w-full rounded-full py-3 text-sm font-medium flex items-center justify-center gap-2 bg-teal text-ivory">
          <Check size={15} /> Saved to My Bookings
        </div>
      ) : (
        <button
          onClick={saveToMyBookings}
          className="w-full rounded-full py-3 text-sm font-medium flex items-center justify-center gap-2 bg-brass text-ink"
        >
          <BookmarkPlus size={15} /> Save to My Bookings
        </button>
      )}

      <a href="/" className="block text-center text-xs mt-4 text-neutral-400 underline">
        Browse more restaurants
      </a>
    </div>
  );
}
