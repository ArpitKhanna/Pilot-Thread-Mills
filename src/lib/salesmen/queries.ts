import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapInvoiceRows,
  mapSalesmanRow,
  type DbInvoiceLineRow,
  type DbInvoicePaymentRow,
  type DbInvoiceRow,
  type DbSalesmanRow,
} from "./mappers";
import type { Invoice, Salesman } from "./types";

export async function listSalesmen(
  supabase: SupabaseClient,
): Promise<Salesman[]> {
  const { data, error } = await supabase
    .from("salesmen")
    .select("*")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as DbSalesmanRow[]).map(mapSalesmanRow);
}

export async function getSalesman(
  supabase: SupabaseClient,
  id: string,
): Promise<Salesman | null> {
  const { data, error } = await supabase
    .from("salesmen")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapSalesmanRow(data as DbSalesmanRow);
}

async function attachInvoiceChildren(
  supabase: SupabaseClient,
  invoices: DbInvoiceRow[],
): Promise<Invoice[]> {
  if (invoices.length === 0) return [];

  const ids = invoices.map((i) => i.id);
  const [{ data: lines, error: linesError }, { data: payments, error: payError }] =
    await Promise.all([
      supabase
        .from("salesmen_invoice_lines")
        .select("*")
        .in("invoice_id", ids)
        .order("sort_order"),
      supabase
        .from("salesmen_invoice_payments")
        .select("*")
        .in("invoice_id", ids)
        .order("sort_order"),
    ]);

  if (linesError) throw linesError;
  if (payError) throw payError;

  const lineRows = (lines ?? []) as DbInvoiceLineRow[];
  const paymentRows = (payments ?? []) as DbInvoicePaymentRow[];

  return invoices.map((inv) =>
    mapInvoiceRows(
      inv,
      lineRows.filter((l) => l.invoice_id === inv.id),
      paymentRows.filter((p) => p.invoice_id === inv.id),
    ),
  );
}

export async function listInvoicesForSalesman(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("salesmen_invoices")
    .select("*")
    .eq("salesman_id", salesmanId)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return attachInvoiceChildren(supabase, (data ?? []) as DbInvoiceRow[]);
}

export async function getInvoiceById(
  supabase: SupabaseClient,
  id: string,
): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("salesmen_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [invoice] = await attachInvoiceChildren(supabase, [
    data as DbInvoiceRow,
  ]);
  return invoice ?? null;
}

/** Recompute salesman pending balance + last invoice timestamp from all invoices */
export async function refreshSalesmanTotals(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("salesmen_invoices")
    .select("total_amount, amount_paid, issued_at")
    .eq("salesman_id", salesmanId);
  if (error) throw error;

  const rows = data ?? [];
  let pending = 0;
  let lastInvoiceAt: string | null = null;

  for (const row of rows) {
    const total = Number(row.total_amount);
    const paid = Number(row.amount_paid);
    pending += Math.max(0, total - paid);
    if (
      !lastInvoiceAt ||
      new Date(row.issued_at).getTime() > new Date(lastInvoiceAt).getTime()
    ) {
      lastInvoiceAt = row.issued_at;
    }
  }

  const { error: updateError } = await supabase
    .from("salesmen")
    .update({
      pending_balance: Math.round(pending * 100) / 100,
      last_invoice_at: lastInvoiceAt,
    })
    .eq("id", salesmanId);
  if (updateError) throw updateError;
}
