import type { SupabaseClient } from "@supabase/supabase-js";
import { mapBankAccountRow, type DbBankAccountRow } from "./mappers";
import type { BankAccount } from "./types";

export async function listBankAccounts(
  supabase: SupabaseClient,
): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as DbBankAccountRow[]).map(mapBankAccountRow);
}

export async function listActiveBankAccounts(
  supabase: SupabaseClient,
): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return ((data ?? []) as DbBankAccountRow[]).map(mapBankAccountRow);
}