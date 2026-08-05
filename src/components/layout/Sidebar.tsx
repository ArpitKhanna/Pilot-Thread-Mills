"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { useApprovalsCount } from "@/lib/approvals/use-approvals-count";
import { PendingLink } from "@/components/ui/PendingLink";
import { groupModulesBySection, MODULE_ICONS } from "@/lib/modules/navigation";
import { useMobileNav } from "./MobileNavContext";
import { NavIcon } from "./NavIcon";

type SidebarProps = {
  context: AppContext;
};

export function Sidebar({ context }: SidebarProps) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);
  const sections = groupModulesBySection(context.modules);
  const showApprovalsCount =
    context.profile.role === "admin" &&
    context.modules.some((m) => m.id === "approvals");
  const pendingApprovalsCount = useApprovalsCount(showApprovalsCount);

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const navContent = (
    <>
      <div className={`px-5 pt-6 pb-6 lg:pb-8 ${collapsed ? "lg:px-3" : ""}`}>
        <PendingLink
          href="/dashboard"
          className="block"
          onClick={() => setOpen(false)}
        >
          <span
            className={`font-logo-serif block font-normal tracking-tight text-foreground ${
              collapsed ? "lg:text-xl lg:text-center" : "text-[2rem] leading-none"
            }`}
          >
            {collapsed ? (
              <span className="hidden lg:inline">P</span>
            ) : null}
            <span className={collapsed ? "lg:hidden" : ""}>Pilot</span>
          </span>
          {(!collapsed || open) && (
            <span className="mt-1 block font-mono text-[10px] font-medium tracking-[0.35em] text-muted uppercase lg:block">
              Thread Mills
            </span>
          )}
        </PendingLink>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 lg:space-y-6">
        {sections.map(({ section, label, items }) =>
          items.length === 0 ? null : (
            <div key={section}>
              {(!collapsed || open) && (
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
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? "bg-surface font-medium text-foreground shadow-sm"
                            : "text-foreground/80 hover:bg-surface/60"
                        } ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
                      >
                        <span className="relative shrink-0">
                          <NavIcon
                            name={MODULE_ICONS[item.id] ?? "circle"}
                            className="h-[18px] w-[18px]"
                          />
                          {badgeCount > 0 && (
                            <span
                              className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c45c26] px-0.5 text-[9px] font-semibold text-white tabular-nums ${
                                collapsed ? "hidden lg:flex" : "lg:hidden"
                              }`}
                            >
                              {badgeCount > 9 ? "9+" : badgeCount}
                            </span>
                          )}
                        </span>
                        <span
                          className={`flex min-w-0 flex-1 items-center gap-2 ${
                            collapsed ? "lg:hidden" : ""
                          }`}
                        >
                          <span className="truncate">{item.name}</span>
                          {badgeCount > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#c45c26] px-1.5 text-[10px] font-semibold text-white tabular-nums">
                              {badgeCount > 99 ? "99+" : badgeCount}
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
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(280px,88vw)] flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`relative hidden shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-200 lg:flex ${
          collapsed ? "w-[72px]" : "w-[240px]"
        }`}
      >
        {navContent}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-8 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm hover:text-foreground"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={collapsed ? "rotate-180" : ""}
          >
            <path
              d="M7.5 2.5L4 6l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </aside>
    </>
  );
}
