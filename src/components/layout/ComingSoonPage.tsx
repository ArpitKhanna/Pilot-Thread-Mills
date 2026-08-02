import Link from "next/link";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "./AppShell";

type ComingSoonPageProps = {
  context: AppContext;
  title: string;
  description?: string;
  alternateHref?: string;
  alternateLabel?: string;
};

export function ComingSoonPage({
  context,
  title,
  description = "This feature is under development and will be built soon.",
  alternateHref,
  alternateLabel,
}: ComingSoonPageProps) {
  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: title },
        ]}
      />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md">
          <p className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
            Coming soon
          </p>
          <h1 className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted">{description}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
            >
              Back to Dashboard
            </Link>
            {alternateHref && alternateLabel ? (
              <Link
                href={alternateHref}
                className="inline-flex rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
              >
                {alternateLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
