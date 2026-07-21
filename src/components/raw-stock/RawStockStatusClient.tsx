"use client";

import { useMemo, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { RawStockModals, type MovementModalKind } from "@/components/raw-stock/RawStockModals";
import {
  buildRawStockAnalytics,
  formatKg,
} from "@/lib/raw-stock/balance";
import {
  formatINR,
  formatInvoiceDate,
  formatShortDate,
} from "@/lib/salesmen/mock-data";
import type {
  RawStockBalances,
  RawStockCustomerOption,
  RawStockMovement,
  RawStockMovementType,
  RawStockShadeOption,
  RawStockSupplier,
  RawStockTimeRangePreset,
} from "@/lib/raw-stock/types";
import { MOVEMENT_TYPE_LABELS } from "@/lib/raw-stock/types";

type TabId = "stock" | "timeline" | "analytics" | "suppliers";

type RawStockStatusClientProps = {
  context: AppContext;
  initialMovements: RawStockMovement[];
  initialSuppliers: RawStockSupplier[];
  initialCounts: string[];
  initialCustomers: RawStockCustomerOption[];
  initialShades: RawStockShadeOption[];
  initialBalances: RawStockBalances;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "stock", label: "Stock" },
  { id: "timeline", label: "Timeline" },
  { id: "analytics", label: "Analytics" },
  { id: "suppliers", label: "Suppliers" },
];

