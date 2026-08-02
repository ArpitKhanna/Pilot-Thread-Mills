import { NextResponse } from "next/server";
import { fetchDailyLedger } from "@/lib/ledger/daily-query";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { todayDateString } from "@/lib/ledger/date-utils";

export async function GET(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? todayDateString();

  try {
    const ledger = await fetchDailyLedger(supabase, date);
    return NextResponse.json({ ledger });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load ledger" },
      { status: 500 },
    );
  }
}
