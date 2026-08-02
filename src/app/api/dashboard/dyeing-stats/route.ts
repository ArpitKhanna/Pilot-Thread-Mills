import { NextResponse } from "next/server";
import { fetchDyeingStats } from "@/lib/ledger/dyeing-stats";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

export async function GET() {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  try {
    const stats = await fetchDyeingStats(supabase);
    return NextResponse.json({ stats });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load dyeing stats" },
      { status: 500 },
    );
  }
}
