"use client";

import { useCallback, useMemo, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { AppPage } from "@/components/layout/AppShell";
import { DyeingSuggestionsPanel } from "@/components/inventory/DyeingSuggestionsPanel";
import { ShadeGrid } from "@/components/inventory/ShadeGrid";
import { ELLFA_270_ITEM_NAME } from "@/lib/inventory/ellfa-shades";
import type {
  DyeingSuggestion,
  FinishedStockMovement,
  ShadeBalance,
} from "@/lib/inventory/types";
import {
  MOVEMENT_TYPE_LABELS,
  VELOCITY_TIER_LABELS,
} from "@/lib/inventory/types";
import { formatShortDate } from "@/lib/salesmen/mock-data";
import { useSyncedState } from "@/lib/realtime/use-synced-state";

type TabId = "grid" | "trends" | "movements" | "suggestions";

type InventorySummary = {
  totalSkus: number;
  outOfStock: number;
  belowThreshold: number;
  fastMovers: number;
  totalOnHand: number;
};

type InventoryClientProps = {
  context: AppContext;
  initialBalances: ShadeBalance[];
  initialMovements: FinishedStockMovement[];
  initialSuggestions: DyeingSuggestion[];
  initialSummary: InventorySummary;
  itemId: string;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "grid", label: "Shade card" },
  { id: "trends", label: "Trends" },
  { id: "movements", label: "Movements" },
  { id: "suggestions", label: "Dyeing suggestions" },
];

