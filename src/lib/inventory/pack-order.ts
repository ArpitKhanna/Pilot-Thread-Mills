import type { SupabaseClient } from "@supabase/supabase-js";
import { createPendingItemsWithDyeingJobs } from "@/lib/customer-orders/pending-dyeing";
import { findOrCreateShade } from "@/lib/customer-orders/queries";
import type { CustomerOrderLineUnit } from "@/lib/customer-orders/types";
import { buildAllShadeBalances, deriveOnHandByShade } from "./balance";
import { checkReplenishmentForShades } from "./dyeing-suggestions";
import {
  createMovement,
  getEllfa270ItemId,
  getMovementByOrderLineId,
  listMovementsForItem,
  listShadesForItem,
  reversePackStockOut,
} from "./queries";
import type { PackOrderLineInput } from "./types";
import { ELLFA_270_UNIT } from "./types";

export type PackOrderResult = {
  stockOutCount: number;
  missingCount: number;
  autoDyeingJobs: number;
};

export async function packOrderWithFulfillment(
  supabase: SupabaseClient,
  orderId: string,
  lines: PackOrderLineInput[],
  createdBy: string,
): Promise<PackOrderResult> {
  const { data: order, error: orderError } = await supabase
    .from("customer_orders")
    .select("id, customer_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error("Order not found");
  if (order.status === "invoiced" || order.status === "cancelled") {
    throw new Error("Cannot pack an invoiced or cancelled order");
  }

  const ellfaItemId = await getEllfa270ItemId(supabase);

  let stockOutCount = 0;
  let missingCount = 0;
  const affectedShadeIds: string[] = [];
  const missingItems: Array<{
    customerId: string;
    orderId: string;
    priceListItemId: string;
    shadeId: string;
    shadeCode: string;
    qty: number;
    unit: CustomerOrderLineUnit;
    isUrgent: boolean;
  }> = [];

  const { data: orderLines, error: linesError } = await supabase
    .from("customer_order_lines")
    .select("*")
    .eq("order_id", orderId);
  if (linesError) throw linesError;

  const lineMap = new Map(
    (orderLines ?? []).map((l) => [l.id as string, l]),
  );

  for (const input of lines) {
    const line = lineMap.get(input.lineId);
    if (!line) throw new Error(`Order line ${input.lineId} not found`);

    const orderedQty = Number(line.qty);
    const fulfilledQty = Math.max(
      0,
      Math.min(input.fulfilledQty, orderedQty),
    );

    await supabase
      .from("customer_order_lines")
      .update({ fulfilled_qty: fulfilledQty })
      .eq("id", input.lineId);

    const priceListItemId = line.price_list_item_id as string | null;
    const shadeCode = String(line.shade_code ?? "").trim();
    const unit = (line.unit as CustomerOrderLineUnit) ?? ELLFA_270_UNIT;

    if (!priceListItemId || !shadeCode) continue;
    if (priceListItemId !== ellfaItemId || unit !== ELLFA_270_UNIT) continue;

    const existingOut = await getMovementByOrderLineId(supabase, input.lineId);
    if (existingOut) {
      await reversePackStockOut(supabase, input.lineId, createdBy);
    }

    if (fulfilledQty > 0) {
      let shadeId = line.shade_id as string | null;
      if (!shadeId) {
        const shade = await findOrCreateShade(supabase, {
          priceListItemId,
          shadeCode,
        });
        shadeId = shade.id;
      }

      await createMovement(supabase, {
        movementType: "stock_out",
        priceListItemId,
        shadeId,
        shadeCode,
        quantity: fulfilledQty,
        orderId,
        orderLineId: input.lineId,
        notes: `Packed for order ${orderId}`,
        createdBy,
        unit,
      });
      stockOutCount += 1;
      affectedShadeIds.push(shadeId);

      const shortfall = orderedQty - fulfilledQty;
      if (shortfall > 0) {
        missingCount += 1;
        missingItems.push({
          customerId: order.customer_id as string,
          orderId,
          priceListItemId,
          shadeId,
          shadeCode,
          qty: shortfall,
          unit,
          isUrgent: false,
        });
      }
    } else if (orderedQty > 0) {
      let shadeId = line.shade_id as string | null;
      if (!shadeId && shadeCode) {
        const shade = await findOrCreateShade(supabase, {
          priceListItemId,
          shadeCode,
        });
        shadeId = shade.id;
      }
      if (shadeId) {
        missingCount += 1;
        missingItems.push({
          customerId: order.customer_id as string,
          orderId,
          priceListItemId,
          shadeId,
          shadeCode,
          qty: orderedQty,
          unit,
          isUrgent: false,
        });
      }
    }
  }

  const updatedMovements = await listMovementsForItem(supabase, ellfaItemId);
  const shades = await listShadesForItem(supabase, ellfaItemId);
  const allBalances = buildAllShadeBalances(
    shades.map((s) => ({
      id: s.id,
      shadeCode: s.shadeCode,
      cardColumn: s.cardColumn,
      cardRow: s.cardRow,
      colorHex: s.colorHex,
      minStockThreshold: s.minStockThreshold,
      targetStockLevel: s.targetStockLevel,
    })),
    updatedMovements,
  );

  if (missingItems.length > 0) {
    const shadeTiers = new Map(
      allBalances.map((b) => [b.shadeId, b.velocityTier]),
    );
    await createPendingItemsWithDyeingJobs(
      supabase,
      missingItems.map((item) => ({
        customerId: item.customerId,
        orderId: item.orderId,
        priceListItemId: item.priceListItemId,
        shadeId: item.shadeId,
        shadeCode: item.shadeCode,
        qty: item.qty,
        unit: item.unit,
        isUrgent: shadeTiers.get(item.shadeId) === "fast",
        notes: "Missing at packing",
      })),
      createdBy,
    );
  }

  const shadeBalances = allBalances
    .filter((b) => affectedShadeIds.includes(b.shadeId))
    .map((b) => ({
      shadeId: b.shadeId,
      shadeCode: b.shadeCode,
      onHand: b.onHand,
      minStockThreshold: b.minStockThreshold,
      targetStockLevel: b.targetStockLevel,
      velocityTier: b.velocityTier,
    }));

  const autoDyeingJobs = await checkReplenishmentForShades(
    supabase,
    ellfaItemId,
    shadeBalances,
    createdBy,
  );

  return { stockOutCount, missingCount, autoDyeingJobs };
}

export async function unpackOrder(
  supabase: SupabaseClient,
  orderId: string,
  createdBy: string,
): Promise<void> {
  const { data: lines, error } = await supabase
    .from("customer_order_lines")
    .select("id")
    .eq("order_id", orderId);
  if (error) throw error;

  for (const line of lines ?? []) {
    await reversePackStockOut(supabase, line.id as string, createdBy);
    await supabase
      .from("customer_order_lines")
      .update({ fulfilled_qty: null })
      .eq("id", line.id);
  }
}

export async function getAvailableStockForLines(
  supabase: SupabaseClient,
  lineIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (lineIds.length === 0) return result;

  const ellfaItemId = await getEllfa270ItemId(supabase);
  const movements = await listMovementsForItem(supabase, ellfaItemId);
  const onHandMap = deriveOnHandByShade(movements);

  const { data: lines, error } = await supabase
    .from("customer_order_lines")
    .select("id, shade_id, price_list_item_id, unit")
    .in("id", lineIds);
  if (error) throw error;

  for (const line of lines ?? []) {
    if (
      line.price_list_item_id === ellfaItemId &&
      line.unit === ELLFA_270_UNIT &&
      line.shade_id
    ) {
      result.set(
        line.id as string,
        onHandMap.get(line.shade_id as string) ?? 0,
      );
    } else {
      result.set(line.id as string, 0);
    }
  }

  return result;
}