const RANGE_OPTIONS: { id: RawStockTimeRangePreset; label: string }[] = [
  { id: "month", label: "1M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "max", label: "Max" },
];

const ACTION_BUTTONS: { kind: MovementModalKind; label: string }[] = [
  { kind: "purchase", label: "Purchase" },
  { kind: "send_to_narela", label: "Send to Narela" },
  { kind: "mark_dyed", label: "Record dyeing" },
  { kind: "receive_from_narela", label: "Receive" },
  { kind: "opening_balance", label: "Opening" },
];

export function RawStockStatusClient({
  context,
  initialMovements,
  initialSuppliers,
  initialCounts,
  initialCustomers,
  initialShades,
  initialBalances,
}: RawStockStatusClientProps) {
  const [tab, setTab] = useState<TabId>("stock");
  const [movements, setMovements] = useState(initialMovements);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [counts, setCounts] = useState(initialCounts);
  const [balances, setBalances] = useState(initialBalances);
  const [modalKind, setModalKind] = useState<MovementModalKind | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<RawStockSupplier | null>(
    null,
  );
  const [supplierTab, setSupplierTab] = useState<"active" | "inactive">("active");
  const [timelineType, setTimelineType] = useState<"all" | RawStockMovementType>(
    "all",
  );
  const [timelineCount, setTimelineCount] = useState("");
  const [rangePreset, setRangePreset] = useState<RawStockTimeRangePreset>("6m");
  const [expandedCounts, setExpandedCounts] = useState<Set<string>>(new Set());

  const analytics = useMemo(
    () => buildRawStockAnalytics(movements, rangePreset),
    [movements, rangePreset],
  );

  const filteredTimeline = useMemo(() => {
    return movements.filter((m) => {
      if (timelineType !== "all" && m.movementType !== timelineType) return false;
      if (timelineCount && m.countLabel !== timelineCount) return false;
      return true;
    });
  }, [movements, timelineType, timelineCount]);

  const timelineGroups = useMemo(() => {
    const groups: { label: string; items: RawStockMovement[] }[] = [];
    for (const m of filteredTimeline) {
      const label = formatInvoiceDate(m.movementDate).monthYear;
      const existing = groups.find((g) => g.label === label);
      if (existing) existing.items.push(m);
      else groups.push({ label, items: [m] });
    }
    return groups;
  }, [filteredTimeline]);

  const displayedSuppliers = useMemo(() => {
    return suppliers
      .filter((s) => (supplierTab === "active" ? s.isActive : !s.isActive))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, supplierTab]);

  const maxBar = Math.max(
    1,
    ...analytics.monthlyTrend.flatMap((p) => [
      p.purchasedKg,
      p.sentKg,
      p.dyedKg,
      p.receivedKg,
    ]),
  );

  function onDataRefresh(next: {
    movements: RawStockMovement[];
    suppliers: RawStockSupplier[];
    counts: string[];
    balances: RawStockBalances;
  }) {
    setMovements(next.movements);
    setSuppliers(next.suppliers);
    setCounts(next.counts);
    setBalances(next.balances);
  }

  function toggleExpanded(countLabel: string) {
    setExpandedCounts((prev) => {
      const next = new Set(prev);
      if (next.has(countLabel)) next.delete(countLabel);
      else next.add(countLabel);
      return next;
    });
  }

  async function refreshFromServer() {
    const res = await fetch("/api/raw-stock/summary");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to refresh");
    onDataRefresh({
      movements: data.movements,
      suppliers: data.suppliers,
      counts: data.counts,
      balances: data.balances,
    });
  }

  async function toggleSupplierActive(supplier: RawStockSupplier) {
    const res = await fetch(`/api/raw-stock/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !supplier.isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to update supplier");
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? data.supplier : s)),
    );
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[{ label: "Raw Stock Status" }]}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-medium tracking-tight">
                Raw Stock Status
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACTION_BUTTONS.map((btn) => (
                <button
                  key={btn.kind}
                  type="button"
                  onClick={() => setModalKind(btn.kind)}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-sidebar"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Rama undyed" value={formatKg(balances.totals.ramaUndyedKg)} />
            <Kpi
              label="Narela undyed"
              value={formatKg(balances.totals.narelaUndyedKg)}
            />
            <Kpi
              label="Narela dyed"
              value={formatKg(balances.totals.narelaDyedKg)}
            />
            <Kpi
              label="Narela total"
              value={formatKg(
                balances.totals.narelaUndyedKg + balances.totals.narelaDyedKg,
              )}
            />
          </div>

          <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  tab === t.id
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "stock" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <StockPanel
                title="Rama Road"
                subtitle="Undyed raw yarn on hand"
                rows={balances.byCount
                  .filter((r) => r.ramaUndyedKg > 0.0005)
                  .map((r) => ({
                    countLabel: r.countLabel,
                    kg: r.ramaUndyedKg,
                  }))}
                empty="No undyed stock at Rama Road"
              />
              <section className="rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="font-medium">Narela</h2>
                  <p className="text-sm text-muted">
                    Undyed waiting to dye + dyed awaiting return
                  </p>
                </div>
                {balances.byCount.filter(
                  (r) =>
                    r.narelaUndyedKg > 0.0005 || r.narelaDyedKg > 0.0005,
                ).length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted">
                    No stock at Narela
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {balances.byCount
                      .filter(
                        (r) =>
                          r.narelaUndyedKg > 0.0005 ||
                          r.narelaDyedKg > 0.0005,
                      )
                      .map((row) => {
                        const lots = balances.dyedLots.filter(
                          (l) => l.countLabel === row.countLabel,
                        );
                        const open = expandedCounts.has(row.countLabel);
                        return (
                          <li key={row.countLabel} className="px-4 py-3">
                            <button
                              type="button"
                              className="flex w-full items-start justify-between gap-3 text-left"
                              onClick={() => toggleExpanded(row.countLabel)}
                              disabled={lots.length === 0}
                            >
                              <div>
                                <p className="font-medium">{row.countLabel}</p>
                                <p className="mt-0.5 text-xs text-muted">
                                  Undyed {formatKg(row.narelaUndyedKg)}
                                  {" · "}
                                  Dyed {formatKg(row.narelaDyedKg)}
                                </p>
                              </div>
                              {lots.length > 0 && (
                                <span className="text-xs text-muted">
                                  {open ? "Hide lots" : `${lots.length} lot(s)`}
                                </span>
                              )}
                            </button>
                            {open && lots.length > 0 && (
                              <ul className="mt-2 space-y-1.5 border-l border-border pl-3">
                                {lots.map((lot) => (
                                  <li
                                    key={lot.movementId}
                                    className="text-sm text-muted"
                                  >
                                    <span className="text-foreground">
                                      {formatKg(lot.remainingKg)}
                                    </span>
                                    {" · "}
                                    {lot.shadeCodeText ||
                                      lot.colorLabel ||
                                      "Shade n/a"}
                                    {lot.customerName
                                      ? ` · ${lot.customerName}`
                                      : " · Internal"}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === "timeline" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <select
                  value={timelineType}
                  onChange={(e) =>
                    setTimelineType(
                      e.target.value as "all" | RawStockMovementType,
                    )
                  }
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="all">All types</option>
                  {(
                    Object.keys(MOVEMENT_TYPE_LABELS) as RawStockMovementType[]
                  ).map((t) => (
                    <option key={t} value={t}>
                      {MOVEMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <select
                  value={timelineCount}
                  onChange={(e) => setTimelineCount(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="">All counts</option>
                  {counts.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {timelineGroups.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
                  No movements yet
                </div>
              ) : (
                timelineGroups.map((group) => (
                  <section key={group.label}>
                    <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">
                      {group.label}
                    </h3>
                    <ul className="space-y-1 rounded-xl border border-border bg-surface p-1">
                      {group.items.map((m) => (
                        <li
                          key={m.id}
                          className="flex flex-col gap-1 rounded-lg px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {MOVEMENT_TYPE_LABELS[m.movementType]}
                              {" · "}
                              {m.countLabel}
                            </p>
                            <p className="text-xs text-muted">
                              {formatShortDate(m.movementDate)}
                              {m.supplierName ? ` · ${m.supplierName}` : ""}
                              {m.shadeCodeText || m.colorLabel
                                ? ` · ${m.shadeCodeText || m.colorLabel}`
                                : ""}
                              {m.customerName ? ` · ${m.customerName}` : ""}
                              {m.notes ? ` · ${m.notes}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-sm font-medium tabular-nums">
                            {formatKg(m.quantityKg)}
                            {m.pricePerKg != null && (
                              <span className="ml-2 text-xs font-normal text-muted">
                                @ {formatINR(m.pricePerKg)}/kg
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          )}

          {tab === "analytics" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium tracking-tight">
                    Month over month
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    Purchased, sent, dyed, and received volumes
                  </p>
                </div>
                <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
                  {RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRangePreset(opt.id)}
                      className={`rounded-md px-3 py-1.5 text-sm ${
                        rangePreset === opt.id
                          ? "bg-sidebar font-medium"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Kpi
                  label="Purchased"
                  value={formatKg(analytics.summary.purchasedKg)}
                />
                <Kpi label="Sent" value={formatKg(analytics.summary.sentKg)} />
                <Kpi label="Dyed" value={formatKg(analytics.summary.dyedKg)} />
                <Kpi
                  label="Received"
                  value={formatKg(analytics.summary.receivedKg)}
                />
                <Kpi
                  label="Purchase spend"
                  value={formatINR(analytics.summary.purchaseSpend)}
                />
              </div>

              <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                  Volume trend (kg)
                </p>
                {analytics.monthlyTrend.every(
                  (p) =>
                    p.purchasedKg === 0 &&
                    p.sentKg === 0 &&
                    p.dyedKg === 0 &&
                    p.receivedKg === 0,
                ) ? (
                  <p className="mt-6 text-center text-sm text-muted">
                    No movement activity in this period
                  </p>
                ) : (
                  <>
                    <div
                      className="mt-4 flex h-44 items-end gap-1.5 sm:gap-2"
                      role="img"
                      aria-label="Monthly stock movement volumes"
                    >
                      {analytics.monthlyTrend.map((point) => (
                        <div
                          key={point.key}
                          className="flex min-w-0 flex-1 flex-col items-center gap-1"
                        >
                          <div className="flex h-36 w-full items-end justify-center gap-0.5">
                            {(
                              [
                                ["purchasedKg", "#f8d4b8"],
                                ["sentKg", "#e86f2a"],
                                ["dyedKg", "#3b6ea5"],
                                ["receivedKg", "#2f6f4e"],
                              ] as const
                            ).map(([key, color]) => (
                              <div
                                key={key}
                                className="w-[22%] max-w-3 rounded-t-sm"
                                style={{
                                  backgroundColor: color,
                                  height:
                                    point[key] > 0
                                      ? `${Math.max(2, (point[key] / maxBar) * 100)}%`
                                      : "0%",
                                }}
                                title={`${key} ${point[key]} kg`}
                              />
                            ))}
                          </div>
                          <span className="truncate text-[10px] text-muted">
                            {point.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                      <LegendDot className="bg-[#f8d4b8]" label="Purchased" />
                      <LegendDot className="bg-[#e86f2a]" label="Sent" />
                      <LegendDot className="bg-[#3b6ea5]" label="Dyed" />
                      <LegendDot className="bg-[#2f6f4e]" label="Received" />
                    </div>
                  </>
                )}
              </section>
            </div>
          )}

          {tab === "suppliers" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setSupplierTab("active")}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      supplierTab === "active"
                        ? "bg-sidebar font-medium"
                        : "text-muted"
                    }`}
                  >
                    Active ({suppliers.filter((s) => s.isActive).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierTab("inactive")}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      supplierTab === "inactive"
                        ? "bg-sidebar font-medium"
                        : "text-muted"
                    }`}
                  >
                    Inactive ({suppliers.filter((s) => !s.isActive).length})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupplierModalOpen(true);
                  }}
                  className="rounded-lg bg-foreground px-3 py-2 text-sm text-background"
                >
                  Add supplier
                </button>
              </div>

              {displayedSuppliers.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
                  No suppliers in this list
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                  {displayedSuppliers.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <p className="font-medium">{s.name}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-sm text-muted hover:text-foreground"
                          onClick={() => {
                            setEditingSupplier(s);
                            setSupplierModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-sm text-muted hover:text-foreground"
                          onClick={() => void toggleSupplierActive(s)}
                        >
                          {s.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </main>

      <RawStockModals
        movementKind={modalKind}
        onCloseMovement={() => setModalKind(null)}
        supplierOpen={supplierModalOpen}
        editingSupplier={editingSupplier}
        onCloseSupplier={() => {
          setSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        counts={counts}
        suppliers={suppliers}
        customers={initialCustomers}
        shades={initialShades}
        balances={balances}
        onMovementSaved={async () => {
          await refreshFromServer();
          setModalKind(null);
        }}
        onSupplierSaved={(supplier) => {
          setSuppliers((prev) => {
            const exists = prev.some((s) => s.id === supplier.id);
            if (exists) {
              return prev.map((s) => (s.id === supplier.id ? supplier : s));
            }
            return [...prev, supplier];
          });
          setSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
      />
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 sm:px-4">
      <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-medium tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function StockPanel({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: { countLabel: string; kg: number }[];
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.countLabel}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">{row.countLabel}</span>
              <span className="tabular-nums text-sm">{formatKg(row.kg)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
