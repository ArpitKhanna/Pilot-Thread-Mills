"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import type { PriceListItem } from "@/lib/auth/types";
import {
  buildCustomerWhatsAppShareUrl,
  buildGoogleMapsUrl,
  formatCustomerAddressLines,
  parseMapPinInput,
} from "@/lib/customers/share";
import type {
  CustomerPriceRule,
  CustomerTier,
  CustomerTierRubric,
  MarketDay,
  Salesman,
  TierRubricScore,
} from "@/lib/salesmen/types";
import {
  CUSTOMER_TIER_LABELS,
  deriveCustomerTier,
  ENTITY_TYPE_LABELS,
  MARKET_DAY_LABELS,
  MARKET_DAYS,
  TIER_RUBRIC_LABELS,
} from "@/lib/salesmen/types";

type CustomerPersonalDetailsFormProps = {
  customer: Salesman;
  priceList: PriceListItem[];
  onSaved: (customer: Salesman) => void;
};

type DraftPriceRule = {
  key: string;
  itemName: string;
  priceListItemId: string | null;
  adjustmentPerUnit: string;
};

const RUBRIC_KEYS: (keyof CustomerTierRubric)[] = [
  "orderFrequency",
  "orderAmount",
  "paymentAmount",
  "paymentSpeed",
];

const SCORE_OPTIONS: TierRubricScore[] = [1, 2, 3, 4, 5];

function rulesToDraft(rules: CustomerPriceRule[]): DraftPriceRule[] {
  if (rules.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        itemName: "",
        priceListItemId: null,
        adjustmentPerUnit: "",
      },
    ];
  }
  return rules.map((rule) => ({
    key: rule.id,
    itemName: rule.itemName,
    priceListItemId: rule.priceListItemId ?? null,
    adjustmentPerUnit: String(rule.adjustmentPerUnit),
  }));
}

function syncFromCustomer(customer: Salesman) {
  return {
    name: customer.name,
    contactName: customer.contactName,
    phone: customer.phone,
    alternatePhone: customer.alternatePhone,
    isActive: customer.isActive,
    marketDay: customer.marketDay,
    addressBuilding: customer.addressBuilding,
    addressArea: customer.addressArea || customer.area,
    addressCity: customer.addressCity,
    addressState: customer.addressState,
    addressPincode: customer.addressPincode,
    mapLat: customer.mapLat != null ? String(customer.mapLat) : "",
    mapLng: customer.mapLng != null ? String(customer.mapLng) : "",
    pinPaste: "",
    isDefaulter: customer.isDefaulter,
    balanceThreshold:
      customer.balanceThreshold != null
        ? String(customer.balanceThreshold)
        : "",
    tierRubric: { ...customer.tierRubric },
    priceRules: rulesToDraft(customer.priceRules),
  };
}

function describeAdjustment(itemName: string, adjustment: number): string {
  const abs = Math.abs(adjustment);
  if (adjustment > 0) return `₹${abs} upcharge per ${itemName}`;
  return `₹${abs} discount per ${itemName}`;
}

