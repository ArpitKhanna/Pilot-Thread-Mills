import { NextResponse } from "next/server";
import { fetchLedgerDateRange } from "@/lib/ledger/daily-query";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { todayDateString } from "@/lib/ledger/date-utils";

export async function GET(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? todayDateString();
  const to = searchParams.get("to") ?? from;

  try {
    const summaries = await fetchLedgerDateRange(supabase, from, to);
    return NextResponse.json({ summaries });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load ledger" },
      { status: 500 },
    );
  }
}
