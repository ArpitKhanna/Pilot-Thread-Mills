import type { SupabaseClient } from "@supabase/supabase-js";
import { convertOrderToInvoice } from "./convert";
import {
  mapDeliveryRunOrderRow,
  mapDeliveryRunRow,
  type DbDeliveryRunOrderRow,
  type DbDeliveryRunRow,
} from "./mappers";
import { getCustomerOrder, listDeliveryStaff } from "./queries";
import type {
  CustomerOrderStatus,
  DeliveryRun,
  DeliveryRunStatus,
} from "./types";

export async function listDeliveryRuns(
  supabase: SupabaseClient,
  opts?: { limit?: number },
): Promise<DeliveryRun[]> {
  const { data, error } = await supabase
    .from("delivery_runs")
    .select("*")
    .order("run_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (error) throw error;

  const runs = (data ?? []) as DbDeliveryRunRow[];
  if (runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const { data: linkRows, error: linkError } = await supabase
    .from("delivery_run_orders")
    .select("*")
    .in("run_id", runIds)
    .order("sort_order");
  if (linkError) throw linkError;

  const links = (linkRows ?? []) as DbDeliveryRunOrderRow[];
  const orderIds = [...new Set(links.map((l) => l.order_id))];
  const orders = await Promise.all(
    orderIds.map((id) => getCustomerOrder(supabase, id)),
  );
  const orderById = new Map(
    orders.filter(Boolean).map((o) => [o!.id, o!]),
  );

  return runs.map((run) =>
    mapDeliveryRunRow(
      run,
      links
        .filter((l) => l.run_id === run.id)
        .map((l) =>
          mapDeliveryRunOrderRow(l, orderById.get(l.order_id) ?? null),
        ),
    ),
  );
}

export async function getDeliveryRun(
  supabase: SupabaseClient,
  id: string,
): Promise<DeliveryRun | null> {
  const { data, error } = await supabase
    .from("delivery_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: linkRows, error: linkError } = await supabase
    .from("delivery_run_orders")
    .select("*")
    .eq("run_id", id)
    .order("sort_order");
  if (linkError) throw linkError;

  const links = (linkRows ?? []) as DbDeliveryRunOrderRow[];
  const orders = await Promise.all(
    links.map((l) => getCustomerOrder(supabase, l.order_id)),
  );
  const orderById = new Map(
    orders.filter(Boolean).map((o) => [o!.id, o!]),
  );

  return mapDeliveryRunRow(
    data as DbDeliveryRunRow,
    links.map((l) =>
      mapDeliveryRunOrderRow(l, orderById.get(l.order_id) ?? null),
    ),
  );
}

export type CreateDeliveryRunInput = {
  orderIds: string[];
  deliveryBy: string;
  area?: string | null;
  runDate?: string;
  notes?: string | null;
  createdBy: string;
  /** Optional qty overrides: orderId -> lineId -> qty */
  lineQtyOverridesByOrder?: Record<string, Record<string, number>>;
};

export async function createDeliveryRunAndInvoice(
  supabase: SupabaseClient,
  input: CreateDeliveryRunInput,
): Promise<DeliveryRun> {
  if (input.orderIds.length === 0) {
    throw new Error("Select at least one packed order");
  }

  const staff = await listDeliveryStaff(supabase);
  const delivery = staff.find((s) => s.id === input.deliveryBy);
  if (!delivery) throw new Error("Delivery person not found");

  const orders = await Promise.all(
    input.orderIds.map((id) => getCustomerOrder(supabase, id)),
  );
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (!order) throw new Error(`Order not found: ${input.orderIds[i]}`);
    if (order.status !== "packed") {
      throw new Error(
        `Order for ${order.customerName ?? "customer"} must be packed before a delivery run`,
      );
    }
    if (order.invoiceId) {
      throw new Error(
        `Order for ${order.customerName ?? "customer"} is already invoiced`,
      );
    }
  }

  const area =
    input.area?.trim() ||
    orders.find((o) => o?.customerArea)?.customerArea ||
    null;

  const { data: runRow, error: runError } = await supabase
    .from("delivery_runs")
    .insert({
      run_date: input.runDate ?? new Date().toISOString().slice(0, 10),
      area,
      delivery_by: delivery.id,
      delivery_by_name: delivery.fullName,
      status: "open" satisfies DeliveryRunStatus,
      notes: input.notes ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (runError || !runRow) {
    throw new Error(runError?.message ?? "Failed to create delivery run");
  }

  const runId = runRow.id as string;
  const linkInserts: {
    run_id: string;
    order_id: string;
    invoice_id: string | null;
    sort_order: number;
  }[] = [];

  try {
    for (let i = 0; i < input.orderIds.length; i++) {
      const orderId = input.orderIds[i]!;
      const result = await convertOrderToInvoice(supabase, {
        orderId,
        createdBy: input.createdBy,
        deliveryBy: delivery.id,
        lineQtyOverrides: input.lineQtyOverridesByOrder?.[orderId],
      });
      linkInserts.push({
        run_id: runId,
        order_id: orderId,
        invoice_id: result.invoice?.id ?? null,
        sort_order: i,
      });
    }

    const { error: linkError } = await supabase
      .from("delivery_run_orders")
      .insert(linkInserts);
    if (linkError) throw linkError;
  } catch (e) {
    await supabase.from("delivery_runs").delete().eq("id", runId);
    throw e;
  }

  const run = await getDeliveryRun(supabase, runId);
  if (!run) throw new Error("Delivery run not found after create");
  return run;
}

/** Bump linked delivery run(s) when an order moves to out_for_delivery / delivered. */
export async function syncDeliveryRunsForOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  status: CustomerOrderStatus,
): Promise<void> {
  if (status !== "out_for_delivery" && status !== "delivered") return;

  const { data: links, error: linkError } = await supabase
    .from("delivery_run_orders")
    .select("run_id")
    .eq("order_id", orderId);
  if (linkError) throw linkError;
  if (!links?.length) return;

  const runIds = [...new Set(links.map((l) => l.run_id as string))];

  for (const runId of runIds) {
    if (status === "out_for_delivery") {
      await supabase
        .from("delivery_runs")
        .update({ status: "dispatched" satisfies DeliveryRunStatus })
        .eq("id", runId)
        .in("status", ["open"]);
      continue;
    }

    const { data: runLinks, error: runLinkError } = await supabase
      .from("delivery_run_orders")
      .select("order_id")
      .eq("run_id", runId);
    if (runLinkError) throw runLinkError;

    const siblingIds = (runLinks ?? []).map((l) => l.order_id as string);
    const siblings = await Promise.all(
      siblingIds.map((id) => getCustomerOrder(supabase, id)),
    );
    const allDelivered = siblings.every((o) => o?.status === "delivered");
    await supabase
      .from("delivery_runs")
      .update({
        status: (allDelivered ? "done" : "dispatched") satisfies DeliveryRunStatus,
      })
      .eq("id", runId);
  }
}
