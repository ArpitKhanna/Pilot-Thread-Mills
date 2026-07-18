import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { fulfillItemRequest } from "@/lib/salesmen/item-requests";
import { getSalesman } from "@/lib/salesmen/queries";

type RouteContext = {
  params: Promise<{ id: string; requestId: string }>;
};

async function hasEntitySalesmenAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .eq("module_id", "entity-salesmen")
    .maybeSingle();
  return Boolean(data);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntitySalesmenAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, requestId } = await context.params;
  const salesman = await getSalesman(supabase, id);
  if (!salesman) {
    return NextResponse.json({ error: "Salesman not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== "fulfilled") {
    return NextResponse.json(
      { error: "Only status=fulfilled is supported" },
      { status: 400 },
    );
  }

  try {
    const updated = await fulfillItemRequest(supabase, id, requestId);
    if (!updated) {
      return NextResponse.json(
        { error: "Open request not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("fulfill item request", err);
    return NextResponse.json(
      { error: "Failed to fulfill item request" },
      { status: 500 },
    );
  }
}
