"use client";

import type { AppContext } from "@/app/(app)/layout";
import { PushNotificationSetup } from "@/components/push/PushNotificationSetup";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";
import { MobileNavProvider } from "./MobileNavContext";
import { CreateFabHost } from "./CreateFabHost";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  context: AppContext;
  children: React.ReactNode;
};

export function AppShell({ context, children }: AppShellProps) {
  useRealtimeRefresh();

  return (
    <MobileNavProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-background">
        <Sidebar context={context} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <PushNotificationSetup context={context} />
          {children}
          <CreateFabHost context={context} />
        </div>
      </div>
    </MobileNavProvider>
  );
}

export { AppPage, TopBar } from "./AppPage";
export type { AppBreadcrumb } from "./AppPage";
