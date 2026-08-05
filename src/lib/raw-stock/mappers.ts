import type {
  RawStockCategory,
  RawStockMovement,
  RawStockMovementType,
  RawStockSupplier,
} from "./types";
import { isRawStockCategory } from "./types";

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
  category: string;
  count_label: string;
  quantity_kg: number | string;
  movement_date: string;
  supplier_id: string | null;
  do_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  raw_stock_suppliers?: { name: string } | null;
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
  const category: RawStockCategory = isRawStockCategory(row.category)
    ? row.category
    : "hank";

  return {
    id: row.id,
    movementType: row.movement_type,
    category,
    countLabel: row.count_label,
    quantityKg: Number(row.quantity_kg),
    movementDate: row.movement_date,
    supplierId: row.supplier_id,
    supplierName: row.raw_stock_suppliers?.name ?? null,
    doNumber: row.do_number?.trim() ? row.do_number.trim() : null,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
