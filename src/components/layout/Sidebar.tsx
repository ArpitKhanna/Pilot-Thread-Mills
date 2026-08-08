"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import type { AppContext } from "@/app/(app)/layout";
import { useApprovalsCount } from "@/lib/approvals/use-approvals-count";
import { PendingLink } from "@/components/ui/PendingLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { groupModulesBySection, MODULE_ICONS } from "@/lib/modules/navigation";
import { useMobileNav } from "./MobileNavContext";
import { NavIcon } from "./NavIcon";

type SidebarProps = {
  context: AppContext;
};

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="warning" className="h-5 min-w-5 px-1.5 text-[10px] tabular-nums">
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

function SidebarBrand({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={cn("px-5 pt-6 pb-6 lg:pb-8", collapsed && "lg:px-3")}>
      <PendingLink href="/dashboard" className="block" onClick={onNavigate}>
        <span
          className={cn(
            "font-logo-serif block font-normal tracking-tight text-foreground",
            collapsed ? "lg:text-xl lg:text-center" : "text-[2rem] leading-none",
          )}
        >
          {collapsed ? <span className="hidden lg:inline">P</span> : null}
          <span className={collapsed ? "lg:hidden" : ""}>Pilot</span>
        </span>
        {!collapsed && (
          <span className="mt-1 block font-mono text-[10px] font-medium tracking-[0.35em] text-muted uppercase lg:block">
            Thread Mills
          </span>
        )}
      </PendingLink>
    </div>
  );
}

function SidebarNav({
  context,
  collapsed,
  mobile,
  onNavigate,
}: {
  context: AppContext;
  collapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = groupModulesBySection(context.modules);
  const showApprovalsCount =
    context.profile.role === "admin" &&
    context.modules.some((m) => m.id === "approvals");
  const pendingApprovalsCount = useApprovalsCount(showApprovalsCount);

  return (
    <nav className="flex-1 space-y-5 px-3 pb-6 lg:space-y-6">
      {sections.map(({ section, label, items }) =>
        items.length === 0 ? null : (
          <div key={section}>
            {(!collapsed || mobile) && (
              <p className="mb-2 px-3 font-mono text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
                {label}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const badgeCount =
                  item.id === "approvals" ? pendingApprovalsCount : 0;

                return (
                  <li key={item.id}>
                    <PendingLink
                      href={item.href}
                      title={collapsed ? item.name : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-surface font-medium text-foreground shadow-sm"
                          : "text-foreground/80 hover:bg-surface/60",
                        collapsed && "lg:justify-center lg:px-2",
                      )}
                    >
                      <span className="relative shrink-0">
                        <NavIcon
                          name={MODULE_ICONS[item.id] ?? "circle"}
                          className="h-[18px] w-[18px]"
                        />
                        {badgeCount > 0 && collapsed && !mobile && (
                          <span className="absolute -top-1 -right-1 hidden lg:flex">
                            <NavBadge count={badgeCount} />
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2",
                          collapsed && "lg:hidden",
                        )}
                      >
                        <span className="truncate">{item.name}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto shrink-0">
                            <NavBadge count={badgeCount} />
                          </span>
                        )}
                      </span>
                    </PendingLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
    </nav>
  );
}

export function Sidebar({ context }: SidebarProps) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <>
      {/* Mobile drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[min(280px,88vw)] gap-0 border-border bg-sidebar p-0 sm:max-w-[280px]"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBrand collapsed={false} onNavigate={() => setOpen(false)} />
          <ScrollArea className="flex-1">
            <SidebarNav
              context={context}
              collapsed={false}
              mobile
              onNavigate={() => setOpen(false)}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "relative hidden shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-[240px]",
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <ScrollArea className="flex-1">
          <SidebarNav context={context} collapsed={collapsed} />
        </ScrollArea>

        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-8 -right-3 size-6 rounded-full bg-surface shadow-sm"
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-3" />
          ) : (
            <PanelLeftCloseIcon className="size-3" />
          )}
        </Button>
      </aside>
    </>
  );
}

export function SidebarMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      className="lg:hidden"
      aria-label="Open navigation menu"
    >
      <MenuIcon className="size-4" />
    </Button>
  );
}
