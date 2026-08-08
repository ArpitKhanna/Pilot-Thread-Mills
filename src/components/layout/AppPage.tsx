"use client";

import type { AppContext } from "@/app/(app)/layout";
import { PageMain } from "@/components/ui/motion";
import { TopBar } from "./TopBar";

export type AppBreadcrumb = { label: string; href?: string };

type AppPageProps = {
  context: AppContext;
  breadcrumbs: AppBreadcrumb[];
  children: React.ReactNode;
  className?: string;
  /** Disable page entrance animation (e.g. dashboard with its own stagger). */
  animate?: boolean;
  /** Full-width content rendered between the top bar and main scroll area. */
  beforeMain?: React.ReactNode;
};

export function AppPage({
  context,
  breadcrumbs,
  children,
  className,
  animate = true,
  beforeMain,
}: AppPageProps) {
  return (
    <>
      <TopBar context={context} breadcrumbs={breadcrumbs} />
      {beforeMain}
      <PageMain className={className} animate={animate}>
        {children}
      </PageMain>
    </>
  );
}

export { TopBar } from "./TopBar";
