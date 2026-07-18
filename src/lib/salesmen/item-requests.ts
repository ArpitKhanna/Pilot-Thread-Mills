import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ItemRequest,
  ItemRequestStatus,
  ItemRequestUrgency,
} from "./types";

export type DbItemRequestRow = {
  id: string;
  salesman_id: string;
  item_name: string;
  item_type: string | null;
  price_list_item_id: string | null;
  qty: number | string;
  urgency: ItemRequestUrgency;
  requested_at: string;
  notes: string | null;
  status: ItemRequestStatus;
  fulfilled_at: string | null;
};

function num(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function parseUrgency(value: string | null | undefined): ItemRequestUrgency {
  if (value === "high" || value === "low" || value === "medium") return value;
  return "medium";
}

export function mapItemRequestRow(row: DbItemRequestRow): ItemRequest {
  return {
    id: row.id,
    salesmanId: row.salesman_id,
    itemName: row.item_name,
    itemType: row.item_type ?? undefined,
    priceListItemId: row.price_list_item_id ?? undefined,
    qty: num(row.qty),
    urgency: parseUrgency(row.urgency),
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
  itemType?: string;
  priceListItemId?: string;
  qty: number;
  urgency: ItemRequestUrgency;
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
      item_type: input.itemType ?? null,
      price_list_item_id: input.priceListItemId ?? null,
      qty: input.qty,
      urgency: input.urgency,
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

/** Calendar days from request to fulfillment (0 = same day). */
export function daysToFulfill(
  requestedAt: string,
  fulfilledAt: string,
): number {
  const start = new Date(requestedAt);
  const end = new Date(fulfilledAt);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
  );
}
