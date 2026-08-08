"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import type { AppContext } from "@/app/(app)/layout";
import { ROLE_LABELS } from "@/lib/auth/types";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarMenuButton } from "./Sidebar";
import { EntitySearch } from "./EntitySearch";
import { useMobileNav } from "./MobileNavContext";
import type { AppBreadcrumb } from "./AppPage";

type TopBarProps = {
  context: AppContext;
  breadcrumbs: AppBreadcrumb[];
};

function ProfileMenu({
  context,
  signingOut,
  onSignOut,
}: {
  context: AppContext;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const initial = context.profile.full_name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-auto gap-2 rounded-full py-1 pr-2 pl-1 shadow-sm"
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-sidebar text-sm font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>
          <ChevronDownIcon className="hidden size-3 lg:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">
            {context.profile.full_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {context.profile.role
              ? ROLE_LABELS[context.profile.role]
              : "Employee"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(e) => {
            e.preventDefault();
            onSignOut();
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({ context, breadcrumbs }: TopBarProps) {
  const router = useRouter();
  const { toggle } = useMobileNav();
  const [searchOpen, setSearchOpen] = useState(false);
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
    <>
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent
          side="top"
          className="gap-0 border-b border-border bg-background p-4 lg:hidden"
        >
          <SheetTitle className="sr-only">Search</SheetTitle>
          <EntitySearch
            context={context}
            autoFocus
            onNavigate={() => setSearchOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
        <div className="flex min-w-0 max-w-[32%] items-center gap-3 lg:max-w-none">
          <SidebarMenuButton onClick={toggle} />

          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList>
              {breadcrumbs.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="contents">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href} className="truncate">
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="truncate">
                        {crumb.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          <p className="truncate text-sm font-medium sm:hidden">{currentPage}</p>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <EntitySearch context={context} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="rounded-full lg:hidden"
            aria-label="Search salesmen and customers"
          >
            <SearchIcon className="size-4" />
          </Button>

          <ProfileMenu
            context={context}
            signingOut={signingOut}
            onSignOut={signOut}
          />
        </div>
      </header>
    </>
  );
}
