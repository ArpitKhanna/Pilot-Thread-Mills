import { NextResponse } from "next/server";
import {
  createReturn,
  listReturnsForSalesman,
  validateReturnPayload,
} from "@/lib/salesmen/returns";
import { getSalesman } from "@/lib/salesmen/queries";
import { notifyReturnApprovalPending } from "@/lib/push/notify-approval";
import { verificationForCreator } from "@/lib/salesmen/verification";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

async function hasPartyAccess(
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
    ]);
  return (data ?? []).length > 0;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasPartyAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const salesman = await getSalesman(supabase, id);
  if (!salesman) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const returns = await listReturnsForSalesman(supabase, id);
  return NextResponse.json({ returns });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasPartyAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const salesman = await getSalesman(supabase, id);
  if (!salesman) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateReturnPayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const verification = verificationForCreator({
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
  });

  try {
    const returnRecord = await createReturn(
      supabase,
      id,
      validated.data,
      verification,
    );

    if (verification.verification_status === "pending_verification") {
      notifyReturnApprovalPending({
        returnId: returnRecord.id,
        salesmanName: salesman.name,
        totalAmount: returnRecord.totalAmount,
        createdByUserId: profile.id,
      });
    }

    return NextResponse.json({ return: returnRecord }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to record return" },
      { status: 500 },
    );
  }
}
