import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapClothPatchRow,
  type DbClothPatchRow,
} from "./mappers";
import {
  CUSTOMER_ORDER_FILES_BUCKET,
  createSignedUrl,
  findOrCreateShade,
} from "./queries";
import type { CustomerClothPatch } from "./types";

const PATCH_SELECT = `
  *,
  price_list_items:price_list_item_id ( item_name )
`;

export async function listClothPatchesForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerClothPatch[]> {
  const { data, error } = await supabase
    .from("customer_cloth_patches")
    .select(PATCH_SELECT)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as DbClothPatchRow[];
  return Promise.all(
    rows.map(async (row) =>
      mapClothPatchRow(row, await createSignedUrl(supabase, row.storage_path)),
    ),
  );
}

export async function createClothPatch(
  supabase: SupabaseClient,
  input: {
    customerId: string;
    storagePath: string;
    fileName?: string | null;
    contentType?: string | null;
    priceListItemId?: string | null;
    notes?: string | null;
    createdBy?: string | null;
  },
): Promise<CustomerClothPatch> {
  const { data, error } = await supabase
    .from("customer_cloth_patches")
    .insert({
      customer_id: input.customerId,
      storage_path: input.storagePath,
      file_name: input.fileName ?? null,
      content_type: input.contentType ?? null,
      price_list_item_id: input.priceListItemId ?? null,
      status: "awaiting_shade",
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(PATCH_SELECT)
    .single();
  if (error) throw error;
  const row = data as DbClothPatchRow;
  return mapClothPatchRow(
    row,
    await createSignedUrl(supabase, row.storage_path),
  );
}

export async function assignShadeToClothPatch(
  supabase: SupabaseClient,
  input: {
    patchId: string;
    shadeCode: string;
    priceListItemId?: string | null;
    notes?: string | null;
  },
): Promise<CustomerClothPatch> {
  const { data: existing, error: findError } = await supabase
    .from("customer_cloth_patches")
    .select("*")
    .eq("id", input.patchId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error("Cloth patch not found");

  const priceListItemId =
    input.priceListItemId ??
    (existing as DbClothPatchRow).price_list_item_id;
  if (!priceListItemId) {
    throw new Error("Select an item before assigning a shade number");
  }

  const shade = await findOrCreateShade(supabase, {
    priceListItemId,
    shadeCode: input.shadeCode,
    patchStoragePath: (existing as DbClothPatchRow).storage_path,
  });

  const { data, error } = await supabase
    .from("customer_cloth_patches")
    .update({
      price_list_item_id: priceListItemId,
      shade_id: shade.id,
      shade_code: shade.shadeCode,
      status: "assigned",
      notes:
        input.notes !== undefined
          ? input.notes
          : (existing as DbClothPatchRow).notes,
    })
    .eq("id", input.patchId)
    .select(PATCH_SELECT)
    .single();
  if (error) throw error;

  const row = data as DbClothPatchRow;
  return mapClothPatchRow(
    row,
    await createSignedUrl(supabase, row.storage_path),
  );
}

export async function deleteClothPatch(
  supabase: SupabaseClient,
  patchId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("customer_cloth_patches")
    .select("*")
    .eq("id", patchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;

  const row = data as DbClothPatchRow;
  const { error: deleteError } = await supabase
    .from("customer_cloth_patches")
    .delete()
    .eq("id", patchId);
  if (deleteError) throw deleteError;

  await supabase.storage
    .from(CUSTOMER_ORDER_FILES_BUCKET)
    .remove([row.storage_path]);
}
