import { NextResponse } from "next/server";
import {
  requireBankAccountsAccess,
  validateBankAccountPayload,
} from "@/lib/bank-accounts/api-helpers";
import { mapBankAccountRow, type DbBankAccountRow } from "@/lib/bank-accounts/mappers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireBankAccountsAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const body = await request.json();
  const validated = validateBankAccountPayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .update(validated.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    account: mapBankAccountRow(data as DbBankAccountRow),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireBankAccountsAccess();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}