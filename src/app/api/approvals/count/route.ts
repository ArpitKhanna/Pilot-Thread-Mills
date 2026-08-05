import { NextResponse } from "next/server";
import { countPendingApprovals } from "@/lib/approvals/count";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

export async function GET() {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (profile.role !== "admin") {
    return NextResponse.json({ count: 0 });
  }

  const { data: access } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", profile.role ?? "admin")
    .eq("module_id", "approvals")
    .maybeSingle();

  if (!access) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const count = await countPendingApprovals(supabase);
    return NextResponse.json({ count });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load approval count" },
      { status: 500 },
    );
  }
}
