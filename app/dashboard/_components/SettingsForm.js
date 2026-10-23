"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { toLocalDateStr } from "../../../lib/date";
import { Save, Plus, Trash2, Camera, ImageOff } from "lucide-react";
import { useLanguage } from "../../../lib/LanguageContext";
import ConfirmSheet from "../../components/ConfirmSheet";

const MENU_PHOTOS_BUCKET = "menu-photos";
// Mirrors the menu-photos storage bucket's own file_size_limit and
// allowed_mime_types (the real, server-enforced boundary) — this is just
// faster feedback for legitimate users, not the security check itself.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function validatePhotoFile(file, t) {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return t("photoTypeInvalid");
  if (file.size > MAX_PHOTO_BYTES) return t("photoTooLarge");
  return null;
}

function extractStoragePath(url) {
  if (!url) return null;
  const marker = `/${MENU_PHOTOS_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

const PRICE_TIERS = ["$", "$$", "$$$", "$$$$"];

// 0=Sunday..6=Saturday (JS Date#getDay()) — a known Sunday (2023-01-01) used
// purely to generate a locale-correct short weekday label per index, same
// Intl.DateTimeFormat approach already used elsewhere (lib/relativeDate.js).
function dayLabel(dayIndex, lang) {
  const sunday = new Date(2023, 0, 1 + dayIndex);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-US", { weekday: "short" }).format(sunday);
}
const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6];

const FIELD_LABEL = "text-[10px] font-bold uppercase tracking-widest text-taupe";
const FIELD_INPUT = "w-full rounded-full px-4 py-2.5 text-sm mt-2 outline-none bg-tan text-charcoal placeholder:text-taupe";

// The full restaurant-settings form — restaurant info, booking rules,
// no-show/cancellation, minimum spend, seating areas, menu, and the
// dashboard's own language setting. Used two ways: standalone on
// /dashboard/settings (onboarding + direct access, `areas`/`onAreasChanged`
// left undefined so it manages its own area list) and embedded as the new
// Settings tab inside the dashboard shell (`areas`/`onAreasChanged` passed
// in so area edits here immediately show up in Requests' zone-capacity
// lines too, instead of going stale until the next tab switch).
export default function SettingsForm({
  restaurant,
  isOnboarding = false,
  showHeading = true,
  pendingRestaurantName = "",
  onSaved,
  areas: areasProp,
  onAreasChanged,
}) {
  const { lang, setLang, t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [saveError, setSaveError] = useState(false);

  const [name, setName] = useState(restaurant?.name || pendingRestaurantName || "");
  const [cuisine, setCuisine] = useState(restaurant?.cuisine || "");
  const [area, setArea] = useState(restaurant?.area || "");
  const [address, setAddress] = useState(restaurant?.address || "");
  const [priceTier, setPriceTier] = useState(restaurant?.price_tier || "$$");
  const [noShowFee, setNoShowFee] = useState(restaurant?.no_show_fee_aed ?? 0);
  const [noticeHours, setNoticeHours] = useState(restaurant?.cancellation_notice_hours ?? 2);
  const [openingTime, setOpeningTime] = useState(restaurant?.opening_time || "18:00");
  const [closingTime, setClosingTime] = useState(restaurant?.closing_time || "21:30");
  const [partySizes, setPartySizes] = useState(
    restaurant?.party_sizes?.length > 0 ? restaurant.party_sizes : [2, 4, 6, 8]
  );
  const [minAdvanceDays, setMinAdvanceDays] = useState(restaurant?.min_advance_days ?? 0);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(restaurant?.max_advance_days ?? 30);
  const [maxPartySize, setMaxPartySize] = useState(restaurant?.max_party_size ?? 14);
  const [minSpendAed, setMinSpendAed] = useState(restaurant?.min_spend_aed ?? 0);
  const [minSpendNights, setMinSpendNights] = useState(restaurant?.min_spend_nights || []);

  const [internalAreas, setInternalAreas] = useState([]);
  const areas = areasProp ?? internalAreas;
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaCapacity, setNewAreaCapacity] = useState("");
  const [addingArea, setAddingArea] = useState(false);

  const [menuItems, setMenuItems] = useState([]);
  const [newDishName, setNewDishName] = useState("");
  const [newDishPrice, setNewDishPrice] = useState("");
  const [newDishFile, setNewDishFile] = useState(null);
  const [newDishPreview, setNewDishPreview] = useState("");
  const [addingDish, setAddingDish] = useState(false);

  // The one confirm sheet currently pending — { title, description,
  // confirmLabel, onConfirm } | null. Replaces window.confirm() everywhere
  // on this form; see ConfirmSheet for the component itself.
  const [confirmState, setConfirmState] = useState(null);

  const loadAreas = useCallback(
    async (restaurantId) => {
      if (onAreasChanged) {
        await onAreasChanged();
        return;
      }
      if (!restaurantId) return;
      const { data } = await supabase
        .from("restaurant_areas")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at");
      setInternalAreas(data || []);
    },
    [onAreasChanged]
  );

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
    if (!restaurant) return;
    if (!areasProp) loadAreas(restaurant.id);
    loadMenuItems(restaurant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  async function uploadMenuPhoto(file) {
    const path = `${restaurant.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from(MENU_PHOTOS_BUCKET).upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from(MENU_PHOTOS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function handleNewDishFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const issue = validatePhotoFile(file, t);
    if (issue) {
      alert(issue);
      e.target.value = "";
      return;
    }
    setNewDishFile(file);
    setNewDishPreview(URL.createObjectURL(file));
  }

  async function addMenuItem() {
    if (!newDishName.trim() || !newDishPrice) return;
    setAddingDish(true);
    try {
      const photo_url = newDishFile ? await uploadMenuPhoto(newDishFile) : null;
      await supabase.from("menu_items").insert({
        restaurant_id: restaurant.id,
        name: newDishName.trim(),
        price_aed: Number(newDishPrice),
        sort_order: menuItems.length,
        photo_url,
      });
      setNewDishName("");
      setNewDishPrice("");
      setNewDishFile(null);
      setNewDishPreview("");
      await loadMenuItems(restaurant.id);
    } catch (err) {
      alert("Photo upload failed: " + err.message);
    }
    setAddingDish(false);
  }

  async function saveMenuItem(item, patch, file) {
    try {
      let photo_url = item.photo_url;
      if (file) {
        photo_url = await uploadMenuPhoto(file);
        const oldPath = extractStoragePath(item.photo_url);
        if (oldPath) await supabase.storage.from(MENU_PHOTOS_BUCKET).remove([oldPath]);
      }
      await supabase.from("menu_items").update({ ...patch, photo_url }).eq("id", item.id);
      await loadMenuItems(restaurant.id);
    } catch (err) {
      alert("Photo upload failed: " + err.message);
    }
  }

  function deleteMenuItem(item) {
    setConfirmState({
      title: t("deleteDishConfirmTitle", { name: item.name }),
      confirmLabel: t("delete"),
      onConfirm: async () => {
        setConfirmState(null);
        await supabase.from("menu_items").delete().eq("id", item.id);
        const path = extractStoragePath(item.photo_url);
        if (path) await supabase.storage.from(MENU_PHOTOS_BUCKET).remove([path]);
        await loadMenuItems(restaurant.id);
      },
    });
  }

  function togglePartySize(size) {
    setPartySizes((prev) =>
      prev.includes(size) ? prev.filter((x) => x !== size) : [...prev, size].sort((a, b) => a - b)
    );
  }

  function toggleMinSpendNight(dayIndex) {
    setMinSpendNights((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  }

  async function addArea() {
    if (!newAreaName.trim()) return;
    setAddingArea(true);
    const { error } = await supabase.from("restaurant_areas").insert({
      restaurant_id: restaurant.id,
      name: newAreaName.trim(),
      capacity: newAreaCapacity === "" ? null : Number(newAreaCapacity),
    });
    setAddingArea(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNewAreaName("");
    setNewAreaCapacity("");
    await loadAreas(restaurant.id);
  }

  // Returns true on success so the row can leave edit mode.
  async function saveArea(areaRow, patch) {
    const { error } = await supabase.from("restaurant_areas").update(patch).eq("id", areaRow.id);
    if (error) {
      alert(error.message);
      return false;
    }
    await loadAreas(restaurant.id);
    return true;
  }

  async function deleteArea(areaRow) {
    if (areas.length <= 1) {
      alert(t("removeAreaBlockedLastOne"));
      return;
    }
    // Friendly, specific message up front — the DB trigger blocks this too
    // (defense in depth for a raw API call), but its generic error isn't as
    // clear as checking here first.
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("zone", areaRow.name)
      .in("status", ["pending", "confirmed"])
      .gte("booking_date", toLocalDateStr(new Date()));
    if ((count || 0) > 0) {
      alert(t("removeAreaBlockedUpcoming"));
      return;
    }
    setConfirmState({
      title: t("removeAreaConfirmTitle", { name: areaRow.name }),
      description: t("removeAreaConfirmBody"),
      confirmLabel: t("remove"),
      onConfirm: async () => {
        setConfirmState(null);
        const { error } = await supabase.from("restaurant_areas").delete().eq("id", areaRow.id);
        if (error) {
          alert(error.message);
          return;
        }
        await loadAreas(restaurant.id);
      },
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    setSaveError(false);
    // Only the name/address pair BestTime looks venues up by needs a
    // re-sync — every other field on this form (hours, capacity, fees...)
    // saves the same way it always did, with no BestTime call.
    const nameOrAddressChanged = name !== (restaurant?.name || "") || address !== (restaurant?.address || "");
    const payload = {
      name,
      cuisine,
      area,
      address,
      price_tier: priceTier,
      no_show_fee_aed: Number(noShowFee),
      cancellation_notice_hours: Number(noticeHours),
      opening_time: openingTime,
      closing_time: closingTime,
      party_sizes: partySizes.length > 0 ? partySizes : [2, 4, 6, 8],
      min_advance_days: Number(minAdvanceDays),
      max_advance_days: Number(maxAdvanceDays),
      max_party_size: Number(maxPartySize),
      min_spend_aed: Number(minSpendAed) || 0,
      min_spend_nights: minSpendNights,
    };

    let error;
    let saved = restaurant;
    if (restaurant) {
      ({ error } = await supabase.from("restaurants").update(payload).eq("id", restaurant.id));
      if (!error) saved = { ...restaurant, ...payload };
    } else {
      // First-time save with no existing row yet — happens when a restaurant
      // owner reaches onboarding without a pre-created restaurant (e.g. email
      // confirmation was required at signup, so the row couldn't be created
      // until they had an active session).
      const { data: userData } = await supabase.auth.getUser();
      const { data, error: insertError } = await supabase
        .from("restaurants")
        .insert({ ...payload, owner_id: userData.user?.id, subscription_status: "trial" })
        .select()
        .single();
      error = insertError;
      if (data) {
        saved = data;
        // A restaurant needs at least one seating area from the start —
        // mirrors the old default of a single "Indoor" zone.
        await supabase.from("restaurant_areas").insert({ restaurant_id: data.id, name: "Indoor", capacity: null });
        await loadAreas(data.id);
      }
    }

    setSaving(false);
    if (error) {
      setSaveError(true);
      setSavedMsg("Something went wrong: " + error.message);
      return;
    }
    // Fire-and-forget: BestTime is slow enough (an external API call) that
    // waiting on it here would make a routine save feel broken. Only when
    // the name/address pair that BestTime looks the venue up by actually
    // changed (or this is a brand-new restaurant with an address already
    // filled in) — every other field change saves with no BestTime call.
    if (saved?.id && (nameOrAddressChanged || !restaurant) && address) {
      fetch("/api/besttime/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: saved.id }),
      }).catch(() => {});
    }
    setSavedMsg(t("saved"));
    onSaved?.(saved);
  }

  return (
    <div className="max-w-xl">
      {showHeading && (
        <>
          <h1 className="font-serif text-2xl text-charcoal mb-1">
            {isOnboarding ? t("setUpRestaurant") : t("restaurantSettings")}
          </h1>
          <p className="text-sm text-muted mb-6">{isOnboarding ? t("onboardingSubtitle") : t("settingsSubtitle")}</p>
        </>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Restaurant info */}
        <div>
          <label className={FIELD_LABEL}>{t("restaurantName")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD_INPUT} required />
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("cuisine")}</label>
          <input
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder={t("cuisinePlaceholder")}
            className={FIELD_INPUT}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("area")}</label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder={t("areaPlaceholder")}
            className={FIELD_INPUT}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("address")}</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("addressPlaceholder")}
            className={FIELD_INPUT}
          />
          <p className="text-xs text-taupe mt-1.5">{t("addressHint")}</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("priceTier")}</label>
          <div className="flex gap-2 mt-2">
            {PRICE_TIERS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriceTier(p)}
                className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                  priceTier === p ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Booking rules */}
        <div className="h-px bg-charcoal/[0.08] my-2" />
        <div>
          <label className={FIELD_LABEL}>{t("advanceBookingQuestion")}</label>
          <div className="flex gap-2 mt-2 items-end">
            <div className="flex-1">
              <span className="text-[10px] text-taupe">{t("minNoticeDays")}</span>
              <input
                type="number"
                min="0"
                value={minAdvanceDays}
                onChange={(e) => setMinAdvanceDays(e.target.value)}
                className="w-full rounded-full px-4 py-2.5 text-sm mt-1 outline-none bg-tan text-charcoal"
              />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-taupe">{t("maxWindowDays")}</span>
              <input
                type="number"
                min="0"
                value={maxAdvanceDays}
                onChange={(e) => setMaxAdvanceDays(e.target.value)}
                className="w-full rounded-full px-4 py-2.5 text-sm mt-1 outline-none bg-tan text-charcoal"
              />
            </div>
          </div>
          <p className="text-[11px] text-taupe mt-1.5">{t("advanceBookingHint")}</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("bookingHours")}</label>
          <div className="flex gap-2 mt-2 items-center">
            <input
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none bg-tan text-charcoal"
            />
            <span className="text-xs text-taupe">{t("to")}</span>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none bg-tan text-charcoal"
            />
          </div>
          <p className="text-[11px] text-taupe mt-1.5">{t("bookingHoursHint")}</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("maxPartySizeLabel")}</label>
          <input
            type="number"
            min="1"
            value={maxPartySize}
            onChange={(e) => setMaxPartySize(e.target.value)}
            className={FIELD_INPUT}
          />
          <p className="text-[11px] text-taupe mt-1.5">{t("maxPartySizeHint")}</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("tableSizesOffered")}</label>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {[2, 4, 6, 8, 10, 12].map((size) => (
              <button
                type="button"
                key={size}
                onClick={() => togglePartySize(size)}
                className={`rounded-full py-2 text-sm font-semibold ${
                  partySizes.includes(size) ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* No-show fee + free cancellation */}
        <div className="h-px bg-charcoal/[0.08] my-2" />
        <div>
          <label className={FIELD_LABEL}>{t("noShowFeeSetting")}</label>
          <input
            type="number"
            min="0"
            value={noShowFee}
            onChange={(e) => setNoShowFee(e.target.value)}
            className={FIELD_INPUT}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("cancellationWindowSetting")}</label>
          <input
            type="number"
            min="0"
            value={noticeHours}
            onChange={(e) => setNoticeHours(e.target.value)}
            className={FIELD_INPUT}
          />
        </div>

        {/* Minimum spend */}
        <div className="h-px bg-charcoal/[0.08] my-2" />
        <div>
          <label className={FIELD_LABEL}>{t("minSpendSetting")}</label>
          <input
            type="number"
            min="0"
            value={minSpendAed}
            onChange={(e) => setMinSpendAed(e.target.value)}
            className={FIELD_INPUT}
          />
          <p className="text-[11px] text-taupe mt-1.5">{t("minSpendHint")}</p>
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("minSpendNightsLabel")}</label>
          <div className="grid grid-cols-7 gap-2 mt-2">
            {DAY_INDICES.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleMinSpendNight(d)}
                className={`rounded-full py-2 text-xs font-semibold ${
                  minSpendNights.includes(d) ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                }`}
              >
                {dayLabel(d, lang)}
              </button>
            ))}
          </div>
        </div>

        {savedMsg && <p className={`text-xs ${saveError ? "text-warn" : "text-burgundy"}`}>{savedMsg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full py-3.5 text-sm font-semibold bg-burgundy text-offwhite flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
        >
          <Save size={15} /> {saving ? t("saving") : isOnboarding ? t("finishSetup") : t("saveChanges")}
        </button>
      </form>

      {/* Seating areas */}
      {restaurant && (
        <div className="mt-8 pt-6 border-t border-charcoal/[0.08]">
          <h2 className="font-serif text-xl text-charcoal mb-1">{t("seatingAvailable")}</h2>
          <p className="text-sm text-muted mb-4">{t("zoneCapacityHint")}</p>

          <div className="flex flex-col gap-2 mb-4">
            {areas.map((a) => (
              <AreaRow key={a.id} area={a} onSave={saveArea} onDelete={deleteArea} canDelete={areas.length > 1} t={t} />
            ))}
          </div>

          <div className="rounded-2xl p-3 bg-card border border-dashed border-taupe/40">
            <div className="flex items-center gap-2 mb-2">
              <input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder={t("areaNamePlaceholder")}
                className="flex-1 rounded-full px-4 py-2 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe"
              />
              <input
                type="number"
                min="0"
                value={newAreaCapacity}
                onChange={(e) => setNewAreaCapacity(e.target.value)}
                placeholder={t("areaCapacityPlaceholder")}
                className="w-24 rounded-full px-3 py-2 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe"
              />
            </div>
            <button
              type="button"
              onClick={addArea}
              disabled={addingArea || !newAreaName.trim()}
              className="w-full rounded-full py-2.5 text-xs font-semibold bg-burgundy text-offwhite flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={13} /> {addingArea ? t("adding") : t("addArea")}
            </button>
          </div>
        </div>
      )}

      {/* Menu */}
      {restaurant && (
        <div className="mt-8 pt-6 border-t border-charcoal/[0.08]">
          <h2 className="font-serif text-xl text-charcoal mb-1">{t("menu")}</h2>
          <p className="text-sm text-muted mb-4">{t("menuSectionHint")}</p>

          <div className="flex flex-col gap-2 mb-4">
            {menuItems.length === 0 && <p className="text-xs text-taupe">{t("noMenuItems")}</p>}
            {menuItems.map((item) => (
              <MenuItemRow key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem} t={t} />
            ))}
          </div>

          <div className="rounded-2xl p-3 bg-card border border-dashed border-taupe/40">
            <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-2">{t("addADish")}</div>
            <div className="flex items-center gap-2 mb-2">
              <label className="w-12 h-12 rounded-xl bg-tan flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden">
                {newDishPreview ? (
                  <img src={newDishPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={16} className="text-taupe" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleNewDishFile} />
              </label>
              <input
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                placeholder={t("dishNamePlaceholder")}
                className="flex-1 rounded-full px-4 py-2 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe"
              />
              <input
                type="number"
                min="0"
                value={newDishPrice}
                onChange={(e) => setNewDishPrice(e.target.value)}
                placeholder={t("aedPlaceholder")}
                className="w-20 rounded-full px-3 py-2 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe"
              />
            </div>
            <button
              type="button"
              onClick={addMenuItem}
              disabled={addingDish || !newDishName.trim() || !newDishPrice}
              className="w-full rounded-full py-2.5 text-xs font-semibold bg-burgundy text-offwhite flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={13} /> {addingDish ? t("adding") : t("addDish")}
            </button>
          </div>
        </div>
      )}

      {/* Dashboard language */}
      <div className="mt-8 pt-6 border-t border-charcoal/[0.08]">
        <h2 className="font-serif text-xl text-charcoal mb-1">{t("dashboardLanguageSetting")}</h2>
        <p className="text-sm text-muted mb-4">{t("dashboardLanguageHint")}</p>
        <div className="inline-flex bg-tan rounded-full p-1">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${lang === "en" ? "bg-burgundy text-offwhite" : "text-charcoal"}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("ar")}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${lang === "ar" ? "bg-burgundy text-offwhite" : "text-charcoal"}`}
          >
            العربية
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={t("cancel")}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

function AreaRow({ area, onSave, onDelete, canDelete, t }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(area.name);
  const [capacity, setCapacity] = useState(area.capacity ?? "");
  const [saving, setSaving] = useState(false);

  function cancelEdit() {
    setEditing(false);
    setName(area.name);
    setCapacity(area.capacity ?? "");
  }

  async function handleSave() {
    setSaving(true);
    const ok = await onSave(area, { name: name.trim(), capacity: capacity === "" ? null : Number(capacity) });
    setSaving(false);
    if (ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 rounded-2xl p-3 bg-card">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-charcoal truncate">{area.name}</div>
          <div className="text-xs text-taupe">
            {area.capacity === null || area.capacity === undefined
              ? t("areaCapacityUnset")
              : t("areaCapacityValue", { count: area.capacity })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold rounded-full px-3 py-1.5 bg-tan text-charcoal flex-shrink-0"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => onDelete(area)}
          aria-label={t("removeArea")}
          disabled={!canDelete}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-warn/10 text-warn flex-shrink-0 disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 bg-card ring-2 ring-burgundy">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-full px-4 py-2 text-sm outline-none bg-tan text-charcoal"
        />
        <input
          type="number"
          min="0"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder={t("areaCapacityPlaceholder")}
          className="w-24 rounded-full px-3 py-2 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-full py-2 text-xs font-semibold bg-burgundy text-offwhite disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={cancelEdit} className="flex-1 rounded-full py-2 text-xs font-semibold bg-tan text-charcoal">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

function MenuItemRow({ item, onSave, onDelete, t }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price_aed);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(item.photo_url || "");
  const [saving, setSaving] = useState(false);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const issue = validatePhotoFile(f, t);
    if (issue) {
      alert(issue);
      e.target.value = "";
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function cancelEdit() {
    setEditing(false);
    setFile(null);
    setPreview(item.photo_url || "");
    setName(item.name);
    setPrice(item.price_aed);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(item, { name: name.trim(), price_aed: Number(price) }, file);
    setSaving(false);
    setFile(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 rounded-2xl p-3 bg-card">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-tan flex items-center justify-center flex-shrink-0">
            <ImageOff size={16} className="text-taupe" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-charcoal truncate">{item.name}</div>
          <div className="text-xs text-brass font-semibold">AED {item.price_aed}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold rounded-full px-3 py-1.5 bg-tan text-charcoal flex-shrink-0"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label={t("deleteDish")}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-warn/10 text-warn flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 bg-card ring-2 ring-burgundy">
      <div className="flex items-center gap-2 mb-2">
        <label className="w-12 h-12 rounded-xl bg-tan flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden">
          {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <Camera size={16} className="text-taupe" />}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-full px-4 py-2 text-sm outline-none bg-tan text-charcoal"
        />
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-20 rounded-full px-3 py-2 text-sm outline-none bg-tan text-charcoal"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-full py-2 text-xs font-semibold bg-burgundy text-offwhite disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={cancelEdit} className="flex-1 rounded-full py-2 text-xs font-semibold bg-tan text-charcoal">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
