"use client";

import { formatINR } from "@/lib/salesmen/mock-data";

export function WidgetKpi({
  label,
  value,
  sublabel,
  valueClass,
  href,
  format = "currency",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  valueClass?: string;
  href?: string;
  format?: "currency" | "count";
}) {
  const display =
    typeof value === "number"
      ? format === "currency"
        ? formatINR(value)
        : String(value)
      : value;

  const content = (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-medium tabular-nums sm:text-xl ${valueClass ?? ""}`}
      >
        {display}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-muted">{sublabel}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block transition hover:border-foreground/20">
        {content}
      </a>
    );
  }
  return content;
}

export function WidgetSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-medium sm:text-lg">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
