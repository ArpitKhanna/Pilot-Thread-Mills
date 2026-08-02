import { NextResponse } from "next/server";
import {
  createLedgerReceipt,
  listOpenInvoicesForParty,
  validateReceiptPayload,
} from "@/lib/ledger/receipts";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

async function hasReceiptAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .in("module_id", [
      "entity-salesmen",
      "order-salesmen",
      "entity-customers",
      "order-customers",
      "dashboard",
      "payments",
    ]);
  return (data ?? []).length > 0;
}

export async function GET(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasReceiptAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("partyId");
  if (!partyId) {
    return NextResponse.json({ error: "partyId is required" }, { status: 400 });
  }

  try {
    const invoices = await listOpenInvoicesForParty(supabase, partyId);
    return NextResponse.json({ invoices });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load invoices" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasReceiptAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateReceiptPayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const result = await createLedgerReceipt(supabase, profile, validated.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to record receipt" },
      { status: 500 },
    );
  }
}
