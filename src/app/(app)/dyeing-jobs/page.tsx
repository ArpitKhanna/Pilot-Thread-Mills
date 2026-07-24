import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { DyeingJobsClient } from "@/components/dyeing-jobs/DyeingJobsClient";
import { listDyeingJobs } from "@/lib/customer-orders/pending-dyeing";
import { createClient } from "@/lib/supabase/server";

export default async function DyeingJobsPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some(
    (m) => m.id === "dyeing-jobs" || m.id === "order-customers",
  );
  if (!hasAccess) redirect("/dashboard");

  const supabase = await createClient();
  const jobs = await listDyeingJobs(supabase, {
    status: ["queued", "dyeing", "done"],
  });

  return <DyeingJobsClient context={context} initialJobs={jobs} />;
}
