"use client";

import Link from "next/link";
import type { DyeingStats } from "@/lib/ledger/types";
import { useSyncedState } from "@/lib/realtime/use-synced-state";
import { WidgetKpi, WidgetSection } from "./WidgetKpi";

type DyeingStatusWidgetProps = {
  initialStats: DyeingStats;
};

export function DyeingStatusWidget({ initialStats }: DyeingStatusWidgetProps) {
  const [stats] = useSyncedState(initialStats);

  return (
    <WidgetSection
      title="Dyeing queue"
      description={`Turnaround target: ${stats.slaDays} days`}
      action={
        <Link
          href="/dyeing-jobs"
          className="text-sm font-medium underline underline-offset-2"
        >
          View jobs
        </Link>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WidgetKpi label="In queue" value={stats.inQueue} format="count" />
        <WidgetKpi
          label="Lagging"
          value={stats.lagging}
          format="count"
          valueClass={stats.lagging > 0 ? "text-red-700" : undefined}
        />
        <WidgetKpi label="Ready" value={stats.readyUnfulfilled} format="count" />
        <WidgetKpi
          label="Awaiting shade"
          value={stats.awaitingShade}
          format="count"
          valueClass={stats.awaitingShade > 0 ? "text-amber-800" : undefined}
        />
      </div>

      {stats.laggingJobs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Behind schedule
          </p>
          <ul className="space-y-1.5">
            {stats.laggingJobs.map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-sm"
              >
                <div className="min-w-0 truncate">
                  <span className="font-medium">{job.customerName}</span>
                  <span className="text-muted"> · {job.shadeCode}</span>
                  {job.isUrgent && (
                    <span className="ml-1 text-xs text-red-700">urgent</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {job.ageDays}d · {job.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetSection>
  );
}
