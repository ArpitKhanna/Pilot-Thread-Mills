"use client";

import type { AppContext } from "@/app/(app)/layout";
import { MobileNavProvider } from "./MobileNavContext";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  context: AppContext;
  children: React.ReactNode;
};

export function AppShell({ context, children }: AppShellProps) {
  return (
    <MobileNavProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-background">
        <Sidebar context={context} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </MobileNavProvider>
  );
}

export { TopBar } from "./TopBar";
