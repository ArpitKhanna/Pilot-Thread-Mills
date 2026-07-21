import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { deriveBalances, isValidMovementType } from "./balance";
import { listMovements } from "./queries";
import type { RawStockMovementType } from "./types";

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
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId: string | null;
  pricePerKg: number | null;
  shadeId: string | null;
  shadeCodeText: string | null;
  colorLabel: string | null;
  customerId: string | null;
  relatedMovementId: string | null;
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

  const countLabel = String(body.countLabel ?? body.count_label ?? "").trim();
  if (!countLabel) {
    return { error: "Count is required" };
  }

  const quantityKg = parseQuantityKg(body.quantityKg ?? body.quantity_kg);
  if (quantityKg == null) {
    return { error: "Quantity (kg) must be a positive number" };
  }

  const movementDate =
    parseDateOnly(body.movementDate ?? body.movement_date) ??
    new Date().toISOString().slice(0, 10);

  const supplierId = body.supplierId ?? body.supplier_id;
  const priceRaw = body.pricePerKg ?? body.price_per_kg;
  let pricePerKg: number | null = null;
  if (priceRaw !== undefined && priceRaw !== null && priceRaw !== "") {
    const n = Number(priceRaw);
    if (!Number.isFinite(n) || n < 0) {
      return { error: "Price per kg must be zero or greater" };
    }
    pricePerKg = Math.round(n * 100) / 100;
  }

  const shadeIdRaw = body.shadeId ?? body.shade_id;
  const shadeId =
    shadeIdRaw == null || shadeIdRaw === ""
      ? null
      : String(shadeIdRaw).trim();

  const shadeCodeText = String(
    body.shadeCodeText ?? body.shade_code_text ?? "",
  ).trim();
  const colorLabel = String(body.colorLabel ?? body.color_label ?? "").trim();
  const customerIdRaw = body.customerId ?? body.customer_id;
  const customerId =
    customerIdRaw == null || customerIdRaw === ""
      ? null
      : String(customerIdRaw).trim();
  const relatedRaw = body.relatedMovementId ?? body.related_movement_id;
  const relatedMovementId =
    relatedRaw == null || relatedRaw === "" ? null : String(relatedRaw).trim();
  const notes = String(body.notes ?? "").trim();

  if (movementTypeRaw === "purchase" && !supplierId) {
    return { error: "Supplier is required for purchases" };
  }

  if (movementTypeRaw === "receive_from_narela" && !relatedMovementId) {
    return { error: "Select the dyed lot being received" };
  }

  if (movementTypeRaw === "mark_dyed" && !shadeId && !shadeCodeText) {
    return { error: "Shade / color is required when recording dyeing" };
  }

  return {
    data: {
      movementType: movementTypeRaw,
      countLabel,
      quantityKg,
      movementDate,
      supplierId: supplierId ? String(supplierId) : null,
      pricePerKg,
      shadeId,
      shadeCodeText: shadeCodeText || null,
      colorLabel: colorLabel || null,
      customerId,
      relatedMovementId,
      notes: notes || null,
    },
  };
}

export async function assertSufficientBalance(
  supabase: Parameters<typeof listMovements>[0],
  payload: ValidatedMovementData,
) {
  const movements = await listMovements(supabase);
  const balances = deriveBalances(movements);
  const row =
    balances.byCount.find((c) => c.countLabel === payload.countLabel) ?? {
      countLabel: payload.countLabel,
      ramaUndyedKg: 0,
      narelaUndyedKg: 0,
      narelaDyedKg: 0,
    };

  if (payload.movementType === "send_to_narela") {
    if (payload.quantityKg > row.ramaUndyedKg + 0.0005) {
      return {
        error: `Insufficient Rama Road stock for ${payload.countLabel} (available ${row.ramaUndyedKg} kg)`,
      };
    }
  }

  if (payload.movementType === "mark_dyed") {
    if (payload.quantityKg > row.narelaUndyedKg + 0.0005) {
      return {
        error: `Insufficient Narela undyed stock for ${payload.countLabel} (available ${row.narelaUndyedKg} kg)`,
      };
    }
  }

  if (payload.movementType === "receive_from_narela") {
    const lot = balances.dyedLots.find(
      (l) => l.movementId === payload.relatedMovementId,
    );
    if (!lot) {
      return { error: "Dyed lot not found or already fully received" };
    }
    if (lot.countLabel !== payload.countLabel) {
      return { error: "Count does not match the selected dyed lot" };
    }
    if (payload.quantityKg > lot.remainingKg + 0.0005) {
      return {
        error: `Insufficient dyed lot remaining (available ${lot.remainingKg} kg)`,
      };
    }
  }

  return { ok: true as const };
}
