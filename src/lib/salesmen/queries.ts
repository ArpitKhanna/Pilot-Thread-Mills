import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapInvoiceRows,
  mapSalesmanRow,
  type DbInvoiceLineRow,
  type DbInvoicePaymentRow,
  type DbInvoiceRow,
  type DbSalesmanRow,
} from "./mappers";
import type { Invoice, InvoiceSummary, Salesman } from "./types";

export async function listSalesmen(
  supabase: SupabaseClient,
): Promise<Salesman[]> {
  const { data, error } = await supabase
    .from("salesmen")
    .select("*")
    .eq("entity_type", "salesman")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as DbSalesmanRow[]).map(mapSalesmanRow);
}

export async function listCustomers(
  supabase: SupabaseClient,
): Promise<Salesman[]> {
  const { data, error } = await supabase
    .from("salesmen")
    .select("*")
    .eq("entity_type", "customer")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as DbSalesmanRow[]).map(mapSalesmanRow);
}

/** All parties (salesmen + customers) — for pickers that need both */
export async function listParties(
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

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "salesman";
}

async function allocateSalesmanId(
  supabase: SupabaseClient,
  name: string,
): Promise<string> {
  const base = `sm-${slugifyName(name)}`;
  const existing = await getSalesman(supabase, base);
  if (!existing) return base;

  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    const taken = await getSalesman(supabase, candidate);
    if (!taken) return candidate;
  }

  return `sm-${crypto.randomUUID().slice(0, 8)}`;
}

export type CreateSalesmanInput = {
  name: string;
  phone: string;
  alternatePhone?: string;
  pendingBalance?: number;
};

export type CreateCustomerInput = {
  name: string;
  phone: string;
  alternatePhone?: string;
  pendingBalance?: number;
  marketDay?: string;
  area?: string;
  isDefaulter?: boolean;
  tier?: string;
  balanceThreshold?: number | null;
};

