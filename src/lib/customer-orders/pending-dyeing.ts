import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapDyeingJobRow,
  mapPendingItemRow,
  type DbDyeingJobRow,
  type DbPendingItemRow,
} from "./mappers";
import { findOrCreateShade } from "./queries";
import type {
  CustomerOrderLineUnit,
  CustomerPendingItem,
  CustomerPendingItemStatus,
  DyeingJob,
  DyeingJobStatus,
} from "./types";

const PENDING_SELECT = `
  *,
  salesmen:customer_id ( name ),
  price_list_items:price_list_item_id ( item_name )
`;

const DYEING_SELECT = `
  *,
  salesmen:customer_id ( name ),
  price_list_items:price_list_item_id ( item_name )
`;

export async function listPendingItemsForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerPendingItem[]> {
  const { data, error } = await supabase
    .from("customer_pending_items")
    .select(PENDING_SELECT)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbPendingItemRow[]).map(mapPendingItemRow);
}

export async function listOpenPendingItems(
  supabase: SupabaseClient,
): Promise<CustomerPendingItem[]> {
  const { data, error } = await supabase
    .from("customer_pending_items")
    .select(PENDING_SELECT)
    .in("status", ["open", "in_dyeing", "ready"])
    .order("is_urgent", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbPendingItemRow[]).map(mapPendingItemRow);
}

export type PendingItemInput = {
  customerId: string;
  invoiceId?: string | null;
  invoiceDate?: string | null;
  orderId?: string | null;
  priceListItemId?: string | null;
  shadeId?: string | null;
  shadeCode: string;
  qty: number;
  unit?: CustomerOrderLineUnit;
  isUrgent?: boolean;
  notes?: string | null;
};

export async function createPendingItemsWithDyeingJobs(
  supabase: SupabaseClient,
  items: PendingItemInput[],
  createdBy: string,
): Promise<{ pending: CustomerPendingItem[]; jobs: DyeingJob[] }> {
  if (items.length === 0) {
    throw new Error("Add at least one missing item");
  }

  const pending: CustomerPendingItem[] = [];
  const jobs: DyeingJob[] = [];

  for (const item of items) {
    const shadeCode = item.shadeCode.trim();
    if (!shadeCode || !(item.qty > 0)) {
      throw new Error("Each missing item needs shade code and qty > 0");
    }

    let shadeId = item.shadeId ?? null;
    if (item.priceListItemId && shadeCode) {
      const shade = await findOrCreateShade(supabase, {
        priceListItemId: item.priceListItemId,
        shadeCode,
      });
      shadeId = shade.id;
    }

    const { data: pendingRow, error: pendingError } = await supabase
      .from("customer_pending_items")
      .insert({
        customer_id: item.customerId,
        invoice_id: item.invoiceId ?? null,
        invoice_date:
          item.invoiceDate ?? new Date().toISOString().slice(0, 10),
        order_id: item.orderId ?? null,
        price_list_item_id: item.priceListItemId ?? null,
        shade_id: shadeId,
        shade_code: shadeCode.toUpperCase().replace(/\s+/g, ""),
        qty: item.qty,
        unit: item.unit ?? "box",
        status: "in_dyeing" satisfies CustomerPendingItemStatus,
        is_urgent: Boolean(item.isUrgent),
        notes: item.notes ?? null,
        created_by: createdBy,
      })
      .select(PENDING_SELECT)
      .single();
    if (pendingError || !pendingRow) {
      throw new Error(pendingError?.message ?? "Failed to save pending item");
    }

    const mappedPending = mapPendingItemRow(pendingRow as DbPendingItemRow);
    pending.push(mappedPending);

    const { data: jobRow, error: jobError } = await supabase
      .from("dyeing_jobs")
      .insert({
        customer_id: item.customerId,
        pending_item_id: mappedPending.id,
        price_list_item_id: item.priceListItemId ?? null,
        shade_id: shadeId,
        shade_code: mappedPending.shadeCode,
        qty: item.qty,
        unit: item.unit ?? "box",
        status: "queued" satisfies DyeingJobStatus,
        is_urgent: Boolean(item.isUrgent),
        notes: item.notes ?? null,
        created_by: createdBy,
      })
      .select(DYEING_SELECT)
      .single();
    if (jobError || !jobRow) {
      throw new Error(jobError?.message ?? "Failed to create dyeing job");
    }
    jobs.push(mapDyeingJobRow(jobRow as DbDyeingJobRow));
  }

  return { pending, jobs };
}

export async function updatePendingItemStatus(
  supabase: SupabaseClient,
  id: string,
  status: CustomerPendingItemStatus,
): Promise<CustomerPendingItem> {
  const { data, error } = await supabase
    .from("customer_pending_items")
    .update({ status })
    .eq("id", id)
    .select(PENDING_SELECT)
    .single();
  if (error) throw error;
  return mapPendingItemRow(data as DbPendingItemRow);
}

export type UpdatePendingItemInput = {
  priceListItemId?: string | null;
  shadeCode?: string;
  qty?: number;
  unit?: CustomerOrderLineUnit;
  isUrgent?: boolean;
  notes?: string | null;
  status?: CustomerPendingItemStatus;
};

