"use client";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-xl font-medium tracking-tight">
        Dashboard could not load
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        {error.message || "Something went wrong while loading your dashboard."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
      >
        Try again
      </button>
    </main>
  );
}
