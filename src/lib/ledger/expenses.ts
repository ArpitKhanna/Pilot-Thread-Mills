import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth/types";
import type { InvoicePaymentMethod } from "@/lib/salesmen/types";
import { parseBusinessReceivedAt } from "@/lib/salesmen/record-window";
import type { DailyExpense, ExpenseCategory, ExpenseWriteInput } from "./types";

export type DbExpenseRow = {
  id: string;
  category: ExpenseCategory;
  payee: string | null;
  amount: number | string;
  method: InvoicePaymentMethod;
  paid_at: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

const CATEGORIES: ExpenseCategory[] = [
  "petrol",
  "dyer",
  "maintenance",
  "scheduled",
  "other",
];

const METHODS: InvoicePaymentMethod[] = ["cash", "cheque", "upi", "imps"];

export function mapExpenseRow(row: DbExpenseRow): DailyExpense {
  return {
    id: row.id,
    category: row.category,
    payee: row.payee,
    amount: Number(row.amount),
    method: row.method,
    paidAt: row.paid_at,
    notes: row.notes,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
  };
}

export function validateExpensePayload(
  body: Record<string, unknown>,
): { data: ExpenseWriteInput } | { error: string } {
  const category = body.category as ExpenseCategory;
  if (!CATEGORIES.includes(category)) {
    return { error: "Invalid expense category" };
  }
  const method = body.method as InvoicePaymentMethod;
  if (!METHODS.includes(method)) {
    return { error: "Invalid payment method" };
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || !(amount > 0)) {
    return { error: "Amount must be greater than 0" };
  }

  let paidAt: string | undefined;
  if (body.paidAt != null && String(body.paidAt).trim()) {
    const parsed = parseBusinessReceivedAt(body.paidAt);
    if ("error" in parsed) return parsed;
    paidAt = parsed.iso;
  }

  return {
    data: {
      category,
      payee: body.payee ? String(body.payee) : undefined,
      amount,
      method,
      paidAt,
      notes: body.notes ? String(body.notes) : undefined,
    },
  };
}

export async function createExpense(
  supabase: SupabaseClient,
  profile: Profile,
  input: ExpenseWriteInput,
): Promise<DailyExpense> {
  const { data, error } = await supabase
    .from("daily_expenses")
    .insert({
      category: input.category,
      payee: input.payee?.trim() || null,
      amount: input.amount,
      method: input.method,
      paid_at: input.paidAt ?? new Date().toISOString(),
      notes: input.notes?.trim() || null,
      created_by: profile.id,
      created_by_name: profile.full_name,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to record expense");
  }
  return mapExpenseRow(data as DbExpenseRow);
}

export async function listExpensesForDay(
  supabase: SupabaseClient,
  start: string,
  end: string,
): Promise<DailyExpense[]> {
  const { data, error } = await supabase
    .from("daily_expenses")
    .select("*")
    .gte("paid_at", start)
    .lte("paid_at", end)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbExpenseRow[]).map(mapExpenseRow);
}

export async function deleteExpense(
  supabase: SupabaseClient,
  expenseId: string,
): Promise<void> {
  const { error } = await supabase
    .from("daily_expenses")
    .delete()
    .eq("id", expenseId);
  if (error) throw error;
}
