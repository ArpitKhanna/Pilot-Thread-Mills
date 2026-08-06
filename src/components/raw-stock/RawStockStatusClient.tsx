"use client";

import { useMemo, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import {
  RawStockModals,
  type MovementModalKind,
} from "@/components/raw-stock/RawStockModals";
import {
  buildMonthReport,
  deriveBalances,
  formatKg,
  listAvailableMonthKeys,
} from "@/lib/raw-stock/balance";
import { formatInvoiceDate, formatShortDate } from "@/lib/salesmen/mock-data";
import type {
  CountBalance,
  MonthReportRow,
  RawStockBalances,
  RawStockCategory,
  RawStockMovement,
  RawStockMovementType,
  RawStockSupplier,
} from "@/lib/raw-stock/types";
import {
  CATEGORY_LABELS,
  COUNTS_BY_CATEGORY,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/raw-stock/types";
import { useSyncedState } from "@/lib/realtime/use-synced-state";

type TabId = "stock" | "timeline" | "reports" | "suppliers";

type RawStockStatusClientProps = {
  context: AppContext;
  initialMovements: RawStockMovement[];
  initialSuppliers: RawStockSupplier[];
  initialBalances: RawStockBalances;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "stock", label: "Stock" },
  { id: "timeline", label: "Timeline" },
  { id: "reports", label: "Reports" },
  { id: "suppliers", label: "Suppliers" },
];

const ACTION_BUTTONS: { kind: MovementModalKind; label: string }[] = [
  { kind: "stock_in", label: "Add stock" },
  { kind: "stock_out", label: "Send to Rama Road" },
  { kind: "opening_balance", label: "Opening" },
];

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function RawStockStatusClient({
  context,
  initialMovements,
  initialSuppliers,
  initialBalances,
}: RawStockStatusClientProps) {
  const [tab, setTab] = useState<TabId>("stock");
  const [modalKind, setModalKind] = useState<MovementModalKind | null>(null);
  const [editingMovement, setEditingMovement] =
    useState<RawStockMovement | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const pauseSync =
    modalKind != null || supplierModalOpen || editingMovement != null;
  const [movements, setMovements] = useSyncedState(initialMovements, !pauseSync);
  const [suppliers, setSuppliers] = useSyncedState(initialSuppliers, !pauseSync);
  const [balances, setBalances] = useSyncedState(initialBalances, !pauseSync);
  const [editingSupplier, setEditingSupplier] = useState<RawStockSupplier | null>(
    null,
  );
  const [supplierTab, setSupplierTab] = useState<"active" | "inactive">("active");
  const [timelineType, setTimelineType] = useState<"all" | RawStockMovementType>(
    "all",
  );
  const [timelineCategory, setTimelineCategory] = useState<"all" | RawStockCategory>(
    "all",
  );
  const [timelineCount, setTimelineCount] = useState("");
  const [reportMonth, setReportMonth] = useState(currentMonthKey);

  const monthKeys = useMemo(
    () => listAvailableMonthKeys(movements),
    [movements],
  );

  const monthReport = useMemo(
    () => buildMonthReport(movements, reportMonth),
    [movements, reportMonth],
  );

  const editBalances = useMemo(() => {
    if (!editingMovement) return null;
    return deriveBalances(movements.filter((m) => m.id !== editingMovement.id));
  }, [editingMovement, movements]);

  const timelineCountOptions = useMemo(() => {
    if (timelineCategory === "all") {
      return [
        ...COUNTS_BY_CATEGORY.hank.map((c) => ({ category: "hank" as const, c })),
        ...COUNTS_BY_CATEGORY.cone.map((c) => ({ category: "cone" as const, c })),
      ];
    }
    return COUNTS_BY_CATEGORY[timelineCategory].map((c) => ({
      category: timelineCategory,
      c,
    }));
  }, [timelineCategory]);

  const filteredTimeline = useMemo(() => {
    return movements.filter((m) => {
      if (timelineType !== "all" && m.movementType !== timelineType) return false;
      if (timelineCategory !== "all" && m.category !== timelineCategory) {
        return false;
      }
      if (timelineCount) {
        if (timelineCount.includes("::")) {
          const [cat, count] = timelineCount.split("::");
          if (m.category !== cat || m.countLabel !== count) return false;
        } else if (m.countLabel !== timelineCount) {
          return false;
        }
      }
      return true;
    });
  }, [movements, timelineType, timelineCategory, timelineCount]);

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

  function onDataRefresh(next: {
    movements: RawStockMovement[];
    suppliers: RawStockSupplier[];
    balances: RawStockBalances;
  }) {
    setMovements(next.movements);
    setSuppliers(next.suppliers);
    setBalances(next.balances);
  }

  async function refreshFromServer() {
    const res = await fetch("/api/raw-stock/summary");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to refresh");
    onDataRefresh({
      movements: data.movements,
      suppliers: data.suppliers,
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
              <p className="mt-0.5 text-sm text-muted">
                Narela inventory by Hank and Cone count
              </p>
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Hank total" value={formatKg(balances.totals.hankKg)} />
            <Kpi label="Cone total" value={formatKg(balances.totals.coneKg)} />
            <Kpi
              label="Narela total"
              value={formatKg(balances.totals.narelaKg)}
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
              <CategoryStockPanel
                title="Hank"
                subtitle="Narela stock on hand"
                rows={balances.byCategory.hank}
                totalKg={balances.totals.hankKg}
              />
              <CategoryStockPanel
                title="Cone"
                subtitle="Narela stock on hand"
                rows={balances.byCategory.cone}
                totalKg={balances.totals.coneKg}
              />
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
                  value={timelineCategory}
                  onChange={(e) => {
                    setTimelineCategory(
                      e.target.value as "all" | RawStockCategory,
                    );
                    setTimelineCount("");
                  }}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="all">All categories</option>
                  <option value="hank">{CATEGORY_LABELS.hank}</option>
                  <option value="cone">{CATEGORY_LABELS.cone}</option>
                </select>
                <select
                  value={timelineCount}
                  onChange={(e) => setTimelineCount(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="">All counts</option>
                  {timelineCountOptions.map(({ category, c }) => (
                    <option
                      key={`${category}-${c}`}
                      value={
                        timelineCategory === "all" ? `${category}::${c}` : c
                      }
                    >
                      {timelineCategory === "all"
                        ? `${CATEGORY_LABELS[category]} · ${c}`
                        : c}
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
                  <TimelineMonthGroup
                    key={group.label}
                    label={group.label}
                    items={group.items}
                    onEdit={setEditingMovement}
                  />
                ))
              )}
            </div>
          )}

          {tab === "reports" && (
            <div className="space-y-5 print:space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <div>
                  <h2 className="text-lg font-medium tracking-tight">
                    Month report
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    Opening, stock in, sent to Rama Road, and closing by count
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  >
                    {monthKeys.map((key) => {
                      const [y, m] = key.split("-").map(Number);
                      const label = new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(
                        "en-IN",
                        { month: "long", year: "numeric" },
                      );
                      return (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-sidebar"
                  >
                    Print
                  </button>
                </div>
              </div>

              <div id="raw-stock-print-root" className="space-y-5 print:space-y-4">
                <div className="hidden print:block">
                  <h2 className="text-lg font-medium">
                    Raw Stock — {monthReport.label}
                  </h2>
                  <p className="text-sm text-muted">Narela inventory report</p>
                </div>

                <ReportTable
                  title="Hank"
                  rows={monthReport.byCategory.hank}
                  totals={monthReport.totals.hank}
                />
                <ReportTable
                  title="Cone"
                  rows={monthReport.byCategory.cone}
                  totals={monthReport.totals.cone}
                />

                <section className="rounded-xl border border-border bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">Overall</p>
                    <div className="flex flex-wrap gap-4 text-sm tabular-nums">
                      <span>
                        Opening{" "}
                        <strong>{formatKg(monthReport.totals.overall.openingKg)}</strong>
                      </span>
                      <span>
                        In{" "}
                        <strong>{formatKg(monthReport.totals.overall.stockInKg)}</strong>
                      </span>
                      <span>
                        Out{" "}
                        <strong>
                          {formatKg(monthReport.totals.overall.stockOutKg)}
                        </strong>
                      </span>
                      <span>
                        Closing{" "}
                        <strong>
                          {formatKg(monthReport.totals.overall.closingKg)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </section>
              </div>
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
        editingMovement={editingMovement}
        onCloseEditMovement={() => setEditingMovement(null)}
        editBalances={editBalances}
        supplierOpen={supplierModalOpen}
        editingSupplier={editingSupplier}
        onCloseSupplier={() => {
          setSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        suppliers={suppliers}
        balances={balances}
        onMovementSaved={async () => {
          await refreshFromServer();
          setModalKind(null);
          setEditingMovement(null);
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

function movementSourceLabel(m: RawStockMovement): string {
  if (m.supplierName) return m.supplierName;
  if (m.movementType === "stock_out") return "Rama Road";
  return "—";
}

function MovementWeight({ movement }: { movement: RawStockMovement }) {
  const kg = formatKg(movement.quantityKg);
  if (movement.movementType === "stock_in") {
    return (
      <span className="font-medium tabular-nums text-emerald-700">+{kg}</span>
    );
  }
  if (movement.movementType === "stock_out") {
    return (
      <span className="font-medium tabular-nums text-red-700">−{kg}</span>
    );
  }
  return <span className="font-medium tabular-nums text-muted">{kg}</span>;
}

function TimelineMonthGroup({
  label,
  items,
  onEdit,
}: {
  label: string;
  items: RawStockMovement[];
  onEdit: (movement: RawStockMovement) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">DO</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Type</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Count</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap">
                Weight
              </th>
              <th className="w-12 px-3 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((m) => (
              <tr key={m.id} className="hover:bg-sidebar/40">
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  {formatShortDate(m.movementDate)}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2.5">
                  {movementSourceLabel(m)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                  {m.doNumber ?? "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {CATEGORY_LABELS[m.category]}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium tabular-nums">
                  {m.countLabel}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <MovementWeight movement={m} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(m)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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

function CategoryStockPanel({
  title,
  subtitle,
  rows,
  totalKg,
}: {
  title: string;
  subtitle: string;
  rows: CountBalance[];
  totalKg: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <p className="text-sm font-medium tabular-nums">{formatKg(totalKg)}</p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.countLabel}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="font-medium">{row.countLabel}</span>
            <span
              className={`tabular-nums text-sm ${
                row.narelaKg < -0.0005
                  ? "text-red-600"
                  : row.narelaKg < 0.0005
                    ? "text-muted"
                    : ""
              }`}
            >
              {formatKg(row.narelaKg)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReportTable({
  title,
  rows,
  totals,
}: {
  title: string;
  rows: MonthReportRow[];
  totals: Omit<MonthReportRow, "category" | "countLabel">;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium">{title}</h3>
      </div>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="px-4 py-2 font-medium">Count</th>
            <th className="px-4 py-2 font-medium text-right">Opening</th>
            <th className="px-4 py-2 font-medium text-right">Stock in</th>
            <th className="px-4 py-2 font-medium text-right">Sent to Rama</th>
            <th className="px-4 py-2 font-medium text-right">Closing</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.countLabel}>
              <td className="px-4 py-2.5 font-medium">{row.countLabel}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatKg(row.openingKg)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatKg(row.stockInKg)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatKg(row.stockOutKg)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                {formatKg(row.closingKg)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-sidebar/40">
            <td className="px-4 py-2.5 font-medium">Total</td>
            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
              {formatKg(totals.openingKg)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
              {formatKg(totals.stockInKg)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
              {formatKg(totals.stockOutKg)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
              {formatKg(totals.closingKg)}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
