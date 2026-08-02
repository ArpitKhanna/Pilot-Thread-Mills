import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapMovementRow,
  mapSupplierRow,
  type DbMovementRow,
  type DbSupplierRow,
} from "./mappers";
import type { RawStockMovement, RawStockSupplier } from "./types";

const MOVEMENT_SELECT = `
  *,
  raw_stock_suppliers ( name )
`;

export async function listSuppliers(
  supabase: SupabaseClient,
): Promise<RawStockSupplier[]> {
  const { data, error } = await supabase
    .from("raw_stock_suppliers")
    .select("*")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as DbSupplierRow[]).map(mapSupplierRow);
}

export async function listMovements(
  supabase: SupabaseClient,
): Promise<RawStockMovement[]> {
  const { data, error } = await supabase
    .from("raw_stock_movements")
    .select(MOVEMENT_SELECT)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbMovementRow[]).map(mapMovementRow);
}

export type CreateSupplierInput = {
  name: string;
  isActive?: boolean;
};

export async function createSupplier(
  supabase: SupabaseClient,
  input: CreateSupplierInput,
): Promise<RawStockSupplier> {
  const { data, error } = await supabase
    .from("raw_stock_suppliers")
    .insert({
      name: input.name.trim(),
      is_active: input.isActive ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapSupplierRow(data as DbSupplierRow);
}

export type UpdateSupplierInput = {
  name?: string;
  isActive?: boolean;
};

export async function updateSupplier(
  supabase: SupabaseClient,
  id: string,
  input: UpdateSupplierInput,
): Promise<RawStockSupplier> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await supabase
    .from("raw_stock_suppliers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapSupplierRow(data as DbSupplierRow);
}

export type CreateMovementInput = {
  movementType: RawStockMovement["movementType"];
  category: RawStockMovement["category"];
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId?: string | null;
  notes?: string | null;
  createdBy: string;
};

export async function createMovement(
  supabase: SupabaseClient,
  input: CreateMovementInput,
): Promise<RawStockMovement> {
  const { data, error } = await supabase
    .from("raw_stock_movements")
    .insert({
      movement_type: input.movementType,
      category: input.category,
      count_label: input.countLabel.trim(),
      quantity_kg: input.quantityKg,
      movement_date: input.movementDate,
      supplier_id: input.supplierId ?? null,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy,
    })
    .select(MOVEMENT_SELECT)
    .single();
  if (error) throw error;
  return mapMovementRow(data as DbMovementRow);
}
