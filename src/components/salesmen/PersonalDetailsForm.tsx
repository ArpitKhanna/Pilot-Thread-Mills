"use client";

import { useState } from "react";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import type { PriceListItem } from "@/lib/auth/types";
import type {
  Salesman,
  SalesmanDiscountRule,
  SalesmanEntityType,
} from "@/lib/salesmen/types";
import { ENTITY_TYPE_LABELS } from "@/lib/salesmen/types";

type DraftRule = {
  key: string;
  itemName: string;
  priceListItemId: string | null;
  amountPerUnit: string;
};

type PersonalDetailsFormProps = {
  salesman: Salesman;
  priceList: PriceListItem[];
  onSaved: (salesman: Salesman) => void;
};

function rulesToDraft(rules: SalesmanDiscountRule[]): DraftRule[] {
  if (rules.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        itemName: "",
        priceListItemId: null,
        amountPerUnit: "",
      },
    ];
  }
  return rules.map((rule) => ({
    key: rule.id,
    itemName: rule.itemName,
    priceListItemId: rule.priceListItemId ?? null,
    amountPerUnit: String(rule.amountPerUnit),
  }));
}

function buildDescription(itemName: string, amount: number): string {
  return `₹${amount} per ${itemName}`;
}

export function PersonalDetailsForm({
  salesman,
  priceList,
  onSaved,
}: PersonalDetailsFormProps) {
  const [name, setName] = useState(salesman.name);
  const [entityType, setEntityType] = useState<SalesmanEntityType>(
    salesman.entityType,
  );
  const [phone, setPhone] = useState(salesman.phone);
  const [alternatePhone, setAlternatePhone] = useState(
    salesman.alternatePhone,
  );
  const [rules, setRules] = useState<DraftRule[]>(() =>
    rulesToDraft(salesman.discountRules),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function updateRule(key: string, patch: Partial<DraftRule>) {
    setRules((prev) =>
      prev.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)),
    );
  }

  function addRule() {
    setRules((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        itemName: "",
        priceListItemId: null,
        amountPerUnit: "",
      },
    ]);
  }

  function removeRule(key: string) {
    setRules((prev) => {
      const next = prev.filter((rule) => rule.key !== key);
      return next.length > 0
        ? next
        : [
            {
              key: crypto.randomUUID(),
              itemName: "",
              priceListItemId: null,
              amountPerUnit: "",
            },
          ];
    });
  }

  async function handleSave() {
    setError(null);
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!trimmedPhone) {
      setError("Phone number is required.");
      return;
    }

    const discountRules: SalesmanDiscountRule[] = [];
    for (const rule of rules) {
      const itemName = rule.itemName.trim();
      const amount = Number(rule.amountPerUnit);
      const blank =
        !itemName &&
        (!rule.amountPerUnit.trim() || Number(rule.amountPerUnit) === 0);
      if (blank) continue;
      if (!itemName) {
        setError("Each discount rule needs an item name.");
        return;
      }
      if (!Number.isFinite(amount) || amount < 0) {
        setError("Each discount rule needs a valid rupee amount.");
        return;
      }
      discountRules.push({
        id: rule.key,
        itemName,
        priceListItemId: rule.priceListItemId ?? undefined,
        amountPerUnit: amount,
        description: buildDescription(itemName, amount),
      });
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/salesmen/${salesman.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          entityType,
          phone: trimmedPhone,
          alternatePhone: alternatePhone.trim(),
          discountRules,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        salesman?: Salesman;
      };
      if (!res.ok || !data.salesman) {
        throw new Error(data.error || "Could not save details.");
      }
      onSaved(data.salesman);
      setRules(rulesToDraft(data.salesman.discountRules));
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Personal details</h2>
        <p className="mt-1 text-sm text-muted">
          Contact info and purchase discount rules for invoices
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Profile</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Type of entity
            </span>
            <select
              value={entityType}
              onChange={(e) =>
                setEntityType(e.target.value as SalesmanEntityType)
              }
              className="w-full rounded-lg border border-border bg-surface py-2.5 pr-9 pl-3 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
            >
              {(Object.keys(ENTITY_TYPE_LABELS) as SalesmanEntityType[]).map(
                (type) => (
                  <option key={type} value={type}>
                    {ENTITY_TYPE_LABELS[type]}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="hidden sm:block" aria-hidden />

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Phone number
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="919876543210"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Alternate phone number
            </span>
            <input
              type="tel"
              value={alternatePhone}
              onChange={(e) => setAlternatePhone(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">Discount rules</h3>
          <p className="mt-1 text-sm text-muted">
            For every matching item purchased, award a per-unit rupee discount.
            Add as many rules as needed.
          </p>
        </div>

        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div
              key={rule.key}
              className="grid gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
            >
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Item name {rules.length > 1 ? `#${index + 1}` : ""}
                </span>
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
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Discount (₹)
                </span>
                <div className="flex overflow-hidden rounded-lg border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20">
                  <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={rule.amountPerUnit}
                    onChange={(e) =>
                      updateRule(rule.key, { amountPerUnit: e.target.value })
                    }
                    className="w-full min-w-0 px-3 py-2.5 text-sm tabular-nums outline-none"
                    placeholder="0"
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={() => removeRule(rule.key)}
                className="rounded-lg border border-border px-3 py-2.5 text-sm text-muted hover:bg-sidebar hover:text-foreground"
                aria-label="Remove rule"
              >
                Remove
              </button>

              {rule.itemName.trim() && Number(rule.amountPerUnit) > 0 && (
                <p className="text-xs text-muted sm:col-span-3">
                  For every{" "}
                  <span className="text-foreground">{rule.itemName.trim()}</span>{" "}
                  purchased, discount of{" "}
                  <span className="text-foreground">
                    ₹{Number(rule.amountPerUnit)}
                  </span>{" "}
                  is awarded.
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRule}
          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
        >
          + Add another rule
        </button>
      </section>

      {error && (
        <p className="text-sm text-[#c45c26]" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedFlash && (
          <span className="text-sm text-emerald-700">Saved</span>
        )}
      </div>
    </div>
  );
}
