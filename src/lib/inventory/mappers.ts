import type {
  FinishedStockMovement,
  FinishedStockMovementType,
  InventoryShade,
} from "./types";
import type { CustomerOrderLineUnit } from "@/lib/customer-orders/types";

export type DbInventoryShadeRow = {
  id: string;
  price_list_item_id: string;
  shade_code: string;
  color_label: string | null;
  color_hex: string | null;
  card_column: number | null;
  card_row: number | null;
  min_stock_threshold: number | null;
  target_stock_level: number | null;
  is_active: boolean;
};

export type DbFinishedStockMovementRow = {
  id: string;
  movement_type: FinishedStockMovementType;
  price_list_item_id: string;
  shade_id: string;
  shade_code: string;
  unit: CustomerOrderLineUnit;
  quantity: number | string;
  movement_date: string;
  order_id: string | null;
  order_line_id: string | null;
  dyeing_job_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  price_list_items?: { item_name: string } | { item_name: string }[] | null;
};

export function mapInventoryShadeRow(row: DbInventoryShadeRow): InventoryShade {
  return {
    id: row.id,
    priceListItemId: row.price_list_item_id,
    shadeCode: row.shade_code,
    colorLabel: row.color_label,
    colorHex: row.color_hex,
    cardColumn: row.card_column,
    cardRow: row.card_row,
    minStockThreshold: row.min_stock_threshold,
    targetStockLevel: row.target_stock_level,
    isActive: row.is_active,
  };
}

export function mapFinishedStockMovementRow(
  row: DbFinishedStockMovementRow,
): FinishedStockMovement {
  const itemJoin = row.price_list_items;
  const itemName = Array.isArray(itemJoin)
    ? itemJoin[0]?.item_name
    : itemJoin?.item_name;

  return {
    id: row.id,
    movementType: row.movement_type,
    priceListItemId: row.price_list_item_id,
    shadeId: row.shade_id,
    shadeCode: row.shade_code,
    unit: row.unit,
    quantity: Number(row.quantity),
    movementDate: row.movement_date,
    orderId: row.order_id,
    orderLineId: row.order_line_id,
    dyeingJobId: row.dyeing_job_id,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    itemName: itemName ?? null,
  };
}
