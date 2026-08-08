import { NextResponse } from "next/server";
import {
  isAuthError,
  requireDyeingJobsAccess,
} from "@/lib/customer-orders/access";
import {
  listDyeingJobs,
  updateDyeingJobStatus,
} from "@/lib/customer-orders/pending-dyeing";
import type { DyeingJobStatus } from "@/lib/customer-orders/types";

const STATUSES: DyeingJobStatus[] = [
  "queued",
  "dyeing",
  "done",
  "cancelled",
];

export async function GET(request: Request) {
  const auth = await requireDyeingJobsAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam && STATUSES.includes(statusParam as DyeingJobStatus)
      ? (statusParam as DyeingJobStatus)
      : undefined;

  try {
    const jobs = await listDyeingJobs(
      supabase,
      status
        ? { status }
        : { status: ["queued", "dyeing"] },
    );
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list dyeing jobs" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireDyeingJobsAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const status = String(body.status ?? "") as DyeingJobStatus;
  if (!id || !STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "id and valid status are required" },
      { status: 400 },
    );
  }

  try {
    const job = await updateDyeingJobStatus(supabase, id, status, {
      createdBy: auth.profile.id,
    });
    return NextResponse.json({ job });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update job" },
      { status: 400 },
    );
  }
}
