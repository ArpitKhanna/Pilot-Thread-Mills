import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrderEvent,
  type CustomerOrderEventKind,
  type CustomerOrderStatus,
} from "@/lib/customer-orders/types";

type DbEventRow = {
  id: string;
  order_id: string;
  kind: string;
  message: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
};

async function resolveActorName(
  supabase: SupabaseClient,
  actorId: string | null | undefined,
): Promise<string | null> {
  if (!actorId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", actorId)
    .maybeSingle();
  const name = String(data?.full_name ?? "").trim();
  return name || null;
}

export async function logCustomerOrderEvent(
  supabase: SupabaseClient,
  input: {
    orderId: string;
    kind: CustomerOrderEventKind;
    message: string;
    actorId?: string | null;
    fromStatus?: CustomerOrderStatus | null;
    toStatus?: CustomerOrderStatus | null;
  },
): Promise<void> {
  const actorName = await resolveActorName(supabase, input.actorId);
  const { error } = await supabase.from("customer_order_events").insert({
    order_id: input.orderId,
    kind: input.kind,
    message: input.message,
    actor_id: input.actorId ?? null,
    actor_name: actorName,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
  });
  if (error) {
    console.error("Failed to log customer order event", error);
  }
}

export async function listCustomerOrderEvents(
  supabase: SupabaseClient,
  orderId: string,
): Promise<CustomerOrderEvent[]> {
  const { data, error } = await supabase
    .from("customer_order_events")
    .select(
      "id, order_id, kind, message, from_status, to_status, actor_id, actor_name, created_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as DbEventRow[]).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    kind: row.kind as CustomerOrderEventKind,
    message: row.message,
    fromStatus: (row.from_status as CustomerOrderStatus | null) ?? null,
    toStatus: (row.to_status as CustomerOrderStatus | null) ?? null,
    actorId: row.actor_id,
    actorName: row.actor_name?.trim() || null,
    createdAt: row.created_at,
  }));
}

export function statusChangeMessage(
  from: CustomerOrderStatus | null | undefined,
  to: CustomerOrderStatus,
): string {
  const toLabel = CUSTOMER_ORDER_STATUS_LABELS[to] ?? to;
  if (!from) return `Moved to ${toLabel}.`;
  const fromLabel = CUSTOMER_ORDER_STATUS_LABELS[from] ?? from;
  return `Moved from ${fromLabel} to ${toLabel}.`;
}
