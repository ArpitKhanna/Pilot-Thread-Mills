import { NextResponse } from "next/server";
import { cancelInvoicePaymentCheque } from "@/lib/salesmen/advances";
import { actorDisplayName } from "@/lib/salesmen/verification";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (profile.role !== "admin" && profile.role !== "accountant") {
    const { data } = await supabase
      .from("role_module_access")
      .select("module_id")
      .eq("role", profile.role ?? "picker")
      .in("module_id", [
        "entity-salesmen",
        "order-salesmen",
        "entity-customers",
        "order-customers",
      ]);
    if (!(data ?? []).length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { paymentId } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    const result = await cancelInvoicePaymentCheque(
      supabase,
      paymentId,
      {
        id: profile.id,
        name: actorDisplayName({
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        }),
      },
      body.reason != null ? String(body.reason) : undefined,
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to cancel cheque" },
      { status: 400 },
    );
  }
}
