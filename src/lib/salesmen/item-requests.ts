import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemRequest, ItemRequestStatus } from "./types";

export type DbItemRequestRow = {
  id: string;
  salesman_id: string;
  item_name: string;
  price_list_item_id: string | null;
  qty: number | string;
  requested_at: string;
  notes: string | null;
  status: ItemRequestStatus;
  fulfilled_at: string | null;
};

function num(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function mapItemRequestRow(row: DbItemRequestRow): ItemRequest {
  return {
    id: row.id,
    salesmanId: row.salesman_id,
    itemName: row.item_name,
    priceListItemId: row.price_list_item_id ?? undefined,
    qty: num(row.qty),
    requestedAt: row.requested_at,
    notes: row.notes ?? undefined,
    status: row.status,
    fulfilledAt: row.fulfilled_at,
  };
}

export async function listItemRequestsForSalesman(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<ItemRequest[]> {
  const { data, error } = await supabase
    .from("salesmen_item_requests")
    .select("*")
    .eq("salesman_id", salesmanId)
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbItemRequestRow[]).map(mapItemRequestRow);
}

export type CreateItemRequestInput = {
  itemName: string;
  priceListItemId?: string;
  qty: number;
  requestedAt: string;
  notes?: string;
};

export async function createItemRequest(
  supabase: SupabaseClient,
  salesmanId: string,
  input: CreateItemRequestInput,
): Promise<ItemRequest> {
  const { data, error } = await supabase
    .from("salesmen_item_requests")
    .insert({
      salesman_id: salesmanId,
      item_name: input.itemName,
      price_list_item_id: input.priceListItemId ?? null,
      qty: input.qty,
      requested_at: input.requestedAt,
      notes: input.notes ?? null,
      status: "open",
      fulfilled_at: null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapItemRequestRow(data as DbItemRequestRow);
}

export async function fulfillItemRequest(
  supabase: SupabaseClient,
  salesmanId: string,
  requestId: string,
): Promise<ItemRequest | null> {
  const { data, error } = await supabase
    .from("salesmen_item_requests")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("salesman_id", salesmanId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapItemRequestRow(data as DbItemRequestRow);
}
