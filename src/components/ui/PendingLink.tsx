"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  useTransition,
} from "react";

type PendingLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** When true, replace children with pendingLabel while navigating */
  showPendingLabel?: boolean;
  pendingLabel?: ReactNode;
};

export function PendingLink({
  href,
  children,
  onClick,
  showPendingLabel = false,
  pendingLabel = "Loading…",
  className,
  ...rest
}: PendingLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    e.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-busy={isPending || undefined}
      className={`${className ?? ""}${isPending ? " pointer-events-none opacity-70" : ""}`}
      {...rest}
    >
      {isPending && showPendingLabel ? pendingLabel : children}
      {isPending ? <span className="sr-only">Loading</span> : null}
    </Link>
  );
}
