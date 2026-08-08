import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAllShadeBalances } from "./balance";
import {
  mapFinishedStockMovementRow,
  mapInventoryShadeRow,
  type DbFinishedStockMovementRow,
  type DbInventoryShadeRow,
} from "./mappers";
import { ELLFA_270_ITEM_NAME } from "./ellfa-shades";
import type {
  FinishedStockMovement,
  FinishedStockMovementType,
  InventoryShade,
  ShadeBalance,
} from "./types";
import { ELLFA_270_UNIT } from "./types";

const MOVEMENT_SELECT = `
  *,
  price_list_items:price_list_item_id ( item_name )
`;

const SHADE_SELECT = `
  id,
  price_list_item_id,
  shade_code,
  color_label,
  color_hex,
  card_column,
  card_row,
  min_stock_threshold,
  target_stock_level,
  is_active
`;

export async function getEllfa270ItemId(
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase
    .from("price_list_items")
    .select("id")
    .ilike("item_name", ELLFA_270_ITEM_NAME)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error(`${ELLFA_270_ITEM_NAME} not found in price list`);
  }
  return data.id;
}

export async function listShadesForItem(
  supabase: SupabaseClient,
  priceListItemId: string,
): Promise<InventoryShade[]> {
  const { data, error } = await supabase
    .from("item_shades")
    .select(SHADE_SELECT)
    .eq("price_list_item_id", priceListItemId)
    .eq("is_active", true)
    .order("card_column", { ascending: true, nullsFirst: false })
    .order("card_row", { ascending: true, nullsFirst: false })
    .order("shade_code");
  if (error) throw error;
  return ((data ?? []) as DbInventoryShadeRow[]).map(mapInventoryShadeRow);
}

export async function listMovementsForItem(
  supabase: SupabaseClient,
  priceListItemId: string,
): Promise<FinishedStockMovement[]> {
  const { data, error } = await supabase
    .from("finished_stock_movements")
    .select(MOVEMENT_SELECT)
    .eq("price_list_item_id", priceListItemId)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbFinishedStockMovementRow[]).map(
    mapFinishedStockMovementRow,
  );
}

export async function getShadeBalancesForItem(
  supabase: SupabaseClient,
  priceListItemId: string,
): Promise<ShadeBalance[]> {
  const [shades, movements] = await Promise.all([
    listShadesForItem(supabase, priceListItemId),
    listMovementsForItem(supabase, priceListItemId),
  ]);
  return buildAllShadeBalances(
    shades.map((s) => ({
      id: s.id,
      shadeCode: s.shadeCode,
      cardColumn: s.cardColumn,
      cardRow: s.cardRow,
      colorHex: s.colorHex,
      minStockThreshold: s.minStockThreshold,
      targetStockLevel: s.targetStockLevel,
    })),
    movements,
  );
}

export type CreateMovementInput = {
  movementType: FinishedStockMovementType;
  priceListItemId: string;
  shadeId: string;
  shadeCode: string;
  quantity: number;
  movementDate?: string;
  orderId?: string | null;
  orderLineId?: string | null;
  dyeingJobId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  unit?: typeof ELLFA_270_UNIT;
};

