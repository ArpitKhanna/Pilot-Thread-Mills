"use client";

import { useEffect, useMemo, useState } from "react";
import { CountCombobox } from "@/components/ui/CountCombobox";
import { Modal } from "@/components/ui/Modal";
import { formatKg, getCountBalance } from "@/lib/raw-stock/balance";
import type {
  RawStockBalances,
  RawStockCustomerOption,
  RawStockShadeOption,
  RawStockSupplier,
} from "@/lib/raw-stock/types";

export type MovementModalKind =
  | "opening_balance"
  | "purchase"
  | "send_to_narela"
  | "mark_dyed"
  | "receive_from_narela";

type RawStockModalsProps = {
  movementKind: MovementModalKind | null;
  onCloseMovement: () => void;
  supplierOpen: boolean;
  editingSupplier: RawStockSupplier | null;
  onCloseSupplier: () => void;
  counts: string[];
  suppliers: RawStockSupplier[];
  customers: RawStockCustomerOption[];
  shades: RawStockShadeOption[];
  balances: RawStockBalances;
  onMovementSaved: () => Promise<void>;
  onSupplierSaved: (supplier: RawStockSupplier) => void;
};

const MOVEMENT_TITLES: Record<MovementModalKind, string> = {
  opening_balance: "Opening balance (Narela undyed)",
  purchase: "Add purchase",
  send_to_narela: "Send to Narela",
  mark_dyed: "Mark dyed at Narela",
  receive_from_narela: "Receive from Narela",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RawStockModals({
  movementKind,
  onCloseMovement,
  supplierOpen,
  editingSupplier,
  onCloseSupplier,
  counts,
  suppliers,
  customers,
  shades,
  balances,
  onMovementSaved,
  onSupplierSaved,
}: RawStockModalsProps) {
  return (
    <>
      {movementKind && (
        <MovementFormModal
          kind={movementKind}
          onClose={onCloseMovement}
          counts={counts}
          suppliers={suppliers.filter((s) => s.isActive)}
          customers={customers}
          shades={shades}
          balances={balances}
          onSaved={onMovementSaved}
        />
      )}
      {supplierOpen && (
        <SupplierFormModal
          editing={editingSupplier}
          onClose={onCloseSupplier}
          onSaved={onSupplierSaved}
        />
      )}
    </>
  );
}

function MovementFormModal({
  kind,
  onClose,
  counts,
  suppliers,
  customers,
  shades,
  balances,
  onSaved,
}: {
  kind: MovementModalKind;
  onClose: () => void;
  counts: string[];
  suppliers: RawStockSupplier[];
  customers: RawStockCustomerOption[];
  shades: RawStockShadeOption[];
  balances: RawStockBalances;
  onSaved: () => Promise<void>;
}) {
  const [countLabel, setCountLabel] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [movementDate, setMovementDate] = useState(todayIso);
  const [supplierId, setSupplierId] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [shadeMode, setShadeMode] = useState<"pick" | "free">("pick");
  const [shadeId, setShadeId] = useState("");
  const [shadeCodeText, setShadeCodeText] = useState("");
  const [colorLabel, setColorLabel] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [relatedMovementId, setRelatedMovementId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const countBalance = countLabel
    ? getCountBalance(balances, countLabel)
    : null;

  const shadeOptions = useMemo(() => {
    if (!countLabel) return shades;
    return shades.filter(
      (s) => !s.countLabel || s.countLabel === countLabel,
    );
  }, [shades, countLabel]);

  const dyedLots = useMemo(() => {
    return balances.dyedLots.filter((l) =>
      countLabel ? l.countLabel === countLabel : true,
    );
  }, [balances.dyedLots, countLabel]);

  useEffect(() => {
    if (kind !== "receive_from_narela" || !relatedMovementId) return;
    const lot = balances.dyedLots.find((l) => l.movementId === relatedMovementId);
    if (!lot) return;
    setCountLabel(lot.countLabel);
    setQuantityKg(String(lot.remainingKg));
    setShadeCodeText(lot.shadeCodeText ?? "");
    setColorLabel(lot.colorLabel ?? "");
    setCustomerId(lot.customerId ?? "");
    if (lot.shadeId) {
      setShadeMode("pick");
      setShadeId(lot.shadeId);
    } else {
      setShadeMode("free");
      setShadeId("");
    }
  }, [kind, relatedMovementId, balances.dyedLots]);

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        movementType: kind,
        countLabel,
        quantityKg: Number(quantityKg),
        movementDate,
        notes: notes || null,
      };

      if (kind === "purchase") {
        payload.supplierId = supplierId;
        payload.pricePerKg = pricePerKg === "" ? null : Number(pricePerKg);
      }

      if (kind === "mark_dyed" || kind === "receive_from_narela") {
        payload.customerId = customerId || null;
        if (shadeMode === "pick") {
          payload.shadeId = shadeId || null;
          const selected = shades.find((s) => s.id === shadeId);
          payload.shadeCodeText =
            selected?.shadeCode ?? (shadeCodeText || null);
          payload.colorLabel =
            selected?.colorLabel ?? (colorLabel || null);
        } else {
          payload.shadeId = null;
          payload.shadeCodeText = shadeCodeText || null;
          payload.colorLabel = colorLabel || null;
        }
      }

      if (kind === "receive_from_narela") {
        payload.relatedMovementId = relatedMovementId;
      }

      const res = await fetch("/api/raw-stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const availableHint =
    kind === "send_to_narela" && countBalance
      ? `Available at Rama: ${formatKg(countBalance.ramaUndyedKg)}`
      : kind === "mark_dyed" && countBalance
        ? `Available undyed at Narela: ${formatKg(countBalance.narelaUndyedKg)}`
        : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={MOVEMENT_TITLES[kind]}
      size="lg"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {kind === "receive_from_narela" && (
          <Field label="Dyed lot">
            <select
              value={relatedMovementId}
              onChange={(e) => setRelatedMovementId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select lot…</option>
              {balances.dyedLots.map((lot) => (
                <option key={lot.movementId} value={lot.movementId}>
                  {lot.countLabel} · {formatKg(lot.remainingKg)}
                  {lot.shadeCodeText || lot.colorLabel
                    ? ` · ${lot.shadeCodeText || lot.colorLabel}`
                    : ""}
                  {lot.customerName ? ` · ${lot.customerName}` : " · Internal"}
                </option>
              ))}
            </select>
            {balances.dyedLots.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                No dyed lots waiting to be received
              </p>
            )}
          </Field>
        )}

        <Field label="Count">
          <CountCombobox
            options={counts}
            value={countLabel}
            onChange={setCountLabel}
            disabled={kind === "receive_from_narela" && !!relatedMovementId}
          />
          {availableHint && (
            <p className="mt-1 text-xs text-muted">{availableHint}</p>
          )}
          {kind === "receive_from_narela" && dyedLots.length > 0 && !relatedMovementId && (
            <p className="mt-1 text-xs text-muted">
              Or pick a dyed lot above to autofill
            </p>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Quantity (kg)">
            <input
              type="number"
              min="0"
              step="0.001"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {kind === "purchase" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <p className="mt-1 text-xs text-muted">
                  Add a supplier in the Suppliers tab first
                </p>
              )}
            </Field>
            <Field label="Price per kg (optional)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}

        {(kind === "mark_dyed" ||
          (kind === "receive_from_narela" && relatedMovementId)) && (
          <>
            {kind === "mark_dyed" && (
              <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setShadeMode("pick")}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    shadeMode === "pick" ? "bg-sidebar font-medium" : "text-muted"
                  }`}
                >
                  From shade list
                </button>
                <button
                  type="button"
                  onClick={() => setShadeMode("free")}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    shadeMode === "free" ? "bg-sidebar font-medium" : "text-muted"
                  }`}
                >
                  Free text
                </button>
              </div>
            )}

            {kind === "mark_dyed" && shadeMode === "pick" ? (
              <Field label="Shade">
                <select
                  value={shadeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setShadeId(id);
                    const selected = shades.find((s) => s.id === id);
                    if (selected) {
                      setShadeCodeText(selected.shadeCode);
                      setColorLabel(selected.colorLabel ?? "");
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select shade…</option>
                  {shadeOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shadeCode}
                      {s.colorLabel ? ` · ${s.colorLabel}` : ""}
                      {s.itemName ? ` (${s.itemName})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : kind === "mark_dyed" || kind === "receive_from_narela" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Shade code">
                  <input
                    value={shadeCodeText}
                    onChange={(e) => setShadeCodeText(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    disabled={kind === "receive_from_narela"}
                  />
                </Field>
                <Field label="Color label">
                  <input
                    value={colorLabel}
                    onChange={(e) => setColorLabel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    disabled={kind === "receive_from_narela"}
                  />
                </Field>
              </div>
            ) : null}

            <Field label="Customer (optional)">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                disabled={kind === "receive_from_narela"}
              >
                <option value="">Internal / no customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
    </Modal>
  );
}

function SupplierFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: RawStockSupplier | null;
  onClose: () => void;
  onSaved: (supplier: RawStockSupplier) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const url = editing
        ? `/api/raw-stock/suppliers/${editing.id}`
        : "/api/raw-stock/suppliers";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved(data.supplier);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit supplier" : "Add supplier"}
      footer={
        <div className="flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <Field label="Company name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
