import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { deriveBalances, isValidMovementType } from "./balance";
import { listMovements } from "./queries";
import type { RawStockCategory, RawStockMovementType } from "./types";
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

export type ValidatedMovementData = {
  movementType: RawStockMovementType;
  category: RawStockCategory;
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId: string | null;
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

  const notes = String(body.notes ?? "").trim();

  return {
    data: {
      movementType: movementTypeRaw,
      category: categoryRaw,
      countLabel,
      quantityKg,
      movementDate,
      supplierId,
      notes: notes || null,
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
