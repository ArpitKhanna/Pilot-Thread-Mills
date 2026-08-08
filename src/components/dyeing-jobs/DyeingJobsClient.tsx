"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { AppPage } from "@/components/layout/AppShell";
import {
  DYEING_JOB_STATUS_LABELS,
  ORDER_LINE_UNIT_LABELS,
  type DyeingJob,
  type DyeingJobStatus,
} from "@/lib/customer-orders/types";
import { useSyncedState } from "@/lib/realtime/use-synced-state";

type DyeingJobsClientProps = {
  context: AppContext;
  initialJobs: DyeingJob[];
};

const FILTERS: Array<DyeingJobStatus | "open"> = [
  "open",
  "queued",
  "dyeing",
  "done",
];

function statusTone(status: DyeingJobStatus): string {
  switch (status) {
    case "queued":
      return "bg-amber-50 text-amber-900";
    case "dyeing":
      return "bg-sky-50 text-sky-900";
    case "done":
      return "bg-emerald-50 text-emerald-900";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sidebar text-muted";
  }
}

export function DyeingJobsClient({
  context,
  initialJobs,
}: DyeingJobsClientProps) {
  const router = useRouter();
  const [jobs, setJobs] = useSyncedState(initialJobs);
  const [filter, setFilter] = useState<DyeingJobStatus | "open">("open");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const displayed = useMemo(() => {
    const list =
      filter === "open"
        ? jobs.filter((j) => j.status === "queued" || j.status === "dyeing")
        : jobs.filter((j) => j.status === filter);
    return [...list].sort((a, b) => {
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [jobs, filter]);

  async function setStatus(id: string, status: DyeingJobStatus) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/dyeing-jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = (await res.json()) as { job?: DyeingJob; error?: string };
      if (!res.ok || !json.job) {
        throw new Error(json.error ?? "Update failed");
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? json.job! : j)),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <AppPage
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Orders" },
          { label: "Dyeing Jobs" },
        ]}
      >
        <div className="mb-5">
          <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
            Dyeing Jobs
          </h1>
          <p className="mt-1 text-sm text-muted">
            Queue from end-of-day missing uploads and cloth patches.
          </p>
        </div>

        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-0.5">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                filter === value
                  ? "bg-sidebar font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {value === "open" ? "Open" : DYEING_JOB_STATUS_LABELS[value]}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            No dyeing jobs in this view.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-sidebar/50 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Item / shade</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Qty
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {job.customerName ?? "—"}
                      </div>
                      {job.isUrgent ? (
                        <span className="mt-0.5 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                          Urgent
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {job.itemName ?? "Item"} — {job.shadeCode || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {job.qty} {ORDER_LINE_UNIT_LABELS[job.unit]}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusTone(job.status)}`}
                      >
                        {DYEING_JOB_STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {job.status === "queued" ? (
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => void setStatus(job.id, "dyeing")}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                          >
                            Start
                          </button>
                        ) : null}
                        {job.status === "dyeing" ? (
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => void setStatus(job.id, "done")}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                          >
                            Done
                          </button>
                        ) : null}
                        {job.status === "queued" || job.status === "dyeing" ? (
                          <button
                            type="button"
                            disabled={busyId === job.id}
                            onClick={() => void setStatus(job.id, "cancelled")}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppPage>
    </>
  );
}
