"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";

// Bottom sheet for adding guests to a booking (My Bookings → "Add guests").
// Self-contained like ConfirmSheet/MenuSheet: owns its own guest-list fetch
// and every mutation (create an invite link, remove a joined guest), driven
// purely by the `booking` prop — pass a booking to open it, null to close.
export default function AddGuestsSheet({ booking, onClose, t }) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const open = !!booking;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timeout = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  async function loadGuests() {
    if (!booking) return;
    setLoading(true);
    const { data } = await supabase
      .from("booking_guests")
      .select("*")
      .eq("booking_id", booking.id)
      .order("created_at");
    setGuests(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (booking) loadGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  function shareLink(token) {
    const url = `${window.location.origin}/invite/${token}`;
    const restaurantName = booking?.restaurants?.name || "our table";
    if (navigator.share) {
      navigator.share({ title: t("shareInviteTitle"), text: t("shareInviteText", { restaurant: restaurantName }), url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert(t("linkCopied"));
    }
  }

  async function handleAddGuest() {
    if (!booking) return;
    setSharing(true);
    const { data, error } = await supabase
      .from("booking_guests")
      .insert({ booking_id: booking.id })
      .select()
      .single();
    setSharing(false);
    if (error || !data) {
      alert(error?.message || "Something went wrong.");
      return;
    }
    setGuests((prev) => [...prev, data]);
    shareLink(data.invite_token);
  }

  async function handleRemove(guest) {
    if (!confirm(t("confirmRemoveGuest"))) return;
    await supabase.from("booking_guests").delete().eq("id", guest.id);
    setGuests((prev) => prev.filter((g) => g.id !== guest.id));
  }

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 transition-opacity duration-200 motion-reduce:duration-0 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-t-[28px] bg-cream px-5 pt-3 pb-8 transition-transform duration-200 motion-reduce:duration-0 ease-out ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-tan mx-auto mb-5" />
        <h3 className="font-serif text-xl text-charcoal mb-1">{t("addGuests")}</h3>
        <p className="text-sm text-muted mb-5">{t("addGuestsHint")}</p>

        {!loading && guests.length > 0 && (
          <div className="flex flex-col gap-2 mb-5">
            {guests.map((g) =>
              g.user_id ? (
                <div key={g.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-card">
                  <div className="w-9 h-9 rounded-full bg-burgundy text-offwhite flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {(g.guest_name || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-charcoal truncate">{g.guest_name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(g)}
                    className="text-xs font-medium text-taupe flex-shrink-0"
                  >
                    {t("remove")}
                  </button>
                </div>
              ) : (
                <div key={g.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-card">
                  <div className="w-9 h-9 rounded-full bg-tan text-taupe flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    ?
                  </div>
                  <span className="flex-1 text-sm text-charcoal">{t("inviteSent")}</span>
                  <span className="text-xs text-taupe flex-shrink-0">{t("waiting")}</span>
                </div>
              )
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleAddGuest}
          disabled={sharing}
          className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-60 mb-3"
        >
          {sharing ? t("pleaseWait") : t("shareInviteLink")}
        </button>
        <button type="button" onClick={onClose} className="w-full text-center text-sm font-medium text-burgundy py-2">
          {t("done")}
        </button>
      </div>
    </div>
  );
}