export async function updatePendingItem(
  supabase: SupabaseClient,
  id: string,
  input: UpdatePendingItemInput,
): Promise<CustomerPendingItem> {
  const { data: existing, error: findError } = await supabase
    .from("customer_pending_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error("Missing item not found");

  const updates: Record<string, unknown> = {};
  const priceListItemId =
    input.priceListItemId !== undefined
      ? input.priceListItemId
      : (existing.price_list_item_id as string | null);
  const shadeCode =
    input.shadeCode !== undefined
      ? input.shadeCode.trim()
      : String(existing.shade_code ?? "");

  if (input.shadeCode !== undefined || input.priceListItemId !== undefined) {
    if (!shadeCode) throw new Error("Shade code is required");
    updates.shade_code = shadeCode.toUpperCase().replace(/\s+/g, "");
    updates.price_list_item_id = priceListItemId;
    if (priceListItemId && shadeCode) {
      const shade = await findOrCreateShade(supabase, {
        priceListItemId,
        shadeCode,
      });
      updates.shade_id = shade.id;
    } else {
      updates.shade_id = null;
    }
  }
  if (input.qty !== undefined) {
    if (!(input.qty > 0)) throw new Error("Qty must be greater than 0");
    updates.qty = input.qty;
  }
  if (input.unit !== undefined) updates.unit = input.unit;
  if (input.isUrgent !== undefined) updates.is_urgent = input.isUrgent;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.status !== undefined) updates.status = input.status;

  if (Object.keys(updates).length === 0) {
    return mapPendingItemRow(existing as DbPendingItemRow);
  }

  const { data, error } = await supabase
    .from("customer_pending_items")
    .update(updates)
    .eq("id", id)
    .select(PENDING_SELECT)
    .single();
  if (error) throw error;

  const pending = mapPendingItemRow(data as DbPendingItemRow);

  const jobUpdates: Record<string, unknown> = {};
  if (updates.shade_code !== undefined) {
    jobUpdates.shade_code = updates.shade_code;
  }
  if (updates.shade_id !== undefined) jobUpdates.shade_id = updates.shade_id;
  if (updates.price_list_item_id !== undefined) {
    jobUpdates.price_list_item_id = updates.price_list_item_id;
  }
  if (updates.qty !== undefined) jobUpdates.qty = updates.qty;
  if (updates.unit !== undefined) jobUpdates.unit = updates.unit;
  if (updates.is_urgent !== undefined) jobUpdates.is_urgent = updates.is_urgent;
  if (input.status === "cancelled") jobUpdates.status = "cancelled";
  if (input.status === "ready") jobUpdates.status = "done";

  if (Object.keys(jobUpdates).length > 0) {
    await supabase
      .from("dyeing_jobs")
      .update(jobUpdates)
      .eq("pending_item_id", id);
  }

  return pending;
}

export async function deletePendingItem(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from("customer_pending_items")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error("Missing item not found");

  await supabase.from("dyeing_jobs").delete().eq("pending_item_id", id);

  const { error } = await supabase
    .from("customer_pending_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listDyeingJobs(
  supabase: SupabaseClient,
  opts?: { status?: DyeingJobStatus | DyeingJobStatus[] },
): Promise<DyeingJob[]> {
  let query = supabase
    .from("dyeing_jobs")
    .select(DYEING_SELECT)
    .order("is_urgent", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts?.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    query = query.in("status", statuses);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as DbDyeingJobRow[]).map(mapDyeingJobRow);
}

export async function updateDyeingJobStatus(
  supabase: SupabaseClient,
  id: string,
  status: DyeingJobStatus,
): Promise<DyeingJob> {
  const { data: existing, error: findError } = await supabase
    .from("dyeing_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error("Dyeing job not found");

  const { data, error } = await supabase
    .from("dyeing_jobs")
    .update({ status })
    .eq("id", id)
    .select(DYEING_SELECT)
    .single();
  if (error) throw error;

  const job = mapDyeingJobRow(data as DbDyeingJobRow);

  if (status === "done" && job.pendingItemId) {
    await updatePendingItemStatus(supabase, job.pendingItemId, "ready");
  } else if (status === "dyeing" && job.pendingItemId) {
    await updatePendingItemStatus(supabase, job.pendingItemId, "in_dyeing");
  } else if (status === "cancelled" && job.pendingItemId) {
    await updatePendingItemStatus(supabase, job.pendingItemId, "cancelled");
  }

  return job;
}

export function buildMissingItemsWhatsAppUrl(opts: {
  customerName: string;
  phone?: string | null;
  items: Array<{
    itemName?: string | null;
    shadeCode: string;
    qty: number;
    unit: string;
  }>;
  invoiceDate?: string | null;
}): string {
  const lines = [
    `Hi ${opts.customerName.trim() || "there"},`,
    "",
    opts.invoiceDate
      ? `A few shades from your order (${opts.invoiceDate}) were not available today:`
      : "A few shades from your order were not available today:",
    "",
  ];

  for (const item of opts.items) {
    const name = item.itemName?.trim() || "Item";
    lines.push(
      `• ${name} — ${item.shadeCode} × ${item.qty} ${item.unit}`,
    );
  }

  lines.push("", "We'll dye/deliver these promptly. Thank you!");

  const text = lines.join("\n");
  const target = (opts.phone ?? "").replace(/\D/g, "");
  if (target) {
    return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