export function CustomerPersonalDetailsForm({
  customer,
  priceList,
  onSaved,
}: CustomerPersonalDetailsFormProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [contactName, setContactName] = useState(customer.contactName);
  const [phone, setPhone] = useState(customer.phone);
  const [alternatePhone, setAlternatePhone] = useState(
    customer.alternatePhone,
  );
  const [isActive, setIsActive] = useState(customer.isActive);
  const [marketDay, setMarketDay] = useState<MarketDay | "">(
    customer.marketDay,
  );
  const [addressBuilding, setAddressBuilding] = useState(
    customer.addressBuilding,
  );
  const [addressArea, setAddressArea] = useState(
    customer.addressArea || customer.area,
  );
  const [addressCity, setAddressCity] = useState(customer.addressCity);
  const [addressState, setAddressState] = useState(customer.addressState);
  const [addressPincode, setAddressPincode] = useState(
    customer.addressPincode,
  );
  const [mapLat, setMapLat] = useState(
    customer.mapLat != null ? String(customer.mapLat) : "",
  );
  const [mapLng, setMapLng] = useState(
    customer.mapLng != null ? String(customer.mapLng) : "",
  );
  const [pinPaste, setPinPaste] = useState("");
  const [isDefaulter, setIsDefaulter] = useState(customer.isDefaulter);
  const [balanceThreshold, setBalanceThreshold] = useState(
    customer.balanceThreshold != null
      ? String(customer.balanceThreshold)
      : "",
  );
  const [tierRubric, setTierRubric] = useState<CustomerTierRubric>({
    ...customer.tierRubric,
  });
  const [priceRules, setPriceRules] = useState<DraftPriceRule[]>(() =>
    rulesToDraft(customer.priceRules),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const derivedTier: CustomerTier | "" = useMemo(
    () => deriveCustomerTier(editing ? tierRubric : customer.tierRubric),
    [editing, tierRubric, customer.tierRubric],
  );

  const displayMapsUrl = useMemo(() => {
    const lat = mapLat.trim() === "" ? null : Number(mapLat);
    const lng = mapLng.trim() === "" ? null : Number(mapLng);
    return buildGoogleMapsUrl({
      lat: Number.isFinite(lat as number) ? (lat as number) : null,
      lng: Number.isFinite(lng as number) ? (lng as number) : null,
      addressLines: formatCustomerAddressLines({
        addressBuilding,
        addressArea,
        addressCity,
        addressState,
        addressPincode,
      }),
    });
  }, [
    mapLat,
    mapLng,
    addressBuilding,
    addressArea,
    addressCity,
    addressState,
    addressPincode,
  ]);

  useEffect(() => {
    if (editing) return;
    const next = syncFromCustomer(customer);
    setName(next.name);
    setContactName(next.contactName);
    setPhone(next.phone);
    setAlternatePhone(next.alternatePhone);
    setIsActive(next.isActive);
    setMarketDay(next.marketDay);
    setAddressBuilding(next.addressBuilding);
    setAddressArea(next.addressArea);
    setAddressCity(next.addressCity);
    setAddressState(next.addressState);
    setAddressPincode(next.addressPincode);
    setMapLat(next.mapLat);
    setMapLng(next.mapLng);
    setPinPaste("");
    setIsDefaulter(next.isDefaulter);
    setBalanceThreshold(next.balanceThreshold);
    setTierRubric(next.tierRubric);
    setPriceRules(next.priceRules);
  }, [customer, editing]);

  function applySyncedState(next: ReturnType<typeof syncFromCustomer>) {
    setName(next.name);
    setContactName(next.contactName);
    setPhone(next.phone);
    setAlternatePhone(next.alternatePhone);
    setIsActive(next.isActive);
    setMarketDay(next.marketDay);
    setAddressBuilding(next.addressBuilding);
    setAddressArea(next.addressArea);
    setAddressCity(next.addressCity);
    setAddressState(next.addressState);
    setAddressPincode(next.addressPincode);
    setMapLat(next.mapLat);
    setMapLng(next.mapLng);
    setPinPaste("");
    setIsDefaulter(next.isDefaulter);
    setBalanceThreshold(next.balanceThreshold);
    setTierRubric(next.tierRubric);
    setPriceRules(next.priceRules);
  }

  function startEditing() {
    applySyncedState(syncFromCustomer(customer));
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    applySyncedState(syncFromCustomer(customer));
    setError(null);
    setEditing(false);
  }

  function applyPinPaste() {
    const parsed = parseMapPinInput(pinPaste);
    if (!parsed) {
      setError("Could not read coordinates. Paste lat,lng or a Google Maps URL.");
      return;
    }
    setMapLat(String(parsed.lat));
    setMapLng(String(parsed.lng));
    setPinPaste("");
    setError(null);
  }

  function clearPin() {
    setMapLat("");
    setMapLng("");
    setPinPaste("");
  }

  function updateRule(key: string, patch: Partial<DraftPriceRule>) {
    setPriceRules((prev) =>
      prev.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)),
    );
  }

  function addRule() {
    setPriceRules((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        itemName: "",
        priceListItemId: null,
        adjustmentPerUnit: "",
      },
    ]);
  }

  function removeRule(key: string) {
    setPriceRules((prev) => {
      const next = prev.filter((rule) => rule.key !== key);
      return next.length > 0
        ? next
        : [
            {
              key: crypto.randomUUID(),
              itemName: "",
              priceListItemId: null,
              adjustmentPerUnit: "",
            },
          ];
    });
  }

  function handleShareWhatsApp() {
    const lat = mapLat.trim() === "" ? null : Number(mapLat);
    const lng = mapLng.trim() === "" ? null : Number(mapLng);
    const url = buildCustomerWhatsAppShareUrl({
      name,
      contactName,
      phone,
      alternatePhone,
      addressBuilding,
      addressArea,
      addressCity,
      addressState,
      addressPincode,
      mapLat: Number.isFinite(lat as number) ? (lat as number) : null,
      mapLng: Number.isFinite(lng as number) ? (lng as number) : null,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSave() {
    setError(null);
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setError("Shop name is required.");
      return;
    }
    if (!trimmedPhone) {
      setError("Phone number is required.");
      return;
    }

    let threshold: number | null = null;
    if (balanceThreshold.trim() !== "") {
      threshold = Number(balanceThreshold);
      if (!Number.isFinite(threshold) || threshold < 0) {
        setError("Balance threshold must be a valid non-negative amount.");
        return;
      }
    }

    let parsedLat: number | null = null;
    let parsedLng: number | null = null;
    if (mapLat.trim() !== "" || mapLng.trim() !== "") {
      parsedLat = Number(mapLat);
      parsedLng = Number(mapLng);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        setError("Map pin needs both latitude and longitude.");
        return;
      }
    }

    const parsedPriceRules: CustomerPriceRule[] = [];
    for (const rule of priceRules) {
      const itemName = rule.itemName.trim();
      const adjustment = Number(rule.adjustmentPerUnit);
      const blank =
        !itemName &&
        (!rule.adjustmentPerUnit.trim() || Number(rule.adjustmentPerUnit) === 0);
      if (blank) continue;
      if (!itemName) {
        setError("Each price rule needs an item name.");
        return;
      }
      if (!Number.isFinite(adjustment) || adjustment === 0) {
        setError("Each price rule needs a non-zero ±₹ adjustment.");
        return;
      }
      parsedPriceRules.push({
        id: rule.key,
        itemName,
        priceListItemId: rule.priceListItemId ?? undefined,
        adjustmentPerUnit: Math.round(adjustment * 100) / 100,
        description: describeAdjustment(itemName, adjustment),
      });
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          contactName: contactName.trim(),
          phone: trimmedPhone,
          alternatePhone: alternatePhone.trim(),
          isActive,
          marketDay,
          addressBuilding: addressBuilding.trim(),
          addressArea: addressArea.trim(),
          addressCity: addressCity.trim(),
          addressState: addressState.trim(),
          addressPincode: addressPincode.trim(),
          mapLat: parsedLat,
          mapLng: parsedLng,
          isDefaulter,
          balanceThreshold: threshold,
          tierRubric,
          priceRules: parsedPriceRules,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        customer?: Salesman;
      };
      if (!res.ok || !data.customer) {
        throw new Error(data.error || "Could not save details.");
      }
      onSaved(data.customer);
      setPriceRules(rulesToDraft(data.customer.priceRules));
      setEditing(false);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save details.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:bg-background disabled:text-foreground disabled:opacity-100";

  const viewRubric = editing ? tierRubric : customer.tierRubric;
  const viewRules = editing
    ? priceRules
    : rulesToDraft(
        customer.priceRules.length > 0
          ? customer.priceRules
          : [],
      );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-medium tracking-tight">
            Personal details
          </h2>
          <p className="mt-1 text-sm text-muted">
            Shop profile, address, tier rubric, and price adjustments
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="shrink-0 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Share on WhatsApp
          </button>
          {!editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="shrink-0 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:bg-sidebar"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Identity</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">
              Shop Name<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              disabled={!editing}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">
              Customer Name
            </label>
            <input
              type="text"
              value={contactName}
              disabled={!editing}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={editing ? "Contact person" : "—"}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Phone Number<span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              disabled={!editing}
              onChange={(e) => setPhone(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Alternate Phone Number
            </label>
            <input
              type="tel"
              value={alternatePhone}
              disabled={!editing}
              onChange={(e) => setAlternatePhone(e.target.value)}
              placeholder={editing ? "Optional" : "—"}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Category</label>
            <input
              type="text"
              value={ENTITY_TYPE_LABELS[customer.entityType]}
              disabled
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Status</label>
            {editing ? (
              <select
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                className={`${inputClass} py-2.5 pr-9 pl-3`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            ) : (
              <input
                type="text"
                value={isActive ? "Active" : "Inactive"}
                disabled
                className={inputClass}
              />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Address</h3>
            <p className="mt-1 text-sm text-muted">
              Typed address and optional Google Maps pin
            </p>
          </div>
          {displayMapsUrl ? (
            <a
              href={displayMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium underline-offset-2 hover:underline"
            >
              Open in Google Maps
            </a>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Building number
            </label>
            <input
              type="text"
              value={addressBuilding}
              disabled={!editing}
              onChange={(e) => setAddressBuilding(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Area</label>
            <input
              type="text"
              value={addressArea}
              disabled={!editing}
              onChange={(e) => setAddressArea(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">City</label>
            <input
              type="text"
              value={addressCity}
              disabled={!editing}
              onChange={(e) => setAddressCity(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">State</label>
            <input
              type="text"
              value={addressState}
              disabled={!editing}
              onChange={(e) => setAddressState(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Pincode</label>
            <input
              type="text"
              value={addressPincode}
              disabled={!editing}
              onChange={(e) => setAddressPincode(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Map pin</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Latitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={mapLat}
                disabled={!editing}
                onChange={(e) => setMapLat(e.target.value)}
                placeholder="e.g. 21.1702"
                className={`${inputClass} tabular-nums`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Longitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={mapLng}
                disabled={!editing}
                onChange={(e) => setMapLng(e.target.value)}
                placeholder="e.g. 72.8311"
                className={`${inputClass} tabular-nums`}
              />
            </div>
          </div>
          {editing && (
            <div className="space-y-2">
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Paste lat,lng or Google Maps URL
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={pinPaste}
                  onChange={(e) => setPinPaste(e.target.value)}
                  placeholder="21.17, 72.83 or maps.google.com/…"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={applyPinPaste}
                  className="shrink-0 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium hover:bg-sidebar"
                >
                  Apply pin
                </button>
                <button
                  type="button"
                  onClick={clearPin}
                  className="shrink-0 rounded-lg border border-border px-3.5 py-2.5 text-sm text-muted hover:bg-sidebar hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Trading</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Market Day
            </label>
            <select
              value={marketDay}
              disabled={!editing}
              onChange={(e) =>
                setMarketDay(e.target.value as MarketDay | "")
              }
              className={`${inputClass} py-2.5 pr-9 pl-3`}
            >
              <option value="">Not set</option>
              {MARKET_DAYS.map((day) => (
                <option key={day} value={day}>
                  {MARKET_DAY_LABELS[day]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Balance alert threshold
            </label>
            <div className="flex items-center rounded-lg border border-border bg-surface px-3 py-2.5 has-[:disabled]:bg-background">
              <span className="mr-2 text-muted">₹</span>
              <input
                type="number"
                min="0"
                value={balanceThreshold}
                disabled={!editing}
                onChange={(e) => setBalanceThreshold(e.target.value)}
                placeholder="No alert"
                className="w-full bg-transparent text-sm outline-none disabled:opacity-100"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            {editing ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefaulter}
                  onChange={(e) => setIsDefaulter(e.target.checked)}
                  className="rounded border-border"
                />
                Mark as defaulter
              </label>
            ) : (
              <p className="text-sm text-muted">
                Defaulter:{" "}
                <span className="font-medium text-foreground">
                  {isDefaulter ? "Yes" : "No"}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Tier rubric</h3>
            <p className="mt-1 text-sm text-muted">
              Rate 1–5 on each factor. Overall tier is derived from the
              average.
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
              derivedTier
                ? "bg-sidebar text-foreground"
                : "bg-sidebar text-muted"
            }`}
          >
            {derivedTier
              ? CUSTOMER_TIER_LABELS[derivedTier]
              : "Tier incomplete"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {RUBRIC_KEYS.map((key) => (
            <div key={key}>
              <label className="mb-1.5 block text-sm font-medium">
                {TIER_RUBRIC_LABELS[key]}
              </label>
              <select
                value={viewRubric[key] ?? ""}
                disabled={!editing}
                onChange={(e) => {
                  const raw = e.target.value;
                  setTierRubric((prev) => ({
                    ...prev,
                    [key]:
                      raw === ""
                        ? null
                        : (Number(raw) as TierRubricScore),
                  }));
                }}
                className={`${inputClass} py-2.5 pr-9 pl-3`}
              >
                <option value="">Not rated</option>
                {SCORE_OPTIONS.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Discount / upcharge rules</h3>
          <p className="mt-1 text-sm text-muted">
            Adjust list price per unit for this customer. Use +₹ for upcharge
            and −₹ for discount (e.g. Ellfa at list +2 or list −2).
          </p>
        </div>

        {!editing && customer.priceRules.length === 0 ? (
          <p className="text-sm text-muted">No price rules</p>
        ) : (
          <div className="space-y-3">
            {(editing ? priceRules : viewRules).map((rule, index) => (
              <div
                key={rule.key}
                className="grid gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
              >
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Item name{" "}
                    {(editing ? priceRules : customer.priceRules).length > 1
                      ? `#${index + 1}`
                      : ""}
                  </span>
                  {editing ? (
                    <ItemNameCombobox
                      items={priceList}
                      value={rule.itemName}
                      onChange={(value) =>
                        updateRule(rule.key, {
                          itemName: value,
                          priceListItemId: null,
                        })
                      }
                      onSelect={(item) =>
                        updateRule(rule.key, {
                          itemName: item.item_name,
                          priceListItemId: item.id,
                        })
                      }
                      onTabToQty={() => undefined}
                      placeholder="Search price list…"
                      showPrice
                    />
                  ) : (
                    <input
                      type="text"
                      value={rule.itemName || "—"}
                      disabled
                      className={inputClass}
                    />
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    ± ₹ / unit
                  </span>
                  <div
                    className={`flex overflow-hidden rounded-lg border border-border ${
                      editing
                        ? "bg-surface focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20"
                        : "bg-background"
                    }`}
                  >
                    <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={rule.adjustmentPerUnit}
                      onChange={(e) =>
                        updateRule(rule.key, {
                          adjustmentPerUnit: e.target.value,
                        })
                      }
                      disabled={!editing}
                      className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-100"
                      placeholder="0"
                    />
                  </div>
                </label>

                {editing ? (
                  <button
                    type="button"
                    onClick={() => removeRule(rule.key)}
                    className="rounded-lg border border-border px-3 py-2.5 text-sm text-muted hover:bg-sidebar hover:text-foreground"
                    aria-label="Remove rule"
                  >
                    Remove
                  </button>
                ) : (
                  <div className="hidden sm:block" aria-hidden />
                )}

                {rule.itemName.trim() &&
                  Number(rule.adjustmentPerUnit) !== 0 &&
                  Number.isFinite(Number(rule.adjustmentPerUnit)) && (
                    <p className="text-xs text-muted sm:col-span-3">
                      {describeAdjustment(
                        rule.itemName.trim(),
                        Number(rule.adjustmentPerUnit),
                      )}
                    </p>
                  )}
              </div>
            ))}
          </div>
        )}

        {editing && (
          <button
            type="button"
            onClick={addRule}
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          >
            + Add another rule
          </button>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {savedFlash && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Details saved
        </p>
      )}

      {editing && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancelEditing}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
