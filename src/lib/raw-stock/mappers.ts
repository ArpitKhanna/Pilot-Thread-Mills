import type { RawStockMovement, RawStockMovementType, RawStockSupplier } from "./types";

export type DbSupplierRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DbMovementRow = {
  id: string;
  movement_type: RawStockMovementType;
  count_label: string;
  quantity_kg: number | string;
  movement_date: string;
  supplier_id: string | null;
  price_per_kg: number | string | null;
  shade_id: string | null;
  shade_code_text: string | null;
  color_label: string | null;
  customer_id: string | null;
  related_movement_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  raw_stock_suppliers?: { name: string } | null;
  salesmen?: { name: string } | null;
};

export function mapSupplierRow(row: DbSupplierRow): RawStockSupplier {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMovementRow(row: DbMovementRow): RawStockMovement {
  return {
    id: row.id,
    movementType: row.movement_type,
    countLabel: row.count_label,
    quantityKg: Number(row.quantity_kg),
    movementDate: row.movement_date,
    supplierId: row.supplier_id,
    supplierName: row.raw_stock_suppliers?.name ?? null,
    pricePerKg:
      row.price_per_kg == null || row.price_per_kg === ""
        ? null
        : Number(row.price_per_kg),
    shadeId: row.shade_id,
    shadeCodeText: row.shade_code_text,
    colorLabel: row.color_label,
    customerId: row.customer_id,
    customerName: row.salesmen?.name ?? null,
    relatedMovementId: row.related_movement_id,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
