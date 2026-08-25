"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { ChevronLeft, Save, Plus, Trash2, Camera, ImageOff } from "lucide-react";

const MENU_PHOTOS_BUCKET = "menu-photos";

function extractStoragePath(url) {
  if (!url) return null;
  const marker = `/${MENU_PHOTOS_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

const ALL_ZONES = ["Indoor", "Outdoor", "Shisha Terrace"];
const PRICE_TIERS = ["$", "$$", "$$$", "$$$$"];

export default function RestaurantSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">Loading…</div>}>
      <RestaurantSettingsInner />
    </Suspense>
  );
}

function RestaurantSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "true";
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [restaurant, setRestaurant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [area, setArea] = useState("");
  const [priceTier, setPriceTier] = useState("$$");
  const [noShowFee, setNoShowFee] = useState(0);
  const [noticeHours, setNoticeHours] = useState(2);
  const [zones, setZones] = useState(["Indoor"]);
  const [openingTime, setOpeningTime] = useState("18:00");
  const [closingTime, setClosingTime] = useState("21:30");
  const [partySizes, setPartySizes] = useState([2, 4, 6, 8]);
  const [minAdvanceDays, setMinAdvanceDays] = useState(0);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const [maxPartySize, setMaxPartySize] = useState(14);
  const [zoneCapacity, setZoneCapacity] = useState({});

  const [menuItems, setMenuItems] = useState([]);
  const [newDishName, setNewDishName] = useState("");
  const [newDishPrice, setNewDishPrice] = useState("");
  const [newDishFile, setNewDishFile] = useState(null);
  const [newDishPreview, setNewDishPreview] = useState("");
  const [addingDish, setAddingDish] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/dashboard/login");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", userData.user?.id)
        .single();

      if (data) {
        setRestaurant(data);
        setName(data.name || "");
        setCuisine(data.cuisine || "");
        setArea(data.area || "");
        setPriceTier(data.price_tier || "$$");
        setNoShowFee(data.no_show_fee_aed || 0);
        setNoticeHours(data.cancellation_notice_hours ?? 2);
        setZones(data.zones && data.zones.length > 0 ? data.zones : ["Indoor"]);
        setOpeningTime(data.opening_time || "18:00");
        setClosingTime(data.closing_time || "21:30");
        setPartySizes(data.party_sizes && data.party_sizes.length > 0 ? data.party_sizes : [2, 4, 6, 8]);
        setMinAdvanceDays(data.min_advance_days ?? 0);
        setMaxAdvanceDays(data.max_advance_days ?? 30);
        setMaxPartySize(data.max_party_size ?? 14);
        setZoneCapacity(data.zone_capacity || {});
      }
      setCheckingAuth(false);
    }
    load();
  }, [router]);

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
    if (restaurant) loadMenuItems(restaurant.id);
  }, [restaurant, loadMenuItems]);

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

  async function deleteMenuItem(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await supabase.from("menu_items").delete().eq("id", item.id);
    const path = extractStoragePath(item.photo_url);
    if (path) await supabase.storage.from(MENU_PHOTOS_BUCKET).remove([path]);
    await loadMenuItems(restaurant.id);
  }

  function toggleZone(z) {
    setZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  }

  function togglePartySize(size) {
    setPartySizes((prev) =>
      prev.includes(size) ? prev.filter((x) => x !== size) : [...prev, size].sort((a, b) => a - b)
    );
  }

  function setZoneCapacityValue(zone, value) {
    setZoneCapacity((prev) => ({ ...prev, [zone]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!restaurant) return;
    setSaving(true);
    setSavedMsg("");
    const cleanedCapacity = {};
    zones.forEach((z) => {
      cleanedCapacity[z] = Number(zoneCapacity[z]) || 0;
    });
    const { error } = await supabase
      .from("restaurants")
      .update({
        name,
        cuisine,
        area,
        price_tier: priceTier,
        no_show_fee_aed: Number(noShowFee),
        cancellation_notice_hours: Number(noticeHours),
        zones: zones.length > 0 ? zones : ["Indoor"],
        opening_time: openingTime,
        closing_time: closingTime,
        party_sizes: partySizes.length > 0 ? partySizes : [2, 4, 6, 8],
        min_advance_days: Number(minAdvanceDays),
        max_advance_days: Number(maxAdvanceDays),
        max_party_size: Number(maxPartySize),
        zone_capacity: cleanedCapacity,
      })
      .eq("id", restaurant.id);
    setSaving(false);
    if (error) {
      setSavedMsg("Something went wrong: " + error.message);
    } else {
      if (isOnboarding) {
        router.push("/dashboard");
        return;
      }
      setSavedMsg("Saved!");
    }
  }

  if (checkingAuth) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">Loading…</div>;
  }

  if (!restaurant) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-ivory px-6 pt-16 text-sm text-neutral-500">
        No restaurant is linked to your account yet.
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-ivory px-6 pb-16">
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-teal py-4"
      >
        <ChevronLeft size={16} /> {isOnboarding ? "Skip for now" : "Back to dashboard"}
      </button>

      <h1 className="font-serif text-2xl text-ink mb-1">
        {isOnboarding ? "Set up your restaurant" : "Restaurant settings"}
      </h1>
      <p className="text-sm text-neutral-500 mb-6">
        {isOnboarding
          ? "Tell diners what to expect — this is what they'll see before booking."
          : "Update this anytime — prices, seating, and details go live immediately."}
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Restaurant name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 outline-none bg-white border border-neutral-200"
            required
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Cuisine</label>
          <input
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="e.g. Modern European"
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 outline-none bg-white border border-neutral-200"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Area</label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. DIFC"
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 outline-none bg-white border border-neutral-200"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Price tier</label>
          <div className="flex gap-2 mt-2">
            {PRICE_TIERS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriceTier(p)}
                className={`flex-1 rounded-lg py-2 text-sm border ${
                  priceTier === p ? "bg-teal text-ivory border-teal" : "bg-white text-ink border-neutral-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">
            How far ahead can diners book?
          </label>
          <div className="flex gap-2 mt-2 items-center">
            <div className="flex-1">
              <span className="text-[10px] text-neutral-400">Minimum notice (days)</span>
              <input
                type="number"
                min="0"
                value={minAdvanceDays}
                onChange={(e) => setMinAdvanceDays(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm mt-1 outline-none bg-white border border-neutral-200"
              />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-neutral-400">Maximum window (days)</span>
              <input
                type="number"
                min="0"
                value={maxAdvanceDays}
                onChange={(e) => setMaxAdvanceDays(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm mt-1 outline-none bg-white border border-neutral-200"
              />
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            0 minimum means same-day bookings are allowed. E.g. 0 to 30 lets diners book anywhere from tonight to a month out.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Booking hours</label>
          <div className="flex gap-2 mt-2 items-center">
            <input
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none bg-white border border-neutral-200"
            />
            <span className="text-xs text-neutral-400">to</span>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none bg-white border border-neutral-200"
            />
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            This is the window diners can pick a time slot within, in 30-minute steps.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">
            Largest group you can seat online
          </label>
          <input
            type="number"
            min="1"
            value={maxPartySize}
            onChange={(e) => setMaxPartySize(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 outline-none bg-white border border-neutral-200"
          />
          <p className="text-[11px] text-neutral-400 mt-1">
            Diners can request any group size up to this number. Beyond it, they'll be told to contact you directly.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Table sizes you offer</label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[2, 4, 6, 8, 10, 12].map((size) => (
              <button
                type="button"
                key={size}
                onClick={() => togglePartySize(size)}
                className={`rounded-lg py-2 text-sm border ${
                  partySizes.includes(size) ? "bg-teal text-ivory border-teal" : "bg-white text-ink border-neutral-200"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">Seating available</label>
          <div className="flex flex-col gap-2 mt-2">
            {ALL_ZONES.map((z) => (
              <div
                key={z}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-white border border-neutral-200 text-sm"
              >
                <label className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={zones.includes(z)}
                    onChange={() => toggleZone(z)}
                  />
                  {z}
                </label>
                {zones.includes(z) && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      type="number"
                      min="0"
                      value={zoneCapacity[z] ?? ""}
                      onChange={(e) => setZoneCapacityValue(z, e.target.value)}
                      placeholder="0"
                      className="w-16 rounded-md px-2 py-1 text-xs outline-none bg-neutral-50 border border-neutral-200 text-center"
                    />
                    <span className="text-[10px] text-neutral-400">tables</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            How many tables you have in each area. Diners will see a zone as fully booked once all its tables are taken for a given time.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">
            No-show fee (AED per guest)
          </label>
          <input
            type="number"
            min="0"
            value={noShowFee}
            onChange={(e) => setNoShowFee(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 outline-none bg-white border border-neutral-200"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-neutral-400">
            Free cancellation window (hours before booking)
          </label>
          <input
            type="number"
            min="0"
            value={noticeHours}
            onChange={(e) => setNoticeHours(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm mt-2 outline-none bg-white border border-neutral-200"
          />
        </div>

        {savedMsg && (
          <p className={`text-xs ${savedMsg === "Saved!" ? "text-green-700" : "text-red-600"}`}>{savedMsg}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full py-3 text-sm font-medium bg-teal text-ivory flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={15} /> {saving ? "Saving…" : isOnboarding ? "Finish setup" : "Save changes"}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-neutral-200">
        <h2 className="font-serif text-xl text-ink mb-1">Menu</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Add the dishes diners see on your listing. Changes here save immediately.
        </p>

        <div className="flex flex-col gap-2 mb-4">
          {menuItems.length === 0 && <p className="text-xs text-neutral-400">No dishes added yet.</p>}
          {menuItems.map((item) => (
            <MenuItemRow key={item.id} item={item} onSave={saveMenuItem} onDelete={deleteMenuItem} />
          ))}
        </div>

        <div className="rounded-xl p-3 bg-white border border-dashed border-neutral-300">
          <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Add a dish</div>
          <div className="flex items-center gap-2 mb-2">
            <label className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden border border-neutral-200">
              {newDishPreview ? (
                <img src={newDishPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={16} className="text-neutral-400" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleNewDishFile} />
            </label>
            <input
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              placeholder="Dish name"
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none bg-neutral-50 border border-neutral-200"
            />
            <input
              type="number"
              min="0"
              value={newDishPrice}
              onChange={(e) => setNewDishPrice(e.target.value)}
              placeholder="AED"
              className="w-20 rounded-lg px-2 py-2 text-sm outline-none bg-neutral-50 border border-neutral-200"
            />
          </div>
          <button
            type="button"
            onClick={addMenuItem}
            disabled={addingDish || !newDishName.trim() || !newDishPrice}
            className="w-full rounded-full py-2.5 text-xs font-medium bg-teal text-ivory flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={13} /> {addingDish ? "Adding…" : "Add dish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuItemRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price_aed);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(item.photo_url || "");
  const [saving, setSaving] = useState(false);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
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
      <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-neutral-200">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
            <ImageOff size={16} className="text-neutral-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink truncate">{item.name}</div>
          <div className="text-xs text-amber-700">AED {item.price_aed}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs rounded-full px-3 py-1.5 bg-neutral-100 text-ink flex-shrink-0"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label="Delete dish"
          className="w-8 h-8 rounded-full flex items-center justify-center bg-red-50 text-red-600 flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3 bg-white border border-teal">
      <div className="flex items-center gap-2 mb-2">
        <label className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden border border-neutral-200">
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera size={16} className="text-neutral-400" />
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none bg-neutral-50 border border-neutral-200"
        />
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-20 rounded-lg px-2 py-2 text-sm outline-none bg-neutral-50 border border-neutral-200"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-full py-2 text-xs font-medium bg-teal text-ivory disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={cancelEdit} className="flex-1 rounded-full py-2 text-xs bg-neutral-100 text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
