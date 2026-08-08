import Link from "next/link";
import type { AppContext } from "@/app/(app)/layout";
import { AppPage } from "./AppShell";
import { Button } from "@/components/ui/button";
import { MotionCard } from "@/components/ui/motion";

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
    <AppPage
      context={context}
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: title },
      ]}
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <MotionCard interactive={false} className="max-w-md">
        <p className="font-mono text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
          Coming soon
        </p>
        <h1 className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted">{description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
          {alternateHref && alternateLabel ? (
            <Button variant="outline" asChild>
              <Link href={alternateHref}>{alternateLabel}</Link>
            </Button>
          ) : null}
        </div>
      </MotionCard>
    </AppPage>
  );
}
