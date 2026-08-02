import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContext } from "./layout";
import { TopBar } from "@/components/layout/AppShell";

export default async function AppNotFound() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Page not found" },
        ]}
      />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md">
          <p className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
            Coming soon
          </p>
          <h1 className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">
            This page is not ready yet
          </h1>
          <p className="mt-3 text-sm text-muted">
            This feature is under development and will be built soon. Use the
            sidebar or go back to the dashboard to continue working.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