export function InventoryClient({
  context,
  initialBalances,
  initialMovements,
  initialSuggestions,
  initialSummary,
}: InventoryClientProps) {
  const [tab, setTab] = useState<TabId>("grid");
  const [filter, setFilter] = useState<
    "all" | "in_stock" | "out_of_stock" | "fast" | "slow"
  >("all");
  const [openingMode, setOpeningMode] = useState(false);
  const [openingDraft, setOpeningDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const pauseSync = openingMode || busy;
  const [balances, setBalances] = useSyncedState(initialBalances, !pauseSync);
  const [movements, setMovements] = useSyncedState(initialMovements, !pauseSync);
  const [suggestions, setSuggestions] = useSyncedState(
    initialSuggestions,
    !pauseSync,
  );
  const [summary, setSummary] = useSyncedState(initialSummary, !pauseSync);

  const trendRows = useMemo(() => {
    return [...balances].sort((a, b) => b.velocity30d - a.velocity30d);
  }, [balances]);

  const refreshAll = useCallback(async () => {
    const [balRes, movRes, sugRes] = await Promise.all([
      fetch("/api/inventory/balances"),
      fetch("/api/inventory/movements"),
      fetch("/api/inventory/dyeing-suggestions"),
    ]);
    const balData = await balRes.json();
    const movData = await movRes.json();
    const sugData = await sugRes.json();
    if (!balRes.ok) throw new Error(balData.error ?? "Failed to refresh balances");
    if (!movRes.ok) throw new Error(movData.error ?? "Failed to refresh movements");
    if (!sugRes.ok) throw new Error(sugData.error ?? "Failed to refresh suggestions");
    setBalances(balData.balances);
    setSummary(balData.summary);
    setMovements(movData.movements);
    setSuggestions(sugData.suggestions);
  }, [setBalances, setMovements, setSuggestions, setSummary]);

  async function saveOpeningBalances(replaceExisting: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const entries = balances
        .map((b) => {
          const raw = openingDraft[b.shadeId];
          const quantity =
            raw !== undefined && raw !== "" ? Number(raw) : b.onHand;
          if (Number.isNaN(quantity) || quantity < 0) return null;
          return {
            shadeId: b.shadeId,
            shadeCode: b.shadeCode,
            quantity,
          };
        })
        .filter(Boolean);

      const res = await fetch("/api/inventory/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, replaceExisting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save opening stock");
      setMessage(
        `Saved ${data.saved} opening balances${data.autoDyeingJobs ? ` · ${data.autoDyeingJobs} auto dyeing jobs queued` : ""}.`,
      );
      setOpeningMode(false);
      setOpeningDraft({});
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function handleThresholdChange(
    shadeId: string,
    min: number | null,
    target: number | null,
  ) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/inventory/shade-thresholds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ shadeId, minStockThreshold: min, targetStockLevel: target }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update threshold");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update threshold");
    } finally {
      setBusy(false);
    }
  }

  async function approveSuggestions(shadeIds: string[]) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/inventory/dyeing-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shadeIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to approve");
      setMessage(`Queued ${data.created} dyeing job(s).`);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppPage
        context={context}
        breadcrumbs={[{ label: "Inventory" }]}
        className="px-0 py-0"
      >
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-medium tracking-tight">Inventory</h1>
              <p className="mt-0.5 text-sm text-muted">
                {ELLFA_270_ITEM_NAME} dibbis — shade card stock & trends
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {openingMode ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveOpeningBalances(false)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-sidebar disabled:opacity-50"
                  >
                    Save opening stock
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveOpeningBalances(true)}
                    className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-950/30"
                  >
                    Replace all opening
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpeningMode(false);
                      setOpeningDraft({});
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-sidebar"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpeningMode(true)}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-sidebar"
                >
                  Set opening stock
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Total SKUs", value: summary.totalSkus },
              { label: "On hand", value: summary.totalOnHand },
              { label: "Out of stock", value: summary.outOfStock },
              { label: "Below threshold", value: summary.belowThreshold },
              { label: "Fast movers", value: summary.fastMovers },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              >
                <div className="text-xs text-muted">{card.label}</div>
                <div className="text-lg font-semibold tabular-nums">{card.value}</div>
              </div>
            ))}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              {message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1 border-b border-border pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  tab === t.id
                    ? "bg-foreground text-background"
                    : "text-muted hover:bg-sidebar"
                }`}
              >
                {t.label}
                {t.id === "suggestions" && suggestions.length > 0
                  ? ` (${suggestions.length})`
                  : ""}
              </button>
            ))}
          </div>

          {tab === "grid" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "All"],
                    ["in_stock", "In stock"],
                    ["out_of_stock", "Out of stock"],
                    ["fast", "Fast movers"],
                    ["slow", "Slow / dead"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      filter === id
                        ? "bg-foreground text-background"
                        : "border border-border text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ShadeGrid
                balances={balances}
                openingMode={openingMode}
                openingDraft={openingDraft}
                onOpeningDraftChange={(shadeId, value) =>
                  setOpeningDraft((prev) => ({ ...prev, [shadeId]: value }))
                }
                filter={filter}
                onThresholdChange={handleThresholdChange}
              />
            </div>
          ) : null}

          {tab === "trends" ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-sidebar/60 text-left text-xs text-muted">
                    <th className="px-3 py-2">Shade</th>
                    <th className="px-3 py-2">On hand</th>
                    <th className="px-3 py-2">7d</th>
                    <th className="px-3 py-2">30d</th>
                    <th className="px-3 py-2">90d</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {trendRows.slice(0, 200).map((row) => (
                    <tr
                      key={row.shadeId}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 font-medium">{row.shadeCode}</td>
                      <td className="px-3 py-2 tabular-nums">{row.onHand}</td>
                      <td className="px-3 py-2 tabular-nums">{row.velocity7d}</td>
                      <td className="px-3 py-2 tabular-nums">{row.velocity30d}</td>
                      <td className="px-3 py-2 tabular-nums">{row.velocity90d}</td>
                      <td className="px-3 py-2">
                        {VELOCITY_TIER_LABELS[row.velocityTier]}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.effectiveMinThreshold ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trendRows.length > 200 ? (
                <p className="px-3 py-2 text-xs text-muted">
                  Showing top 200 by 30-day velocity ({trendRows.length} total).
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "movements" ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-sidebar/60 text-left text-xs text-muted">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Shade</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.slice(0, 100).map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatShortDate(m.movementDate)}
                      </td>
                      <td className="px-3 py-2">
                        {MOVEMENT_TYPE_LABELS[m.movementType]}
                      </td>
                      <td className="px-3 py-2 font-medium">{m.shadeCode}</td>
                      <td className="px-3 py-2 tabular-nums">{m.quantity}</td>
                      <td className="px-3 py-2 text-muted">{m.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === "suggestions" ? (
            <DyeingSuggestionsPanel
              suggestions={suggestions}
              busy={busy}
              onApprove={approveSuggestions}
              onRefresh={() => void refreshAll()}
            />
          ) : null}
        </div>
      </AppPage>
    </>
  );
}
