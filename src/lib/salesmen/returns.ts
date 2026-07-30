import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapReturnRow,
  type DbReturnLineRow,
  type DbReturnRow,
} from "./mappers";
import { parseBusinessReceivedAt } from "./record-window";
import { canMutateWithinWindow } from "./record-window";
import type { InvoiceLineItem, SalesmanReturn } from "./types";
import { refreshSalesmanTotals } from "./queries";
import type { VerificationInsert } from "./verification";

export { buildAutoAppliedReturnItems } from "./return-apply";

export async function listReturnsForSalesman(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<SalesmanReturn[]> {
  const { data, error } = await supabase
    .from("salesmen_returns")
    .select("*")
    .eq("salesman_id", salesmanId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DbReturnRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: lineRows, error: linesError } = await supabase
    .from("salesmen_return_lines")
    .select("*")
    .in("return_id", ids)
    .order("sort_order", { ascending: true });
  if (linesError) throw linesError;

  const linesByReturn = new Map<string, DbReturnLineRow[]>();
  for (const line of (lineRows ?? []) as DbReturnLineRow[]) {
    const list = linesByReturn.get(line.return_id) ?? [];
    list.push(line);
    linesByReturn.set(line.return_id, list);
  }

  return rows.map((row) =>
    mapReturnRow(row, linesByReturn.get(row.id) ?? []),
  );
}

export async function listOpenReturnsForSalesman(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<SalesmanReturn[]> {
  const all = await listReturnsForSalesman(supabase, salesmanId);
  return all
    .filter(
      (r) =>
        r.status === "active" &&
        r.verificationStatus === "verified" &&
        r.remainingAmount > 0,
    )
    .sort(
      (a, b) =>
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
    );
}

export type PendingReturnApproval = {
  returnRecord: SalesmanReturn;
  salesmanName: string;
  salesmanId: string;
};

export async function listPendingReturnApprovals(
  supabase: SupabaseClient,
): Promise<PendingReturnApproval[]> {
  const { data, error } = await supabase
    .from("salesmen_returns")
    .select("*")
    .eq("verification_status", "pending_verification")
    .eq("status", "active")
    .order("received_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DbReturnRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: lineRows, error: linesError } = await supabase
    .from("salesmen_return_lines")
    .select("*")
    .in("return_id", ids)
    .order("sort_order", { ascending: true });
  if (linesError) throw linesError;

  const linesByReturn = new Map<string, DbReturnLineRow[]>();
  for (const line of (lineRows ?? []) as DbReturnLineRow[]) {
    const list = linesByReturn.get(line.return_id) ?? [];
    list.push(line);
    linesByReturn.set(line.return_id, list);
  }

  const returns = rows.map((row) =>
    mapReturnRow(row, linesByReturn.get(row.id) ?? []),
  );
  const salesmanIds = [...new Set(returns.map((r) => r.salesmanId))];
  const { data: salesmenRows, error: salesmenError } = await supabase
    .from("salesmen")
    .select("id, name")
    .in("id", salesmanIds);
  if (salesmenError) throw salesmenError;

  const nameById = new Map(
    (salesmenRows ?? []).map((s) => [s.id as string, s.name as string]),
  );

  return returns.map((returnRecord) => ({
    returnRecord,
    salesmanId: returnRecord.salesmanId,
    salesmanName: nameById.get(returnRecord.salesmanId) ?? "Unknown",
  }));
}

export type ReturnWriteInput = {
  lineItems: InvoiceLineItem[];
  notes?: string;
  receivedAt?: string;
};

export function validateReturnPayload(
  body: Record<string, unknown>,
): { data: ReturnWriteInput } | { error: string } {
  const rawLines = Array.isArray(body.lineItems) ? body.lineItems : [];
  if (rawLines.length === 0) {
    return { error: "At least one return item is required" };
  }

  const lineItems: InvoiceLineItem[] = [];
  for (const raw of rawLines) {
    if (!raw || typeof raw !== "object") {
      return { error: "Invalid return line" };
    }
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const qty = Number(row.qty);
    const unitPrice = Number(row.unitPrice);
    const amount = Number(row.amount);
    if (!name || !(qty > 0) || !(unitPrice >= 0) || !(amount >= 0)) {
      return { error: "Each return item needs name, qty, and price" };
    }
    lineItems.push({
      id: String(row.id ?? crypto.randomUUID()),
      name,
      qty,
      unitPrice,
      amount: Number.isFinite(amount) ? amount : Math.round(qty * unitPrice * 100) / 100,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : undefined,
    });
  }

  const total = lineItems.reduce((s, l) => s + l.amount, 0);
  if (!(total > 0)) {
    return { error: "Return total must be greater than 0" };
  }

  let receivedAt: string | undefined;
  if (body.receivedAt != null && String(body.receivedAt).trim()) {
    const parsed = parseBusinessReceivedAt(body.receivedAt);
    if ("error" in parsed) return parsed;
    receivedAt = parsed.iso;
  }

  return {
    data: {
      lineItems,
      notes: body.notes ? String(body.notes) : undefined,
      receivedAt,
    },
  };
}

export async function createReturn(
  supabase: SupabaseClient,
  salesmanId: string,
  input: ReturnWriteInput,
  verification: VerificationInsert,
): Promise<SalesmanReturn> {
  const totalAmount =
    Math.round(input.lineItems.reduce((s, l) => s + l.amount, 0) * 100) / 100;

  const { data, error } = await supabase
    .from("salesmen_returns")
    .insert({
      salesman_id: salesmanId,
      total_amount: totalAmount,
      remaining_amount: totalAmount,
      notes: input.notes ?? null,
      received_at: input.receivedAt ?? new Date().toISOString(),
      status: "active",
      verification_status: verification.verification_status,
      created_by: verification.created_by,
      created_by_name: verification.created_by_name,
      verified_by: verification.verified_by,
      verified_by_name: verification.verified_by_name,
      verified_at: verification.verified_at,
      verification_note: verification.verification_note,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create return");
  }

  const returnId = data.id as string;
  const lines = input.lineItems.map((line, index) => ({
    return_id: returnId,
    name: line.name,
    qty: line.qty,
    unit_price: line.unitPrice,
    amount: line.amount,
    price_list_item_id: line.priceListItemId ?? null,
    sort_order: index,
  }));

  const { data: insertedLines, error: linesError } = await supabase
    .from("salesmen_return_lines")
    .insert(lines)
    .select("*");
  if (linesError) {
    await supabase.from("salesmen_returns").delete().eq("id", returnId);
    throw new Error(linesError.message);
  }

  await refreshSalesmanTotals(supabase, salesmanId);
  return mapReturnRow(
    data as DbReturnRow,
    (insertedLines ?? []) as DbReturnLineRow[],
  );
}

export async function restoreReturnRemainingFromInvoiceLines(
  supabase: SupabaseClient,
  lines: Array<{
    stand_alone_return_id?: string | null;
    amount: number | string;
    is_return?: boolean;
  }>,
): Promise<void> {
  const byReturn = new Map<string, number>();
  for (const line of lines) {
    if (!line.stand_alone_return_id) continue;
    if (line.is_return === false) continue;
    const amt = Number(line.amount);
    if (!(amt > 0)) continue;
    byReturn.set(
      line.stand_alone_return_id,
      (byReturn.get(line.stand_alone_return_id) ?? 0) + amt,
    );
  }
  for (const [returnId, amount] of byReturn) {
    const { data, error } = await supabase
      .from("salesmen_returns")
      .select("remaining_amount, total_amount")
      .eq("id", returnId)
      .maybeSingle();
    if (error) throw error;
    if (!data) continue;
    const next = Math.min(
      Number(data.total_amount),
      Math.round((Number(data.remaining_amount) + amount) * 100) / 100,
    );
    const { error: updError } = await supabase
      .from("salesmen_returns")
      .update({ remaining_amount: next })
      .eq("id", returnId);
    if (updError) throw updError;
  }
}

export async function consumeReturnRemainingFromInvoiceLines(
  supabase: SupabaseClient,
  returnItems: InvoiceLineItem[],
): Promise<{ error?: string }> {
  const byReturn = new Map<string, number>();
  for (const line of returnItems) {
    if (!line.standAloneReturnId) continue;
    if (!(line.amount > 0)) continue;
    byReturn.set(
      line.standAloneReturnId,
      (byReturn.get(line.standAloneReturnId) ?? 0) + line.amount,
    );
  }

  for (const [returnId, amount] of byReturn) {
    const { data, error } = await supabase
      .from("salesmen_returns")
      .select("remaining_amount, status, verification_status")
      .eq("id", returnId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Return not found" };
    if (data.status !== "active") {
      return { error: "Cannot apply a cancelled return" };
    }
    if (data.verification_status !== "verified") {
      return { error: "Return must be verified before applying" };
    }
    const remaining = Number(data.remaining_amount);
    if (amount > remaining + 0.001) {
      return {
        error: `Applied return exceeds remaining credit (${remaining})`,
      };
    }
    const next = Math.max(
      0,
      Math.round((remaining - amount) * 100) / 100,
    );
    const { error: updError } = await supabase
      .from("salesmen_returns")
      .update({ remaining_amount: next })
      .eq("id", returnId);
    if (updError) return { error: updError.message };
  }
  return {};
}

export async function deleteReturn(
  supabase: SupabaseClient,
  returnId: string,
): Promise<{ salesmanId: string }> {
  const { data: row, error } = await supabase
    .from("salesmen_returns")
    .select("*")
    .eq("id", returnId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Return not found");

  const ret = mapReturnRow(row as DbReturnRow, []);
  if (!canMutateWithinWindow(ret.createdAt)) {
    throw new Error(
      "This return can no longer be deleted. Changes are only allowed within 1 day of recording.",
    );
  }
  if (
    Math.round(ret.remainingAmount * 100) !== Math.round(ret.totalAmount * 100)
  ) {
    throw new Error(
      "Cannot delete a return that has already been applied to an invoice. Remove it from the invoice first.",
    );
  }
  if (ret.status === "cancelled") {
    throw new Error("Return is already cancelled");
  }

  const salesmanId = ret.salesmanId;
  const { error: delError } = await supabase
    .from("salesmen_returns")
    .delete()
    .eq("id", returnId);
  if (delError) throw delError;

  await refreshSalesmanTotals(supabase, salesmanId);
  return { salesmanId };
}
