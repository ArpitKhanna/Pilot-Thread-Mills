import { NextResponse } from "next/server";
import { deleteAdvance } from "@/lib/salesmen/advances";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ advanceId: string }> };

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

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasPartyAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { advanceId } = await context.params;
  try {
    const result = await deleteAdvance(supabase, advanceId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete advance" },
      { status: 400 },
    );
  }
}
