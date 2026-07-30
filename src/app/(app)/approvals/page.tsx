import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/AppShell";
import { ApprovalsClient } from "@/components/approvals/ApprovalsClient";
import { getAppContext } from "@/app/(app)/layout";
import { listPendingAdvanceApprovals } from "@/lib/salesmen/advances";
import { listPendingReturnApprovals } from "@/lib/salesmen/returns";
import { listPendingInvoiceApprovals } from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ApprovalsPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "approvals");
  if (!hasAccess || context.profile.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [pending, pendingAdvances, pendingReturns] = await Promise.all([
    listPendingInvoiceApprovals(supabase),
    listPendingAdvanceApprovals(supabase),
    listPendingReturnApprovals(supabase),
  ]);

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Approvals" },
        ]}
      />
      <ApprovalsClient
        context={context}
        initialPending={pending}
        initialPendingAdvances={pendingAdvances}
        initialPendingReturns={pendingReturns}
      />
    </>
  );
}
