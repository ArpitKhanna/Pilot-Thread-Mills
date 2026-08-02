"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatKg, getCountBalance } from "@/lib/raw-stock/balance";
import type {
  RawStockBalances,
  RawStockCategory,
  RawStockSupplier,
} from "@/lib/raw-stock/types";
import {
  CATEGORY_LABELS,
  COUNTS_BY_CATEGORY,
} from "@/lib/raw-stock/types";

export type MovementModalKind =
  | "opening_balance"
  | "stock_in"
  | "stock_out";

type RawStockModalsProps = {
  movementKind: MovementModalKind | null;
  onCloseMovement: () => void;
  supplierOpen: boolean;
  editingSupplier: RawStockSupplier | null;
  onCloseSupplier: () => void;
  suppliers: RawStockSupplier[];
  balances: RawStockBalances;
  onMovementSaved: () => Promise<void>;
  onSupplierSaved: (supplier: RawStockSupplier) => void;
};

const MOVEMENT_TITLES: Record<MovementModalKind, string> = {
  opening_balance: "Opening balance (Narela)",
  stock_in: "Add stock to Narela",
  stock_out: "Send to Rama Road",
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
  suppliers,
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
          suppliers={suppliers.filter((s) => s.isActive)}
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
  suppliers,
  balances,
  onSaved,
}: {
  kind: MovementModalKind;
  onClose: () => void;
  suppliers: RawStockSupplier[];
  balances: RawStockBalances;
  onSaved: () => Promise<void>;
}) {
  const [category, setCategory] = useState<RawStockCategory>("hank");
  const [countLabel, setCountLabel] = useState(COUNTS_BY_CATEGORY.hank[0]!);
  const [quantityKg, setQuantityKg] = useState("");
  const [movementDate, setMovementDate] = useState(todayIso);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const countOptions = useMemo(
    () => [...COUNTS_BY_CATEGORY[category]],
    [category],
  );

  useEffect(() => {
    if (!COUNTS_BY_CATEGORY[category].includes(countLabel)) {
      setCountLabel(COUNTS_BY_CATEGORY[category][0]!);
    }
  }, [category, countLabel]);

  const countBalance = getCountBalance(balances, category, countLabel);

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        movementType: kind,
        category,
        countLabel,
        quantityKg: Number(quantityKg),
        movementDate,
        notes: notes || null,
      };

      if (kind === "stock_in") {
        payload.supplierId = supplierId || null;
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as RawStockCategory)
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="hank">{CATEGORY_LABELS.hank}</option>
              <option value="cone">{CATEGORY_LABELS.cone}</option>
            </select>
          </Field>
          <Field label="Count">
            <select
              value={countLabel}
              onChange={(e) => setCountLabel(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {countOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {kind === "stock_out" && (
              <p className="mt-1 text-xs text-muted">
                Available at Narela: {formatKg(countBalance.narelaKg)}
              </p>
            )}
          </Field>
        </div>

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

        {kind === "stock_in" && (
          <Field label="Supplier (optional)">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                Add a supplier in the Suppliers tab if needed
              </p>
            )}
          </Field>
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
