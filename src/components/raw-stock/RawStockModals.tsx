"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatKg, getCountBalance } from "@/lib/raw-stock/balance";
import type {
  RawStockBalances,
  RawStockCategory,
  RawStockMovement,
  RawStockSupplier,
} from "@/lib/raw-stock/types";
import {
  CATEGORY_LABELS,
  CONE_COUNTS,
  COUNTS_BY_CATEGORY,
  HANK_COUNTS,
  balanceKey,
} from "@/lib/raw-stock/types";

export type MovementModalKind =
  | "opening_balance"
  | "stock_in"
  | "stock_out";

type RawStockModalsProps = {
  movementKind: MovementModalKind | null;
  onCloseMovement: () => void;
  editingMovement: RawStockMovement | null;
  onCloseEditMovement: () => void;
  editBalances: RawStockBalances | null;
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

const MOVEMENT_HINTS: Record<MovementModalKind, string> = {
  opening_balance: "Enter opening kg for each count under one date. Leave blank to skip.",
  stock_in: "Enter kg added for each count under one date. Leave blank to skip.",
  stock_out: "Enter kg sent to Rama Road for each count under one date. Leave blank to skip.",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MOVEMENT_EDIT_TITLES: Record<MovementModalKind, string> = {
  opening_balance: "Edit opening balance",
  stock_in: "Edit stock in",
  stock_out: "Edit stock out",
};

const MOVEMENT_EDIT_HINTS: Record<MovementModalKind, string> = {
  opening_balance:
    "Update the date, count, and quantity for this opening balance entry.",
  stock_in: "Update the date, count, quantity, supplier, or DO number.",
  stock_out: "Update the date, count, and quantity for this transfer.",
};

function quantitiesFromMovement(movement: RawStockMovement): Record<string, string> {
  const map = emptyQuantities();
  map[balanceKey(movement.category, movement.countLabel)] = String(
    movement.quantityKg,
  );
  return map;
}

function emptyQuantities(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const count of HANK_COUNTS) map[balanceKey("hank", count)] = "";
  for (const count of CONE_COUNTS) map[balanceKey("cone", count)] = "";
  return map;
}

export function RawStockModals({
  movementKind,
  onCloseMovement,
  editingMovement,
  onCloseEditMovement,
  editBalances,
  supplierOpen,
  editingSupplier,
  onCloseSupplier,
  suppliers,
  balances,
  onMovementSaved,
  onSupplierSaved,
}: RawStockModalsProps) {
  const activeKind = editingMovement?.movementType ?? movementKind;

  return (
    <>
      {activeKind && (
        <MovementFormModal
          kind={activeKind}
          editing={editingMovement}
          onClose={editingMovement ? onCloseEditMovement : onCloseMovement}
          suppliers={suppliers.filter((s) => s.isActive)}
          balances={editBalances ?? balances}
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
  editing,
  onClose,
  suppliers,
  balances,
  onSaved,
}: {
  kind: MovementModalKind;
  editing?: RawStockMovement | null;
  onClose: () => void;
  suppliers: RawStockSupplier[];
  balances: RawStockBalances;
  onSaved: () => Promise<void>;
}) {
  const isEditing = editing != null;

  const [quantities, setQuantities] = useState(() =>
    editing ? quantitiesFromMovement(editing) : emptyQuantities(),
  );
  const [movementDate, setMovementDate] = useState(
    editing?.movementDate ?? todayIso(),
  );
  const [supplierId, setSupplierId] = useState(editing?.supplierId ?? "");
  const [doNumber, setDoNumber] = useState(editing?.doNumber ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const filledCount = useMemo(() => {
    return Object.values(quantities).filter((v) => {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) && n > 0;
    }).length;
  }, [quantities]);

  function setQuantity(category: RawStockCategory, countLabel: string, value: string) {
    setQuantities((prev) => ({
      ...prev,
      [balanceKey(category, countLabel)]: value,
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const entries: Array<{
        category: RawStockCategory;
        countLabel: string;
        quantityKg: number;
      }> = [];

      for (const category of ["hank", "cone"] as const) {
        for (const countLabel of COUNTS_BY_CATEGORY[category]) {
          const raw = quantities[balanceKey(category, countLabel)] ?? "";
          if (raw.trim() === "") continue;
          const quantityKg = Number(raw);
          if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
            throw new Error(
              `Quantity for ${CATEGORY_LABELS[category]} ${countLabel} must be a positive number`,
            );
          }
          entries.push({ category, countLabel, quantityKg });
        }
      }

      if (entries.length === 0) {
        throw new Error("Enter at least one quantity");
      }

      if (isEditing) {
        if (entries.length !== 1) {
          throw new Error("Edit one count at a time — fill only the row you want");
        }

        const entry = entries[0]!;
        const payload: Record<string, unknown> = {
          category: entry.category,
          countLabel: entry.countLabel,
          quantityKg: entry.quantityKg,
          movementDate,
          notes: notes || null,
        };

        if (kind === "stock_in") {
          payload.supplierId = supplierId || null;
          payload.doNumber = doNumber.trim() || null;
        }

        const res = await fetch(`/api/raw-stock/movements/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save");
        await onSaved();
        return;
      }

      const payload: Record<string, unknown> = {
        movementType: kind,
        movementDate,
        notes: notes || null,
        entries,
      };

      if (kind === "stock_in") {
        payload.supplierId = supplierId || null;
        payload.doNumber = doNumber.trim() || null;
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

  async function handleDelete() {
    if (!editing) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/raw-stock/movements/${editing.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? MOVEMENT_EDIT_TITLES[kind] : MOVEMENT_TITLES[kind]}
      size="2xl"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {isEditing ? (
            !confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-[#c45c26] hover:underline"
              >
                Remove entry
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Remove this entry?</span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                  className="rounded-lg bg-[#c45c26] px-3 py-1.5 text-background disabled:opacity-60"
                >
                  {deleting ? "Removing…" : "Yes, remove"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )
          ) : (
            <p className="text-xs text-muted">
              {filledCount > 0
                ? `${filledCount} count${filledCount === 1 ? "" : "s"} ready to save`
                : "Fill any counts you need"}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => void handleSubmit()}
              className="rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-60"
            >
              {saving ? "Saving…" : isEditing ? "Save changes" : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <p className="text-sm text-muted">
          {isEditing ? MOVEMENT_EDIT_HINTS[kind] : MOVEMENT_HINTS[kind]}
        </p>

        <div
          className={`grid gap-4 ${kind === "stock_in" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          <Field label="Date">
            <input
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          {kind === "stock_in" && (
            <>
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
                  {editing?.supplierId &&
                    !suppliers.some((s) => s.id === editing.supplierId) && (
                      <option value={editing.supplierId}>
                        {editing.supplierName ?? "Previous supplier"}
                      </option>
                    )}
                </select>
              </Field>
              <Field label="DO number (optional)">
                <input
                  type="text"
                  value={doNumber}
                  onChange={(e) => setDoNumber(e.target.value)}
                  placeholder="Delivery order no."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CountGrid
            category="hank"
            kind={kind}
            balances={balances}
            quantities={quantities}
            onChange={setQuantity}
          />
          <CountGrid
            category="cone"
            kind={kind}
            balances={balances}
            quantities={quantities}
            onChange={setQuantity}
          />
        </div>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={
              isEditing
                ? "Notes for this entry"
                : "Applies to all entries saved in this batch"
            }
          />
        </Field>
      </div>
    </Modal>
  );
}

function CountGrid({
  category,
  kind,
  balances,
  quantities,
  onChange,
}: {
  category: RawStockCategory;
  kind: MovementModalKind;
  balances: RawStockBalances;
  quantities: Record<string, string>;
  onChange: (
    category: RawStockCategory,
    countLabel: string,
    value: string,
  ) => void;
}) {
  const counts = COUNTS_BY_CATEGORY[category];

  return (
    <section className="rounded-xl border border-border">
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-sm font-medium">{CATEGORY_LABELS[category]}</h3>
      </div>
      <ul className="divide-y divide-border">
        {counts.map((countLabel) => {
          const key = balanceKey(category, countLabel);
          const available = getCountBalance(
            balances,
            category,
            countLabel,
          ).narelaKg;
          return (
            <li
              key={key}
              className="flex items-center gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular-nums">{countLabel}</p>
                {kind === "stock_out" && (
                  <p className="text-[11px] text-muted">
                    Available {formatKg(available)}
                  </p>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                placeholder="kg"
                value={quantities[key] ?? ""}
                onChange={(e) => onChange(category, countLabel, e.target.value)}
                onWheel={(e) => {
                  if (document.activeElement === e.currentTarget) {
                    e.currentTarget.blur();
                  }
                }}
                className="w-28 shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-right text-sm tabular-nums"
              />
            </li>
          );
        })}
      </ul>
    </section>
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
