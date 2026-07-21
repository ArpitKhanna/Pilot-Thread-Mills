"use client";

import { useEffect, useState } from "react";
import type {
  CustomerTier,
  MarketDay,
  Salesman,
} from "@/lib/salesmen/types";
import {
  CUSTOMER_TIER_LABELS,
  CUSTOMER_TIERS,
  ENTITY_TYPE_LABELS,
  MARKET_DAY_LABELS,
  MARKET_DAYS,
} from "@/lib/salesmen/types";

type CustomerPersonalDetailsFormProps = {
  customer: Salesman;
  onSaved: (customer: Salesman) => void;
};

function syncFromCustomer(customer: Salesman) {
  return {
    name: customer.name,
    phone: customer.phone,
    alternatePhone: customer.alternatePhone,
    isActive: customer.isActive,
    marketDay: customer.marketDay,
    area: customer.area,
    isDefaulter: customer.isDefaulter,
    tier: customer.tier,
    balanceThreshold:
      customer.balanceThreshold != null
        ? String(customer.balanceThreshold)
        : "",
  };
}

export function CustomerPersonalDetailsForm({
  customer,
  onSaved,
}: CustomerPersonalDetailsFormProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [alternatePhone, setAlternatePhone] = useState(
    customer.alternatePhone,
  );
  const [isActive, setIsActive] = useState(customer.isActive);
  const [marketDay, setMarketDay] = useState<MarketDay | "">(
    customer.marketDay,
  );
  const [area, setArea] = useState(customer.area);
  const [isDefaulter, setIsDefaulter] = useState(customer.isDefaulter);
  const [tier, setTier] = useState<CustomerTier | "">(customer.tier);
  const [balanceThreshold, setBalanceThreshold] = useState(
    customer.balanceThreshold != null
      ? String(customer.balanceThreshold)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (editing) return;
    const next = syncFromCustomer(customer);
    setName(next.name);
    setPhone(next.phone);
    setAlternatePhone(next.alternatePhone);
    setIsActive(next.isActive);
    setMarketDay(next.marketDay);
    setArea(next.area);
    setIsDefaulter(next.isDefaulter);
    setTier(next.tier);
    setBalanceThreshold(next.balanceThreshold);
  }, [customer, editing]);

  function startEditing() {
    const next = syncFromCustomer(customer);
    setName(next.name);
    setPhone(next.phone);
    setAlternatePhone(next.alternatePhone);
    setIsActive(next.isActive);
    setMarketDay(next.marketDay);
    setArea(next.area);
    setIsDefaulter(next.isDefaulter);
    setTier(next.tier);
    setBalanceThreshold(next.balanceThreshold);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    const next = syncFromCustomer(customer);
    setName(next.name);
    setPhone(next.phone);
    setAlternatePhone(next.alternatePhone);
    setIsActive(next.isActive);
    setMarketDay(next.marketDay);
    setArea(next.area);
    setIsDefaulter(next.isDefaulter);
    setTier(next.tier);
    setBalanceThreshold(next.balanceThreshold);
    setError(null);
    setEditing(false);
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

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          alternatePhone: alternatePhone.trim(),
          isActive,
          marketDay,
          area: area.trim(),
          isDefaulter,
          tier,
          balanceThreshold: threshold,
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-medium tracking-tight">
            Personal details
          </h2>
          <p className="mt-1 text-sm text-muted">
            Shop profile, market day, tier, and balance alert threshold
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 self-start rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Edit
          </button>
        ) : null}
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Profile</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">
              Shop Name
            </label>
            <input
              type="text"
              value={name}
              disabled={!editing}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Category
            </label>
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
              <label className="flex items-center gap-2 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-border"
                />
                Active
              </label>
            ) : (
              <input
                type="text"
                value={isActive ? "Active" : "Inactive"}
                disabled
                className={inputClass}
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone</label>
            <input
              type="tel"
              value={phone}
              disabled={!editing}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Alternate Phone
            </label>
            <input
              type="tel"
              value={alternatePhone}
              disabled={!editing}
              onChange={(e) => setAlternatePhone(e.target.value)}
              className={inputClass}
            />
          </div>
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
              className={inputClass}
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
            <label className="mb-1.5 block text-sm font-medium">Area</label>
            <input
              type="text"
              value={area}
              disabled={!editing}
              onChange={(e) => setArea(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tier</label>
            <select
              value={tier}
              disabled={!editing}
              onChange={(e) =>
                setTier(e.target.value as CustomerTier | "")
              }
              className={inputClass}
            >
              <option value="">Not set</option>
              {CUSTOMER_TIERS.map((t) => (
                <option key={t} value={t}>
                  {CUSTOMER_TIER_LABELS[t]}
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
            <p className="mt-1 text-xs text-muted">
              Show an alert on this page when pending balance reaches this
              amount
            </p>
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