export async function createSalesman(
  supabase: SupabaseClient,
  input: CreateSalesmanInput,
): Promise<Salesman> {
  const id = await allocateSalesmanId(supabase, input.name);
  const { data, error } = await supabase
    .from("salesmen")
    .insert({
      id,
      name: input.name,
      phone: input.phone,
      alternate_phone: input.alternatePhone ?? "",
      entity_type: "salesman",
      category: "Salesmen",
      is_active: true,
      opening_balance: input.pendingBalance ?? 0,
      pending_balance: input.pendingBalance ?? 0,
      last_invoice_at: null,
      discount_rules: [],
      market_day: "",
      area: "",
      is_defaulter: false,
      tier: "",
      balance_threshold: null,
      contact_name: "",
      address_building: "",
      address_area: "",
      address_city: "",
      address_state: "",
      address_pincode: "",
      map_lat: null,
      map_lng: null,
      tier_rubric: {},
      price_rules: [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapSalesmanRow(data as DbSalesmanRow);
}

export async function createCustomer(
  supabase: SupabaseClient,
  input: CreateCustomerInput,
): Promise<Salesman> {
  const id = await allocateSalesmanId(supabase, input.name);
  const addressArea = input.area ?? "";
  const { data, error } = await supabase
    .from("salesmen")
    .insert({
      id,
      name: input.name,
      phone: input.phone,
      alternate_phone: input.alternatePhone ?? "",
      entity_type: "customer",
      category: "Customer",
      is_active: true,
      opening_balance: input.pendingBalance ?? 0,
      pending_balance: input.pendingBalance ?? 0,
      last_invoice_at: null,
      discount_rules: [],
      market_day: input.marketDay ?? "",
      area: addressArea,
      is_defaulter: input.isDefaulter ?? false,
      tier: input.tier ?? "",
      balance_threshold: input.balanceThreshold ?? null,
      contact_name: "",
      address_building: "",
      address_area: addressArea,
      address_city: "",
      address_state: "",
      address_pincode: "",
      map_lat: null,
      map_lng: null,
      tier_rubric: {},
      price_rules: [],
    })
    .select("*")
    .single();
  if (error) throw error;
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

/** Verified invoice totals for all salesmen — used for list-page aggregate stats */
export async function listInvoiceSummariesForSalesmen(
  supabase: SupabaseClient,
  salesmanIds: string[],
): Promise<InvoiceSummary[]> {
  if (salesmanIds.length === 0) return [];

  const { data, error } = await supabase
    .from("salesmen_invoices")
    .select("issued_at, total_amount, amount_paid")
    .in("salesman_id", salesmanIds)
    .eq("verification_status", "verified");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    issuedAt: row.issued_at as string,
    totalAmount: Number(row.total_amount),
    amountPaid: Number(row.amount_paid),
  }));
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

export type PendingInvoiceApproval = {
  invoice: Invoice;
  salesmanName: string;
  salesmanId: string;
  /** Prior balance before this invoice (opening + earlier invoices). */
  previousBalance: number;
  /** previousBalance + invoice.totalAmount — amount charged on the account. */
  chargedTotal: number;
};

function computeInvoiceChargedTotals(
  openingBalance: number,
  invoices: Invoice[],
): Map<string, { previousBalance: number; chargedTotal: number }> {
  const sorted = [...invoices].sort((a, b) => {
    const byDate =
      new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime();
    if (byDate !== 0) return byDate;
    return a.number.localeCompare(b.number);
  });
  const result = new Map<
    string,
    { previousBalance: number; chargedTotal: number }
  >();
  let running = openingBalance;
  for (const inv of sorted) {
    const previous = Math.max(0, Math.round(running * 100) / 100);
    const charged = Math.round((previous + inv.totalAmount) * 100) / 100;
    result.set(inv.id, { previousBalance: previous, chargedTotal: charged });
    running = Math.max(
      0,
      Math.round((previous + inv.totalAmount - inv.amountPaid) * 100) / 100,
    );
  }
  return result;
}

/** Invoices awaiting admin verification */
export async function listPendingInvoiceApprovals(
  supabase: SupabaseClient,
): Promise<PendingInvoiceApproval[]> {
  const { data, error } = await supabase
    .from("salesmen_invoices")
    .select("*")
    .eq("verification_status", "pending_verification")
    .order("issued_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DbInvoiceRow[];
  if (rows.length === 0) return [];

  const invoices = await attachInvoiceChildren(supabase, rows);
  const salesmanIds = [...new Set(invoices.map((i) => i.salesmanId))];
  const [{ data: salesmenRows, error: salesmenError }, ...allInvoiceSets] =
    await Promise.all([
      supabase
        .from("salesmen")
        .select("id, name, opening_balance")
        .in("id", salesmanIds),
      ...salesmanIds.map((id) => listInvoicesForSalesman(supabase, id)),
    ]);
  if (salesmenError) throw salesmenError;

  const salesmanById = new Map(
    (salesmenRows ?? []).map((s) => [
      s.id as string,
      {
        name: s.name as string,
        openingBalance: Number(s.opening_balance ?? 0),
      },
    ]),
  );

  const chargedBySalesman = new Map<
    string,
    Map<string, { previousBalance: number; chargedTotal: number }>
  >();
  salesmanIds.forEach((id, index) => {
    const salesman = salesmanById.get(id);
    chargedBySalesman.set(
      id,
      computeInvoiceChargedTotals(
        salesman?.openingBalance ?? 0,
        allInvoiceSets[index] ?? [],
      ),
    );
  });

  return invoices.map((invoice) => {
    const salesman = salesmanById.get(invoice.salesmanId);
    const charged =
      chargedBySalesman.get(invoice.salesmanId)?.get(invoice.id) ?? {
        previousBalance: 0,
        chargedTotal: invoice.totalAmount,
      };
    return {
      invoice,
      salesmanId: invoice.salesmanId,
      salesmanName: salesman?.name ?? "Unknown",
      previousBalance: charged.previousBalance,
      chargedTotal: charged.chargedTotal,
    };
  });
}

/** Recompute salesman pending balance + last invoice timestamp from opening + invoices − advances − returns */
export async function refreshSalesmanTotals(
  supabase: SupabaseClient,
  salesmanId: string,
): Promise<void> {
  const [
    { data: salesman, error: salesmanError },
    { data, error },
    { data: advances, error: advancesError },
    { data: returns, error: returnsError },
  ] = await Promise.all([
    supabase
      .from("salesmen")
      .select("opening_balance")
      .eq("id", salesmanId)
      .maybeSingle(),
    supabase
      .from("salesmen_invoices")
      .select("total_amount, amount_paid, issued_at")
      .eq("salesman_id", salesmanId)
      .eq("verification_status", "verified"),
    supabase
      .from("salesmen_advances")
      .select("remaining_amount")
      .eq("salesman_id", salesmanId)
      .eq("status", "active")
      .eq("verification_status", "verified"),
    supabase
      .from("salesmen_returns")
      .select("remaining_amount")
      .eq("salesman_id", salesmanId)
      .eq("status", "active")
      .eq("verification_status", "verified"),
  ]);
  if (salesmanError) throw salesmanError;
  if (error) throw error;
  if (advancesError) throw advancesError;
  if (returnsError) throw returnsError;

  const opening = Number(salesman?.opening_balance ?? 0);
  const rows = data ?? [];
  let invoiceNet = 0;
  let lastInvoiceAt: string | null = null;

  for (const row of rows) {
    const total = Number(row.total_amount);
    const paid = Number(row.amount_paid);
    invoiceNet += total - paid;
    if (
      !lastInvoiceAt ||
      new Date(row.issued_at).getTime() > new Date(lastInvoiceAt).getTime()
    ) {
      lastInvoiceAt = row.issued_at;
    }
  }

  let credit = 0;
  for (const row of advances ?? []) {
    credit += Number(row.remaining_amount);
  }
  for (const row of returns ?? []) {
    credit += Number(row.remaining_amount);
  }

  const pending = Math.max(
    0,
    Math.round((opening + invoiceNet - credit) * 100) / 100,
  );

  const { error: updateError } = await supabase
    .from("salesmen")
    .update({
      pending_balance: pending,
      last_invoice_at: lastInvoiceAt,
    })
    .eq("id", salesmanId);
  if (updateError) throw updateError;
}
