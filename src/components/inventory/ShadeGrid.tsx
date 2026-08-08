"use client";

import { useMemo, useState } from "react";
import type { ShadeBalance } from "@/lib/inventory/types";
import { VELOCITY_TIER_LABELS } from "@/lib/inventory/types";

type ShadeGridProps = {
  balances: ShadeBalance[];
  openingMode: boolean;
  openingDraft: Record<string, string>;
  onOpeningDraftChange: (shadeId: string, value: string) => void;
  filter: "all" | "in_stock" | "out_of_stock" | "fast" | "slow";
  onThresholdChange?: (
    shadeId: string,
    min: number | null,
    target: number | null,
  ) => void;
};

function cellClass(balance: ShadeBalance): string {
  if (balance.outOfStock) return "border-red-300 bg-red-50 dark:bg-red-950/30";
  if (balance.belowThreshold) return "border-amber-300 bg-amber-50 dark:bg-amber-950/30";
  if (balance.onHand > 0) return "border-border bg-surface";
  return "border-border bg-sidebar/40";
}

export function ShadeGrid({
  balances,
  openingMode,
  openingDraft,
  onOpeningDraftChange,
  filter,
  onThresholdChange,
}: ShadeGridProps) {
  const [expandedShade, setExpandedShade] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return balances.filter((b) => {
      if (filter === "in_stock") return b.onHand > 0;
      if (filter === "out_of_stock") return b.onHand <= 0;
      if (filter === "fast") return b.velocityTier === "fast";
      if (filter === "slow")
        return b.velocityTier === "slow" || b.velocityTier === "dead";
      return true;
    });
  }, [balances, filter]);

  const byColumn = useMemo(() => {
    const map = new Map<number, ShadeBalance[]>();
    for (const balance of filtered) {
      const col = balance.cardColumn ?? 0;
      if (!map.has(col)) map.set(col, []);
      map.get(col)!.push(balance);
    }
    for (const [, items] of map) {
      items.sort((a, b) => (a.cardRow ?? 0) - (b.cardRow ?? 0));
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [filtered]);

  if (byColumn.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No shades match this filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {byColumn.map(([column, items]) => (
          <div key={column} className="w-[88px] shrink-0">
            <div className="mb-2 flex h-8 items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background">
              {column || "—"}
            </div>
            <div className="space-y-1">
              {items.map((balance) => {
                const draft = openingDraft[balance.shadeId];
                const displayQty = openingMode
                  ? draft ?? String(balance.onHand || "")
                  : String(balance.onHand);
                const isExpanded = expandedShade === balance.shadeId;

                return (
                  <div
                    key={balance.shadeId}
                    className={`rounded border px-1.5 py-1 text-center ${cellClass(balance)}`}
                  >
                    <div className="flex items-center justify-between gap-0.5">
                      <span className="truncate text-[10px] font-medium leading-tight">
                        {balance.shadeCode}
                      </span>
                      {balance.colorHex ? (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: balance.colorHex }}
                        />
                      ) : null}
                    </div>
                    {openingMode ? (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={displayQty}
                        onChange={(e) =>
                          onOpeningDraftChange(balance.shadeId, e.target.value)
                        }
                        className="mt-0.5 w-full rounded border border-border bg-background px-1 py-0.5 text-center text-xs"
                      />
                    ) : (
                      <div className="mt-0.5 text-xs font-semibold tabular-nums">
                        {balance.onHand}
                      </div>
                    )}
                    {!openingMode && balance.velocityTier !== "dead" ? (
                      <div className="mt-0.5 text-[9px] text-muted">
                        {VELOCITY_TIER_LABELS[balance.velocityTier]}
                        {balance.effectiveMinThreshold != null
                          ? ` · min ${balance.effectiveMinThreshold}`
                          : ""}
                      </div>
                    ) : null}
                    {!openingMode && onThresholdChange ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedShade(isExpanded ? null : balance.shadeId)
                        }
                        className="mt-0.5 text-[9px] text-muted underline"
                      >
                        {isExpanded ? "Close" : "Threshold"}
                      </button>
                    ) : null}
                    {isExpanded && onThresholdChange ? (
                      <div className="mt-1 space-y-1 border-t border-border pt-1">
                        <input
                          type="number"
                          min={0}
                          placeholder="Min"
                          defaultValue={
                            balance.minStockThreshold ??
                            balance.effectiveMinThreshold ??
                            ""
                          }
                          className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                          onBlur={(e) => {
                            const min = e.target.value
                              ? Number(e.target.value)
                              : null;
                            onThresholdChange(
                              balance.shadeId,
                              min,
                              balance.targetStockLevel,
                            );
                          }}
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Target"
                          defaultValue={
                            balance.targetStockLevel ??
                            balance.effectiveTargetLevel ??
                            ""
                          }
                          className="w-full rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                          onBlur={(e) => {
                            const target = e.target.value
                              ? Number(e.target.value)
                              : null;
                            onThresholdChange(
                              balance.shadeId,
                              balance.minStockThreshold,
                              target,
                            );
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
