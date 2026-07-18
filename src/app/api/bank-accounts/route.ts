import { NextResponse } from "next/server";
import {
  requireBankAccountsAccess,
  validateBankAccountPayload,
} from "@/lib/bank-accounts/api-helpers";
import { mapBankAccountRow, type DbBankAccountRow } from "@/lib/bank-accounts/mappers";

export async function GET() {
  const auth = await requireBankAccountsAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    accounts: ((data ?? []) as DbBankAccountRow[]).map(mapBankAccountRow),
  });
}

export async function POST(request: Request) {
  const auth = await requireBankAccountsAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const body = await request.json();
  const validated = validateBankAccountPayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const id = `ba-${crypto.randomUUID()}`;

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      id,
      ...validated.data,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    account: mapBankAccountRow(data as DbBankAccountRow),
  });
}