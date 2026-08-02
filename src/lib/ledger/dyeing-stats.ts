import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarDaysBetween } from "./date-utils";
import type { DyeingStats } from "./types";

export const DEFAULT_DYEING_SLA_DAYS = 3;

export async function fetchDyeingStats(
  supabase: SupabaseClient,
  slaDays: number = DEFAULT_DYEING_SLA_DAYS,
): Promise<DyeingStats> {
  const [jobsRes, pendingRes, patchesRes] = await Promise.all([
    supabase
      .from("dyeing_jobs")
      .select("id, status, created_at, shade_code, is_urgent, customer_id, salesmen:customer_id ( name )")
      .in("status", ["queued", "dyeing"])
      .order("created_at", { ascending: true }),
    supabase
      .from("customer_pending_items")
      .select("id")
      .eq("status", "ready"),
    supabase
      .from("customer_cloth_patches")
      .select("id")
      .eq("status", "awaiting_shade"),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  if (pendingRes.error) throw pendingRes.error;
  if (patchesRes.error) throw patchesRes.error;

  const laggingJobs: DyeingStats["laggingJobs"] = [];
  let lagging = 0;

  for (const row of jobsRes.data ?? []) {
    const ageDays = calendarDaysBetween(row.created_at as string);
    if (ageDays > slaDays) {
      lagging += 1;
      laggingJobs.push({
        id: row.id as string,
        customerName:
          (row.salesmen as { name?: string } | null)?.name ?? "Unknown",
        shadeCode: (row.shade_code as string) ?? "—",
        status: row.status as string,
        ageDays,
        isUrgent: Boolean(row.is_urgent),
      });
    }
  }

  laggingJobs.sort((a, b) => b.ageDays - a.ageDays);

  return {
    slaDays,
    inQueue: (jobsRes.data ?? []).length,
    lagging,
    readyUnfulfilled: (pendingRes.data ?? []).length,
    awaitingShade: (patchesRes.data ?? []).length,
    laggingJobs: laggingJobs.slice(0, 8),
  };
}
