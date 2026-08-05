import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { deriveBalances, isValidMovementType } from "./balance";
import { listMovements } from "./queries";
import type { RawStockCategory, RawStockMovement, RawStockMovementType } from "./types";
import {
  CATEGORY_LABELS,
  isRawStockCategory,
  isValidCountForCategory,
} from "./types";

export async function requireRawStockAccess() {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return { error: auth.error };

  const { supabase, profile, user } = auth as Exclude<
    typeof auth,
    { error: NextResponse }
  >;

  if (!["admin", "accountant"].includes(profile.role ?? "")) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, profile, user };
}

export function parseQuantityKg(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

export function parseDateOnly(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

function parseDoNumber(
  value: unknown,
  movementType: RawStockMovementType,
): string | null | { error: string } {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (movementType !== "stock_in") {
    return { error: "DO number is only allowed when adding stock" };
  }
  if (trimmed.length > 64) {
    return { error: "DO number must be 64 characters or fewer" };
  }
  return trimmed;
}

function readDoNumberField(
  body: Record<string, unknown>,
  movementType: RawStockMovementType,
): { error: string } | { doNumber: string | null } {
  const parsed = parseDoNumber(body.doNumber ?? body.do_number, movementType);
  if (parsed !== null && typeof parsed === "object") {
    return parsed;
  }
  return { doNumber: parsed };
}

export type ValidatedMovementData = {
  movementType: RawStockMovementType;
  category: RawStockCategory;
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId: string | null;
  doNumber: string | null;
  notes: string | null;
};

export type ValidatedMovementPayload =
  | { error: string }
  | { data: ValidatedMovementData };

export function validateMovementPayload(
  body: Record<string, unknown>,
): ValidatedMovementPayload {
  const movementTypeRaw = String(body.movementType ?? body.movement_type ?? "");
  if (!isValidMovementType(movementTypeRaw)) {
    return { error: "Invalid movement type" };
  }

  const categoryRaw = String(body.category ?? "")
    .trim()
    .toLowerCase();
  if (!isRawStockCategory(categoryRaw)) {
    return { error: "Category must be Hank or Cone" };
  }

  const countLabel = String(body.countLabel ?? body.count_label ?? "").trim();
  if (!countLabel) {
    return { error: "Count is required" };
  }
  if (!isValidCountForCategory(categoryRaw, countLabel)) {
    return {
      error: `Count ${countLabel} is not valid for ${CATEGORY_LABELS[categoryRaw]}`,
    };
  }

  const quantityKg = parseQuantityKg(body.quantityKg ?? body.quantity_kg);
  if (quantityKg == null) {
    return { error: "Quantity (kg) must be a positive number" };
  }

  const movementDate =
    parseDateOnly(body.movementDate ?? body.movement_date) ??
    new Date().toISOString().slice(0, 10);

  const supplierRaw = body.supplierId ?? body.supplier_id;
  const supplierId =
    supplierRaw == null || supplierRaw === ""
      ? null
      : String(supplierRaw).trim();

  if (
    supplierId &&
    (movementTypeRaw === "stock_out" || movementTypeRaw === "opening_balance")
  ) {
    return {
      error: "Supplier is only allowed when adding stock",
    };
  }

  const doNumberField = readDoNumberField(body, movementTypeRaw);
  if ("error" in doNumberField) {
    return { error: doNumberField.error };
  }

  const notes = String(body.notes ?? "").trim();

  return {
    data: {
      movementType: movementTypeRaw,
      category: categoryRaw,
      countLabel,
      quantityKg,
      movementDate,
      supplierId,
      doNumber: doNumberField.doNumber,
      notes: notes || null,
    },
  };
}

export type ValidatedBatchMovementData = {
  movementType: RawStockMovementType;
  movementDate: string;
  supplierId: string | null;
  doNumber: string | null;
  notes: string | null;
  entries: Array<{
    category: RawStockCategory;
    countLabel: string;
    quantityKg: number;
  }>;
};

export type ValidatedBatchMovementPayload =
  | { error: string }
  | { data: ValidatedBatchMovementData };

export function validateBatchMovementPayload(
  body: Record<string, unknown>,
): ValidatedBatchMovementPayload {
  const movementTypeRaw = String(body.movementType ?? body.movement_type ?? "");
  if (!isValidMovementType(movementTypeRaw)) {
    return { error: "Invalid movement type" };
  }

  const movementDate =
    parseDateOnly(body.movementDate ?? body.movement_date) ??
    new Date().toISOString().slice(0, 10);

  const supplierRaw = body.supplierId ?? body.supplier_id;
  const supplierId =
    supplierRaw == null || supplierRaw === ""
      ? null
      : String(supplierRaw).trim();

  if (
    supplierId &&
    (movementTypeRaw === "stock_out" || movementTypeRaw === "opening_balance")
  ) {
    return { error: "Supplier is only allowed when adding stock" };
  }

  const doNumberField = readDoNumberField(body, movementTypeRaw);
  if ("error" in doNumberField) {
    return { error: doNumberField.error };
  }

  const notes = String(body.notes ?? "").trim();
  const rawEntries = body.entries;
  if (!Array.isArray(rawEntries)) {
    return { error: "Entries are required" };
  }

  const entries: ValidatedBatchMovementData["entries"] = [];
  const seen = new Set<string>();

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const categoryRaw = String(row.category ?? "")
      .trim()
      .toLowerCase();
    if (!isRawStockCategory(categoryRaw)) {
      return { error: "Each entry needs a valid category" };
    }

    const countLabel = String(row.countLabel ?? row.count_label ?? "").trim();
    if (!countLabel || !isValidCountForCategory(categoryRaw, countLabel)) {
      return {
        error: `Count ${countLabel || "(blank)"} is not valid for ${CATEGORY_LABELS[categoryRaw]}`,
      };
    }

    const qtyRaw = row.quantityKg ?? row.quantity_kg;
    if (qtyRaw === undefined || qtyRaw === null || qtyRaw === "") continue;
    const quantityKg = parseQuantityKg(qtyRaw);
    if (quantityKg == null) {
      return {
        error: `Quantity for ${CATEGORY_LABELS[categoryRaw]} ${countLabel} must be a positive number`,
      };
    }

    const key = `${categoryRaw}::${countLabel}`;
    if (seen.has(key)) {
      return {
        error: `Duplicate entry for ${CATEGORY_LABELS[categoryRaw]} ${countLabel}`,
      };
    }
    seen.add(key);
    entries.push({ category: categoryRaw, countLabel, quantityKg });
  }

  if (entries.length === 0) {
    return { error: "Enter at least one quantity" };
  }

  return {
    data: {
      movementType: movementTypeRaw,
      movementDate,
      supplierId,
      doNumber: doNumberField.doNumber,
      notes: notes || null,
      entries,
    },
  };
}

export async function assertSufficientBalance(
  supabase: Parameters<typeof listMovements>[0],
  payload: ValidatedMovementData,
) {
  if (payload.movementType !== "stock_out") {
    return { ok: true as const };
  }

  const movements = await listMovements(supabase);
  const balances = deriveBalances(movements);
  const row =
    balances.byCount.find(
      (c) =>
        c.category === payload.category &&
        c.countLabel === payload.countLabel,
    ) ?? {
      category: payload.category,
      countLabel: payload.countLabel,
      narelaKg: 0,
    };

  if (payload.quantityKg > row.narelaKg + 0.0005) {
    return {
      error: `Insufficient Narela stock for ${CATEGORY_LABELS[payload.category]} ${payload.countLabel} (available ${row.narelaKg} kg)`,
    };
  }

  return { ok: true as const };
}

export async function assertSufficientBalancesForBatch(
  supabase: Parameters<typeof listMovements>[0],
  payload: ValidatedBatchMovementData,
) {
  if (payload.movementType !== "stock_out") {
    return { ok: true as const };
  }

  const movements = await listMovements(supabase);
  const balances = deriveBalances(movements);

  for (const entry of payload.entries) {
    const row =
      balances.byCount.find(
        (c) =>
          c.category === entry.category && c.countLabel === entry.countLabel,
      ) ?? {
        category: entry.category,
        countLabel: entry.countLabel,
        narelaKg: 0,
      };

    if (entry.quantityKg > row.narelaKg + 0.0005) {
      return {
        error: `Insufficient Narela stock for ${CATEGORY_LABELS[entry.category]} ${entry.countLabel} (available ${row.narelaKg} kg)`,
      };
    }
  }

  return { ok: true as const };
}

export type ValidatedMovementUpdateData = {
  category: RawStockCategory;
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId: string | null;
  doNumber: string | null;
  notes: string | null;
};

export type ValidatedMovementUpdatePayload =
  | { error: string }
  | { data: ValidatedMovementUpdateData };

export function validateMovementUpdatePayload(
  body: Record<string, unknown>,
  movementType: RawStockMovementType,
): ValidatedMovementUpdatePayload {
  const categoryRaw = String(body.category ?? "")
    .trim()
    .toLowerCase();
  if (!isRawStockCategory(categoryRaw)) {
    return { error: "Category must be Hank or Cone" };
  }

  const countLabel = String(body.countLabel ?? body.count_label ?? "").trim();
  if (!countLabel) {
    return { error: "Count is required" };
  }
  if (!isValidCountForCategory(categoryRaw, countLabel)) {
    return {
      error: `Count ${countLabel} is not valid for ${CATEGORY_LABELS[categoryRaw]}`,
    };
  }

  const quantityKg = parseQuantityKg(body.quantityKg ?? body.quantity_kg);
  if (quantityKg == null) {
    return { error: "Quantity (kg) must be a positive number" };
  }

  const movementDate = parseDateOnly(body.movementDate ?? body.movement_date);
  if (!movementDate) {
    return { error: "Valid date is required" };
  }

  const supplierRaw = body.supplierId ?? body.supplier_id;
  const supplierId =
    supplierRaw == null || supplierRaw === ""
      ? null
      : String(supplierRaw).trim();

  if (
    supplierId &&
    (movementType === "stock_out" || movementType === "opening_balance")
  ) {
    return { error: "Supplier is only allowed when adding stock" };
  }

  const doNumberField = readDoNumberField(body, movementType);
  if ("error" in doNumberField) {
    return { error: doNumberField.error };
  }

  const notes = String(body.notes ?? "").trim();

  return {
    data: {
      category: categoryRaw,
      countLabel,
      quantityKg,
      movementDate,
      supplierId,
      doNumber: doNumberField.doNumber,
      notes: notes || null,
    },
  };
}

export function assertMovementUpdateBalances(
  movements: RawStockMovement[],
  existingId: string,
  update: ValidatedMovementUpdateData,
): { error: string } | { ok: true } {
  const current = movements.find((m) => m.id === existingId);
  if (!current) {
    return { error: "Movement not found" };
  }

  const updated: RawStockMovement = {
    ...current,
    ...update,
    movementType: current.movementType,
  };

  const simulated = movements.map((m) => (m.id === existingId ? updated : m));
  const balances = deriveBalances(simulated);

  for (const row of balances.byCount) {
    if (row.narelaKg < -0.0005) {
      return {
        error: `This change would leave ${CATEGORY_LABELS[row.category]} ${row.countLabel} with insufficient stock`,
      };
    }
  }

  return { ok: true };
}

export function assertMovementDeleteBalances(
  movements: RawStockMovement[],
  existingId: string,
): { error: string } | { ok: true } {
  const remaining = movements.filter((m) => m.id !== existingId);
  const balances = deriveBalances(remaining);

  for (const row of balances.byCount) {
    if (row.narelaKg < -0.0005) {
      return {
        error: `Cannot remove this entry: ${CATEGORY_LABELS[row.category]} ${row.countLabel} would go negative`,
      };
    }
  }

  return { ok: true };
}