export async function createMovement(
  supabase: SupabaseClient,
  input: CreateMovementInput,
): Promise<FinishedStockMovement> {
  if (!(input.quantity > 0)) {
    throw new Error("Quantity must be greater than 0");
  }

  const { data, error } = await supabase
    .from("finished_stock_movements")
    .insert({
      movement_type: input.movementType,
      price_list_item_id: input.priceListItemId,
      shade_id: input.shadeId,
      shade_code: input.shadeCode,
      unit: input.unit ?? ELLFA_270_UNIT,
      quantity: input.quantity,
      movement_date:
        input.movementDate ?? new Date().toISOString().slice(0, 10),
      order_id: input.orderId ?? null,
      order_line_id: input.orderLineId ?? null,
      dyeing_job_id: input.dyeingJobId ?? null,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select(MOVEMENT_SELECT)
    .single();
  if (error) throw error;
  return mapFinishedStockMovementRow(data as DbFinishedStockMovementRow);
}

export type OpeningBalanceEntry = {
  shadeId: string;
  shadeCode: string;
  quantity: number;
};

export async function saveOpeningBalances(
  supabase: SupabaseClient,
  priceListItemId: string,
  entries: OpeningBalanceEntry[],
  createdBy: string,
  replaceExisting = false,
): Promise<number> {
  let saved = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const entry of entries) {
    if (!(entry.quantity >= 0)) continue;

    if (replaceExisting) {
      await supabase
        .from("finished_stock_movements")
        .delete()
        .eq("price_list_item_id", priceListItemId)
        .eq("shade_id", entry.shadeId)
        .eq("movement_type", "opening_balance");
    } else {
      const { data: existing } = await supabase
        .from("finished_stock_movements")
        .select("id")
        .eq("price_list_item_id", priceListItemId)
        .eq("shade_id", entry.shadeId)
        .eq("movement_type", "opening_balance")
        .limit(1)
        .maybeSingle();
      if (existing) continue;
    }

    if (entry.quantity === 0) continue;

    await createMovement(supabase, {
      movementType: "opening_balance",
      priceListItemId,
      shadeId: entry.shadeId,
      shadeCode: entry.shadeCode,
      quantity: entry.quantity,
      movementDate: today,
      notes: replaceExisting ? "Opening balance (updated)" : "Opening balance",
      createdBy,
    });
    saved += 1;
  }

  return saved;
}

export type UpdateShadeThresholdInput = {
  shadeId: string;
  minStockThreshold?: number | null;
  targetStockLevel?: number | null;
};

export async function updateShadeThresholds(
  supabase: SupabaseClient,
  updates: UpdateShadeThresholdInput[],
): Promise<void> {
  for (const update of updates) {
    const patch: Record<string, unknown> = {};
    if (update.minStockThreshold !== undefined) {
      patch.min_stock_threshold = update.minStockThreshold;
    }
    if (update.targetStockLevel !== undefined) {
      patch.target_stock_level = update.targetStockLevel;
    }
    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabase
      .from("item_shades")
      .update(patch)
      .eq("id", update.shadeId);
    if (error) throw error;
  }
}

export async function getMovementByOrderLineId(
  supabase: SupabaseClient,
  orderLineId: string,
): Promise<FinishedStockMovement | null> {
  const { data, error } = await supabase
    .from("finished_stock_movements")
    .select(MOVEMENT_SELECT)
    .eq("order_line_id", orderLineId)
    .eq("movement_type", "stock_out")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapFinishedStockMovementRow(data as DbFinishedStockMovementRow);
}

export async function reversePackStockOut(
  supabase: SupabaseClient,
  orderLineId: string,
  createdBy: string,
): Promise<void> {
  const existing = await getMovementByOrderLineId(supabase, orderLineId);
  if (!existing) return;

  await createMovement(supabase, {
    movementType: "adjustment",
    priceListItemId: existing.priceListItemId,
    shadeId: existing.shadeId,
    shadeCode: existing.shadeCode,
    quantity: existing.quantity,
    notes: `Reversal of pack stock-out for order line ${orderLineId}`,
    createdBy,
    orderId: existing.orderId,
    orderLineId,
  });

  await supabase
    .from("finished_stock_movements")
    .delete()
    .eq("id", existing.id);
}

export async function hasOpenDyeingForShade(
  supabase: SupabaseClient,
  priceListItemId: string,
  shadeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("dyeing_jobs")
    .select("id")
    .eq("price_list_item_id", priceListItemId)
    .eq("shade_id", shadeId)
    .in("status", ["queued", "dyeing"])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function hasOpenPendingForShade(
  supabase: SupabaseClient,
  priceListItemId: string,
  shadeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("customer_pending_items")
    .select("id")
    .eq("price_list_item_id", priceListItemId)
    .eq("shade_id", shadeId)
    .in("status", ["open", "in_dyeing", "ready"])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function creditStockFromDyeingJob(
  supabase: SupabaseClient,
  job: {
    id: string;
    priceListItemId: string | null;
    shadeId: string | null;
    shadeCode: string;
    qty: number;
    unit: string;
  },
  createdBy: string | null,
): Promise<FinishedStockMovement | null> {
  if (!job.priceListItemId || !job.shadeId) return null;

  const { data: existing } = await supabase
    .from("finished_stock_movements")
    .select("id")
    .eq("dyeing_job_id", job.id)
    .eq("movement_type", "stock_in")
    .maybeSingle();
  if (existing) return null;

  return createMovement(supabase, {
    movementType: "stock_in",
    priceListItemId: job.priceListItemId,
    shadeId: job.shadeId,
    shadeCode: job.shadeCode,
    quantity: job.qty,
    dyeingJobId: job.id,
    notes: "Stock in from completed dyeing job",
    createdBy: createdBy ?? undefined,
    unit: job.unit as typeof ELLFA_270_UNIT,
  });
}
