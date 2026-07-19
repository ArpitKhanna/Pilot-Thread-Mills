"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { ROLE_LABELS } from "@/lib/auth/types";
import { useMobileNav } from "./MobileNavContext";

type TopBarProps = {
  context: AppContext;
  breadcrumbs: { label: string; href?: string }[];
};

export function TopBar({ context, breadcrumbs }: TopBarProps) {
  const router = useRouter();
  const { toggle } = useMobileNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const currentPage = breadcrumbs[breadcrumbs.length - 1]?.label;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground lg:hidden"
          aria-label="Open navigation menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 5h12M3 9h12M3 13h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <nav
          className="hidden min-w-0 items-center gap-2 text-sm text-muted sm:flex"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex min-w-0 items-center gap-2">
              {i > 0 && <span className="shrink-0">/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        <p className="truncate text-sm font-medium sm:hidden">{currentPage}</p>
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-border bg-surface p-1 pr-2 shadow-sm"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-sm font-medium">
            {context.profile.full_name.charAt(0).toUpperCase()}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="hidden sm:block"
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface py-2 shadow-lg">
              <div className="border-b border-border px-4 pb-3">
                <p className="truncate text-sm font-medium">
                  {context.profile.full_name}
                </p>
                <p className="text-xs text-muted">
                  {context.profile.role
                    ? ROLE_LABELS[context.profile.role]
                    : "Employee"}
                </p>
              </div>
              <button
                type="button"
                disabled={signingOut}
                onClick={signOut}
                className="w-full px-4 py-2 text-left text-sm hover:bg-sidebar disabled:opacity-60"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
