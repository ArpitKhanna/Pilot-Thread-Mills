import type { SupabaseClient } from "@supabase/supabase-js";
import { COUNT_OPTIONS } from "@/lib/auth/types";
import {
  mapMovementRow,
  mapSupplierRow,
  type DbMovementRow,
  type DbSupplierRow,
} from "./mappers";
import type {
  RawStockCustomerOption,
  RawStockMovement,
  RawStockShadeOption,
  RawStockSupplier,
} from "./types";

const MOVEMENT_SELECT = `
  *,
  raw_stock_suppliers ( name ),
  salesmen ( name )
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

export async function listCountOptions(
  supabase: SupabaseClient,
): Promise<string[]> {
  const [{ data: priceCounts }, { data: movementCounts }] = await Promise.all([
    supabase
      .from("price_list_items")
      .select("count_label")
      .not("count_label", "is", null),
    supabase.from("raw_stock_movements").select("count_label"),
  ]);

  const set = new Set<string>(COUNT_OPTIONS);
  for (const row of priceCounts ?? []) {
    const label = (row as { count_label: string | null }).count_label?.trim();
    if (label) set.add(label);
  }
  for (const row of movementCounts ?? []) {
    const label = (row as { count_label: string }).count_label?.trim();
    if (label) set.add(label);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function listCustomerOptions(
  supabase: SupabaseClient,
): Promise<RawStockCustomerOption[]> {
  const { data, error } = await supabase
    .from("salesmen")
    .select("id, name")
    .eq("entity_type", "customer")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string }[]).map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

export async function listShadeOptions(
  supabase: SupabaseClient,
): Promise<RawStockShadeOption[]> {
  const { data, error } = await supabase
    .from("item_shades")
    .select(
      `
      id,
      shade_code,
      color_label,
      price_list_item_id,
      is_active,
      price_list_items ( item_name, count_label )
    `,
    )
    .eq("is_active", true)
    .order("shade_code");
  if (error) throw error;

  type ShadeRow = {
    id: string;
    shade_code: string;
    color_label: string | null;
    price_list_item_id: string;
    price_list_items:
      | { item_name: string; count_label: string | null }
      | { item_name: string; count_label: string | null }[]
      | null;
  };

  return ((data ?? []) as ShadeRow[]).map((row) => {
    const item = Array.isArray(row.price_list_items)
      ? row.price_list_items[0]
      : row.price_list_items;
    return {
      id: row.id,
      shadeCode: row.shade_code,
      colorLabel: row.color_label,
      countLabel: item?.count_label ?? null,
      priceListItemId: row.price_list_item_id,
      itemName: item?.item_name ?? "",
    };
  });
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
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId?: string | null;
  pricePerKg?: number | null;
  shadeId?: string | null;
  shadeCodeText?: string | null;
  colorLabel?: string | null;
  customerId?: string | null;
  relatedMovementId?: string | null;
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
      count_label: input.countLabel.trim(),
      quantity_kg: input.quantityKg,
      movement_date: input.movementDate,
      supplier_id: input.supplierId ?? null,
      price_per_kg: input.pricePerKg ?? null,
      shade_id: input.shadeId ?? null,
      shade_code_text: input.shadeCodeText?.trim() || null,
      color_label: input.colorLabel?.trim() || null,
      customer_id: input.customerId ?? null,
      related_movement_id: input.relatedMovementId ?? null,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy,
    })
    .select(MOVEMENT_SELECT)
    .single();
  if (error) throw error;
  return mapMovementRow(data as DbMovementRow);
}
