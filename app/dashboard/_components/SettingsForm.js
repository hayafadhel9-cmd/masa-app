"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { toLocalDateStr } from "../../../lib/date";
import { Plus, Minus, Trash2, Camera, ImageOff, LogOut, ChevronUp, ChevronDown } from "lucide-react";
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

const SECTION_LABEL = "text-[10px] font-bold uppercase tracking-widest text-taupe flex-shrink-0";
const FIELD_LABEL = "text-[10px] font-bold uppercase tracking-widest text-taupe";
const FIELD_INPUT =
  "w-full rounded-full px-4 py-2.5 text-sm mt-2 outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy";

// A section's small-caps grey label + trailing rule, then an off-white card
// around its fields — the same "label + rule" treatment already used
// elsewhere in the dashboard (e.g. Requests' "OLDEST FIRST").
function SettingsSection({ label, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <span className={SECTION_LABEL}>{label}</span>
        <div className="h-px bg-charcoal/[0.08] flex-1" />
      </div>
      <div className="rounded-[18px] p-5 bg-card shadow-[0_4px_14px_rgba(43,31,33,0.06)]">{children}</div>
    </div>
  );
}

// A plain on/off switch — same look as the dashboard shell's own "Taking
// requests" toggle, reused here for each fee's active flag and the two tip
// settings so all three on/off controls in this app look identical.
function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={label}
      aria-pressed={checked}
      className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors flex-shrink-0 ${
        checked ? "bg-green-700" : "bg-tan"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// A single numeric setting as a left label/hint + right stepper, instead of
// a plain number input — tap targets are 44px (w-11/h-11) per the request.
function StepperRow({ label, hint, value, onChange, unit, min = 0, divider = true }) {
  const n = Number(value) || 0;
  return (
    <div className={`flex items-center justify-between gap-4 py-4 ${divider ? "border-b border-charcoal/[0.08]" : ""}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-charcoal">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, n - 1))}
          aria-label={label}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-tan text-charcoal flex-shrink-0"
        >
          <Minus size={14} />
        </button>
        <div className="min-w-[56px] text-center">
          <span className="text-base font-semibold text-charcoal">{n}</span>
          {unit && <span className="text-xs text-taupe ms-1">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange(n + 1)}
          aria-label={label}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-tan text-charcoal flex-shrink-0"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// The full restaurant-settings form — restaurant info, booking rules,
// no-show/cancellation, minimum spend, seating areas, menu, and the
// dashboard's own language setting. Used two ways: standalone on
// /dashboard/settings (onboarding + direct access, `areas`/`onAreasChanged`
// left undefined so it manages its own area list) and embedded as the
// Settings tab inside the dashboard shell (`areas`/`onAreasChanged` passed
// in so area edits here immediately show up in Requests' zone-capacity
// lines too, instead of going stale until the next tab switch).
export default function SettingsForm({
  restaurant,
  isOnboarding = false,
  showHeading = true,
  pendingRestaurantName = "",
  onSaved,
  onSignOut,
  areas: areasProp,
  onAreasChanged,
  fees: feesProp,
  onFeesChanged,
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
  const [acceptTips, setAcceptTips] = useState(restaurant?.accept_tips ?? true);
  const [tipPercentages, setTipPercentages] = useState(
    restaurant?.tip_percentages?.length === 3 ? restaurant.tip_percentages : [10, 15, 20]
  );
  const [allowCustomTip, setAllowCustomTip] = useState(restaurant?.allow_custom_tip ?? true);

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
  const [newDishStaffOnly, setNewDishStaffOnly] = useState(false);
  const [addingDish, setAddingDish] = useState(false);

  const [internalFees, setInternalFees] = useState([]);
  const fees = feesProp ?? internalFees;
  const [newFeeNameEn, setNewFeeNameEn] = useState("");
  const [newFeeNameAr, setNewFeeNameAr] = useState("");
  const [newFeeType, setNewFeeType] = useState("percent");
  const [newFeeAmount, setNewFeeAmount] = useState("");
  const [addingFee, setAddingFee] = useState(false);

  // The one confirm sheet currently pending — { title, description,
  // confirmLabel, onConfirm } | null. Replaces window.confirm() everywhere
  // on this form; see ConfirmSheet for the component itself.
  const [confirmState, setConfirmState] = useState(null);

  // Drives the sticky save bar's "All changes saved." / "You have unsaved
  // changes." state — a presentational snapshot of the top-form fields only
  // (seating areas and menu save immediately on their own, unaffected by
  // this). Taken at mount from the loaded restaurant, and re-taken after
  // every successful save.
  const buildSnapshot = useCallback(
    () =>
      JSON.stringify({
        name,
        cuisine,
        area,
        address,
        priceTier,
        noShowFee: String(noShowFee),
        noticeHours: String(noticeHours),
        openingTime,
        closingTime,
        partySizes: [...partySizes].sort((a, b) => a - b),
        minAdvanceDays: String(minAdvanceDays),
        maxAdvanceDays: String(maxAdvanceDays),
        maxPartySize: String(maxPartySize),
        minSpendAed: String(minSpendAed),
        minSpendNights: [...minSpendNights].sort((a, b) => a - b),
      }),
    [
      name,
      cuisine,
      area,
      address,
      priceTier,
      noShowFee,
      noticeHours,
      openingTime,
      closingTime,
      partySizes,
      minAdvanceDays,
      maxAdvanceDays,
      maxPartySize,
      minSpendAed,
      minSpendNights,
    ]
  );
  const [savedSnapshot, setSavedSnapshot] = useState(buildSnapshot);
  const isDirty = buildSnapshot() !== savedSnapshot;

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

  const loadFees = useCallback(
    async (restaurantId) => {
      if (onFeesChanged) {
        await onFeesChanged();
        return;
      }
      if (!restaurantId) return;
      const { data } = await supabase
        .from("restaurant_fees")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order");
      setInternalFees(data || []);
    },
    [onFeesChanged]
  );

  useEffect(() => {
    if (!restaurant) return;
    if (!areasProp) loadAreas(restaurant.id);
    loadMenuItems(restaurant.id);
    if (!feesProp) loadFees(restaurant.id);
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
        staff_only: newDishStaffOnly,
      });
      setNewDishName("");
      setNewDishPrice("");
      setNewDishFile(null);
      setNewDishPreview("");
      setNewDishStaffOnly(false);
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

  async function addFee() {
    if (!newFeeNameEn.trim() || !newFeeNameAr.trim() || newFeeAmount === "") return;
    setAddingFee(true);
    const { error } = await supabase.from("restaurant_fees").insert({
      restaurant_id: restaurant.id,
      name_en: newFeeNameEn.trim(),
      name_ar: newFeeNameAr.trim(),
      type: newFeeType,
      amount: Number(newFeeAmount),
      sort_order: fees.length,
    });
    setAddingFee(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNewFeeNameEn("");
    setNewFeeNameAr("");
    setNewFeeType("percent");
    setNewFeeAmount("");
    await loadFees(restaurant.id);
  }

  // Returns true on success so the row can leave edit mode.
  async function saveFee(fee, patch) {
    const { error } = await supabase.from("restaurant_fees").update(patch).eq("id", fee.id);
    if (error) {
      alert(error.message);
      return false;
    }
    await loadFees(restaurant.id);
    return true;
  }

  async function toggleFeeActive(fee) {
    await supabase.from("restaurant_fees").update({ active: !fee.active }).eq("id", fee.id);
    await loadFees(restaurant.id);
  }

  // Swaps this fee's sort_order with its neighbor at `direction` (-1 up,
  // +1 down) in the currently-sorted list — always computed from the fresh
  // sorted array, so it stays correct even if two fees ever end up sharing
  // a sort_order value.
  async function moveFee(fee, direction) {
    const idx = fees.findIndex((f) => f.id === fee.id);
    const otherIdx = idx + direction;
    if (otherIdx < 0 || otherIdx >= fees.length) return;
    const other = fees[otherIdx];
    await Promise.all([
      supabase.from("restaurant_fees").update({ sort_order: other.sort_order }).eq("id", fee.id),
      supabase.from("restaurant_fees").update({ sort_order: fee.sort_order }).eq("id", other.id),
    ]);
    await loadFees(restaurant.id);
  }

  function deleteFee(fee) {
    setConfirmState({
      title: t("removeFeeConfirmTitle", { name: lang === "ar" ? fee.name_ar : fee.name_en }),
      confirmLabel: t("remove"),
      onConfirm: async () => {
        setConfirmState(null);
        await supabase.from("restaurant_fees").delete().eq("id", fee.id);
        await loadFees(restaurant.id);
      },
    });
  }

  // Tip settings save immediately on change, same as fees/areas/menu above
  // — kept outside the top form's batched sticky-save-bar flow on purpose,
  // since this whole section lives outside the <form> tag (so a stray
  // Enter keypress while typing a fee name can't submit it).
  async function setAcceptTipsImmediate(value) {
    setAcceptTips(value);
    await supabase.from("restaurants").update({ accept_tips: value }).eq("id", restaurant.id);
    onSaved?.({ ...restaurant, accept_tips: value });
  }

  async function setAllowCustomTipImmediate(value) {
    setAllowCustomTip(value);
    await supabase.from("restaurants").update({ allow_custom_tip: value }).eq("id", restaurant.id);
    onSaved?.({ ...restaurant, allow_custom_tip: value });
  }

  async function saveTipPercentages(next) {
    setTipPercentages(next);
    await supabase.from("restaurants").update({ tip_percentages: next }).eq("id", restaurant.id);
    onSaved?.({ ...restaurant, tip_percentages: next });
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
    e?.preventDefault?.();
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
    setSavedSnapshot(buildSnapshot());
    onSaved?.(saved);
  }

  return (
    <div className="w-full max-w-[760px] mx-auto">
      {showHeading && (
        <>
          <h1 className="font-serif text-2xl text-charcoal mb-1">
            {isOnboarding ? t("setUpRestaurant") : t("restaurantSettings")}
          </h1>
          <p className="text-sm text-muted mb-6">{isOnboarding ? t("onboardingSubtitle") : t("settingsSubtitle")}</p>
        </>
      )}

      <form onSubmit={handleSave}>
        <SettingsSection label={t("restaurantSection")}>
          <div className="flex flex-col gap-4">
            <div>
              <label className={FIELD_LABEL}>{t("restaurantName")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD_INPUT} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className={`flex-1 min-h-[44px] rounded-full text-sm font-semibold ${
                      priceTier === p ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection label={t("bookingRulesSection")}>
          <div>
            <StepperRow
              label={t("minNoticeDays")}
              value={minAdvanceDays}
              onChange={setMinAdvanceDays}
              unit={t("daysUnit")}
            />
            <StepperRow
              label={t("maxWindowDays")}
              hint={t("advanceBookingHint")}
              value={maxAdvanceDays}
              onChange={setMaxAdvanceDays}
              unit={t("daysUnit")}
            />
            <div className="py-4 border-b border-charcoal/[0.08]">
              <label className={FIELD_LABEL}>{t("bookingHours")}</label>
              <div className="flex gap-2 mt-2 items-center">
                <input
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
                />
                <span className="text-xs text-taupe">{t("to")}</span>
                <input
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
                />
              </div>
              <p className="text-[11px] text-taupe mt-1.5">{t("bookingHoursHint")}</p>
            </div>
            <StepperRow
              label={t("maxPartySizeLabel")}
              hint={t("maxPartySizeHint")}
              value={maxPartySize}
              onChange={setMaxPartySize}
              unit={t("guestsUnit")}
              min={1}
            />
            <div className="pt-4">
              <label className={FIELD_LABEL}>{t("tableSizesOffered")}</label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {[2, 4, 6, 8, 10, 12].map((size) => (
                  <button
                    type="button"
                    key={size}
                    onClick={() => togglePartySize(size)}
                    className={`min-h-[44px] rounded-full text-sm font-semibold ${
                      partySizes.includes(size) ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection label={t("noShowsCancellationsSection")}>
          <div>
            <StepperRow label={t("noShowFeeSetting")} value={noShowFee} onChange={setNoShowFee} unit={t("aedUnit")} />
            <StepperRow
              label={t("cancellationWindowSetting")}
              value={noticeHours}
              onChange={setNoticeHours}
              unit={t("hoursBeforeUnit")}
              divider={false}
            />
          </div>
        </SettingsSection>

        <SettingsSection label={t("minSpendSection")}>
          <div>
            <StepperRow label={t("minSpendSetting")} hint={t("minSpendHint")} value={minSpendAed} onChange={setMinSpendAed} unit={t("aedUnit")} />
            <div className="pt-4">
              <label className={FIELD_LABEL}>{t("minSpendNightsLabel")}</label>
              <div className="grid grid-cols-7 gap-2 mt-2">
                {DAY_INDICES.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleMinSpendNight(d)}
                    className={`min-h-[44px] rounded-full text-xs font-semibold ${
                      minSpendNights.includes(d) ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                    }`}
                  >
                    {dayLabel(d, lang)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingsSection>
      </form>

      {/* Seating areas */}
      {restaurant && (
        <SettingsSection label={t("seatingAvailable")}>
          <p className="text-sm text-muted mb-4">{t("zoneCapacityHint")}</p>

          <div className="divide-y divide-charcoal/[0.08] mb-4">
            {areas.map((a) => (
              <AreaRow key={a.id} area={a} onSave={saveArea} onDelete={deleteArea} canDelete={areas.length > 1} t={t} />
            ))}
          </div>

          <div className="rounded-2xl p-3 border border-dashed border-taupe/40">
            <div className="flex items-center gap-2 mb-2">
              <input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder={t("areaNamePlaceholder")}
                className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
              />
              <input
                type="number"
                min="0"
                value={newAreaCapacity}
                onChange={(e) => setNewAreaCapacity(e.target.value)}
                placeholder={t("areaCapacityPlaceholder")}
                className="w-24 min-h-[44px] rounded-full px-3 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
              />
            </div>
            <button
              type="button"
              onClick={addArea}
              disabled={addingArea || !newAreaName.trim()}
              className="w-full min-h-[44px] rounded-full text-xs font-semibold bg-burgundy text-offwhite flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={13} /> {addingArea ? t("adding") : t("addArea")}
            </button>
          </div>
        </SettingsSection>
      )}

      {/* Menu */}
      {restaurant && (
        <SettingsSection label={t("menu")}>
          <p className="text-sm text-muted mb-4">{t("menuSectionHint")}</p>

          <div className="divide-y divide-charcoal/[0.08] mb-4">
            {menuItems.length === 0 && <p className="text-xs text-taupe py-2">{t("noMenuItems")}</p>}
            {menuItems.map((item) => (
              <MenuItemRow key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem} t={t} />
            ))}
          </div>

          <div className="rounded-2xl p-3 border border-dashed border-taupe/40">
            <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-2">{t("addADish")}</div>
            <div className="flex items-center gap-2 mb-2">
              <label className="w-11 h-11 rounded-xl bg-tan flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden">
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
                className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
              />
              <input
                type="number"
                min="0"
                value={newDishPrice}
                onChange={(e) => setNewDishPrice(e.target.value)}
                placeholder={t("aedPlaceholder")}
                className="w-20 min-h-[44px] rounded-full px-3 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
              />
            </div>
            <label className="flex items-center gap-2 mb-2 min-h-[44px] px-1 text-xs text-muted">
              <input
                type="checkbox"
                checked={newDishStaffOnly}
                onChange={(e) => setNewDishStaffOnly(e.target.checked)}
                className="w-4 h-4 accent-burgundy flex-shrink-0"
              />
              {t("staffOnlyDish")}
            </label>
            <button
              type="button"
              onClick={addMenuItem}
              disabled={addingDish || !newDishName.trim() || !newDishPrice}
              className="w-full min-h-[44px] rounded-full text-xs font-semibold bg-burgundy text-offwhite flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={13} /> {addingDish ? t("adding") : t("addDish")}
            </button>
          </div>
        </SettingsSection>
      )}

      {/* Fees and tips */}
      {restaurant && (
        <SettingsSection label={t("feesAndTipsSection")}>
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-1">{t("customFeesLabel")}</div>
            <p className="text-xs text-muted mb-4">{t("feesHelpText")}</p>

            <div className="divide-y divide-charcoal/[0.08] mb-2">
              {fees.length === 0 && <p className="text-xs text-taupe py-2">{t("noFeesYet")}</p>}
              {fees.map((fee, i) => (
                <FeeRow
                  key={fee.id}
                  fee={fee}
                  lang={lang}
                  onSave={saveFee}
                  onDelete={deleteFee}
                  onToggleActive={toggleFeeActive}
                  onMoveUp={i > 0 ? () => moveFee(fee, -1) : null}
                  onMoveDown={i < fees.length - 1 ? () => moveFee(fee, 1) : null}
                  t={t}
                />
              ))}
              <div className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-taupe">{t("vatFixedLabel")}</div>
                  <div className="text-xs text-taupe">{t("vatFixedHint")}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-3 border border-dashed border-taupe/40">
              <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mb-2">{t("addFee")}</div>
              <div className="flex flex-col gap-2 mb-2">
                <input
                  value={newFeeNameEn}
                  onChange={(e) => setNewFeeNameEn(e.target.value)}
                  placeholder={t("feeNameEnPlaceholder")}
                  className="w-full min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
                />
                <input
                  value={newFeeNameAr}
                  onChange={(e) => setNewFeeNameAr(e.target.value)}
                  placeholder={t("feeNameArPlaceholder")}
                  className="w-full min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewFeeType("percent")}
                    className={`flex-1 min-h-[44px] rounded-full text-xs font-semibold ${
                      newFeeType === "percent" ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                    }`}
                  >
                    {t("feeTypePercent")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewFeeType("fixed")}
                    className={`flex-1 min-h-[44px] rounded-full text-xs font-semibold ${
                      newFeeType === "fixed" ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
                    }`}
                  >
                    {t("feeTypeFixed")}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={newFeeAmount}
                    onChange={(e) => setNewFeeAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
                  />
                  <span className="text-xs text-taupe flex-shrink-0 w-10">{newFeeType === "percent" ? "%" : t("aedUnit")}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={addFee}
                disabled={addingFee || !newFeeNameEn.trim() || !newFeeNameAr.trim() || newFeeAmount === ""}
                className="w-full min-h-[44px] rounded-full text-xs font-semibold bg-burgundy text-offwhite flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus size={13} /> {addingFee ? t("adding") : t("addFee")}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-charcoal/[0.08]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-taupe mt-4 mb-1">{t("tipsLabel")}</div>
            <div className="flex items-center justify-between py-3 border-b border-charcoal/[0.08]">
              <span className="text-sm font-medium text-charcoal">{t("acceptTipsLabel")}</span>
              <Switch checked={acceptTips} onChange={setAcceptTipsImmediate} label={t("acceptTipsLabel")} />
            </div>
            {acceptTips && (
              <>
                <div className="grid grid-cols-3 gap-2 py-4 border-b border-charcoal/[0.08]">
                  {tipPercentages.map((pct, i) => (
                    <div key={i}>
                      <label className={FIELD_LABEL}>{t("tipOptionLabel", { n: i + 1 })}</label>
                      <div className="flex items-center gap-1 mt-2">
                        <input
                          type="number"
                          min="0"
                          value={pct}
                          onChange={(e) =>
                            setTipPercentages((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                          }
                          onBlur={() => saveTipPercentages(tipPercentages.map((p) => Number(p) || 0))}
                          className="w-full min-h-[44px] rounded-full px-3 text-sm text-center outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
                        />
                        <span className="text-xs text-taupe flex-shrink-0">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-charcoal">{t("allowCustomTipLabel")}</span>
                  <Switch checked={allowCustomTip} onChange={setAllowCustomTipImmediate} label={t("allowCustomTipLabel")} />
                </div>
              </>
            )}
          </div>
        </SettingsSection>
      )}

      {/* This tablet */}
      <SettingsSection label={t("thisTabletSection")}>
        <div>
          <div className="pb-4 border-b border-charcoal/[0.08]">
            <label className={FIELD_LABEL}>{t("dashboardLanguageSetting")}</label>
            <p className="text-xs text-muted mt-1 mb-2">{t("dashboardLanguageHint")}</p>
            <div className="inline-flex bg-tan rounded-full p-1">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${lang === "en" ? "bg-burgundy text-offwhite" : "text-charcoal"}`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${lang === "ar" ? "bg-burgundy text-offwhite" : "text-charcoal"}`}
              >
                العربية
              </button>
            </div>
          </div>
          {onSignOut && (
            <div className="pt-4">
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-2 min-h-[44px] rounded-full px-5 text-sm font-semibold bg-tan text-charcoal"
              >
                <LogOut size={14} /> {t("signOut")}
              </button>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Sticky save bar for the top form (restaurant info through minimum
          spend) — seating areas and menu save immediately on their own and
          aren't tracked by it. */}
      <div className="sticky bottom-0 mt-2 -mx-4 sm:mx-0">
        <div
          className={`flex items-center justify-between gap-4 rounded-2xl px-5 py-4 mb-4 bg-cream shadow-[0_-4px_14px_rgba(43,31,33,0.08)] border-t-2 ${
            saveError ? "border-warn" : isDirty ? "border-brass" : "border-charcoal/[0.08]"
          }`}
        >
          <span className={`text-sm ${saveError ? "text-warn" : "text-muted"}`}>
            {saveError ? savedMsg : isDirty ? t("unsavedChanges") : t("allChangesSaved")}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex-shrink-0 min-h-[44px] rounded-full px-6 text-sm font-semibold bg-burgundy text-offwhite disabled:opacity-40"
          >
            {saving ? t("saving") : isOnboarding ? t("finishSetup") : t("saveChanges")}
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
      <div className="flex items-center gap-3 py-3">
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
          className="text-xs font-semibold min-h-[44px] rounded-full px-3 bg-tan text-charcoal flex-shrink-0"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => onDelete(area)}
          aria-label={t("removeArea")}
          disabled={!canDelete}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-warn/10 text-warn flex-shrink-0 disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 my-1 ring-2 ring-burgundy">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
        />
        <input
          type="number"
          min="0"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder={t("areaCapacityPlaceholder")}
          className="w-24 min-h-[44px] rounded-full px-3 text-sm outline-none bg-tan text-charcoal placeholder:text-taupe focus:ring-2 focus:ring-burgundy"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 min-h-[44px] rounded-full text-xs font-semibold bg-burgundy text-offwhite disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={cancelEdit} className="flex-1 min-h-[44px] rounded-full text-xs font-semibold bg-tan text-charcoal">
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
  const [staffOnly, setStaffOnly] = useState(item.staff_only || false);
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
    setStaffOnly(item.staff_only || false);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(item, { name: name.trim(), price_aed: Number(price), staff_only: staffOnly }, file);
    setSaving(false);
    setFile(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 py-3">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-tan flex items-center justify-center flex-shrink-0">
            <ImageOff size={16} className="text-taupe" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-charcoal truncate">{item.name}</div>
          <div className="text-xs text-brass font-semibold">
            AED {item.price_aed}
            {item.staff_only && <span className="text-taupe font-normal"> · {t("staffOnlyDish")}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold min-h-[44px] rounded-full px-3 bg-tan text-charcoal flex-shrink-0"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label={t("deleteDish")}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-warn/10 text-warn flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 my-1 ring-2 ring-burgundy">
      <div className="flex items-center gap-2 mb-2">
        <label className="w-11 h-11 rounded-xl bg-tan flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden">
          {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <Camera size={16} className="text-taupe" />}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
        />
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-20 min-h-[44px] rounded-full px-3 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
        />
      </div>
      <label className="flex items-center gap-2 mb-2 min-h-[44px] px-1 text-xs text-muted">
        <input
          type="checkbox"
          checked={staffOnly}
          onChange={(e) => setStaffOnly(e.target.checked)}
          className="w-4 h-4 accent-burgundy flex-shrink-0"
        />
        {t("staffOnlyDish")}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 min-h-[44px] rounded-full text-xs font-semibold bg-burgundy text-offwhite disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={cancelEdit} className="flex-1 min-h-[44px] rounded-full text-xs font-semibold bg-tan text-charcoal">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

function FeeRow({ fee, lang, onSave, onDelete, onToggleActive, onMoveUp, onMoveDown, t }) {
  const [editing, setEditing] = useState(false);
  const [nameEn, setNameEn] = useState(fee.name_en);
  const [nameAr, setNameAr] = useState(fee.name_ar);
  const [type, setType] = useState(fee.type);
  const [amount, setAmount] = useState(fee.amount);
  const [saving, setSaving] = useState(false);

  function cancelEdit() {
    setEditing(false);
    setNameEn(fee.name_en);
    setNameAr(fee.name_ar);
    setType(fee.type);
    setAmount(fee.amount);
  }

  async function handleSave() {
    setSaving(true);
    const ok = await onSave(fee, { name_en: nameEn.trim(), name_ar: nameAr.trim(), type, amount: Number(amount) || 0 });
    setSaving(false);
    if (ok) setEditing(false);
  }

  const displayName = lang === "ar" ? fee.name_ar : fee.name_en;
  const amountLabel = fee.type === "percent" ? `${fee.amount}%` : `AED ${fee.amount}`;

  if (!editing) {
    return (
      <div className="flex items-center gap-2 py-3">
        <div className="flex flex-col flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp || undefined}
            disabled={!onMoveUp}
            aria-label={t("moveUp")}
            className="w-6 h-5 flex items-center justify-center text-taupe disabled:opacity-20"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown || undefined}
            disabled={!onMoveDown}
            aria-label={t("moveDown")}
            className="w-6 h-5 flex items-center justify-center text-taupe disabled:opacity-20"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${fee.active ? "text-charcoal" : "text-taupe"}`}>{displayName}</div>
          <div className="text-xs text-taupe">{amountLabel}</div>
        </div>
        <Switch checked={fee.active} onChange={() => onToggleActive(fee)} label={displayName} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold min-h-[44px] rounded-full px-3 bg-tan text-charcoal flex-shrink-0"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={() => onDelete(fee)}
          aria-label={t("remove")}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-warn/10 text-warn flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-3 my-1 ring-2 ring-burgundy">
      <div className="flex flex-col gap-2 mb-2">
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder={t("feeNameEnPlaceholder")}
          className="w-full min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
        />
        <input
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder={t("feeNameArPlaceholder")}
          className="w-full min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("percent")}
            className={`flex-1 min-h-[44px] rounded-full text-xs font-semibold ${
              type === "percent" ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
            }`}
          >
            {t("feeTypePercent")}
          </button>
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={`flex-1 min-h-[44px] rounded-full text-xs font-semibold ${
              type === "fixed" ? "bg-burgundy text-offwhite" : "bg-tan text-charcoal"
            }`}
          >
            {t("feeTypeFixed")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 min-h-[44px] rounded-full px-4 text-sm outline-none bg-tan text-charcoal focus:ring-2 focus:ring-burgundy"
          />
          <span className="text-xs text-taupe flex-shrink-0 w-10">{type === "percent" ? "%" : t("aedUnit")}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !nameEn.trim() || !nameAr.trim()}
          className="flex-1 min-h-[44px] rounded-full text-xs font-semibold bg-burgundy text-offwhite disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={cancelEdit} className="flex-1 min-h-[44px] rounded-full text-xs font-semibold bg-tan text-charcoal">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
