"use client";

import Link from "next/link";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-xl font-medium tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        {error.message || "This page could not load. You can try again or return to the dashboard."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
