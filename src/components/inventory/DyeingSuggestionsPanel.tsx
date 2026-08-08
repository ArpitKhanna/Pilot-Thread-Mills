"use client";

import type { DyeingSuggestion } from "@/lib/inventory/types";

type DyeingSuggestionsPanelProps = {
  suggestions: DyeingSuggestion[];
  busy: boolean;
  onApprove: (shadeIds: string[]) => void;
  onRefresh: () => void;
};

export function DyeingSuggestionsPanel({
  suggestions,
  busy,
  onApprove,
  onRefresh,
}: DyeingSuggestionsPanelProps) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">No replenishment suggestions right now.</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-3 text-sm text-foreground underline"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Normal-tier shades below threshold — approve to queue dyeing.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          className="text-sm underline disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border bg-sidebar/60 text-left text-xs text-muted">
              <th className="px-3 py-2">Shade</th>
              <th className="px-3 py-2">On hand</th>
              <th className="px-3 py-2">Min</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Dye qty</th>
              <th className="px-3 py-2">30d out</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.shadeId} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{s.shadeCode}</td>
                <td className="px-3 py-2 tabular-nums">{s.onHand}</td>
                <td className="px-3 py-2 tabular-nums">{s.minThreshold}</td>
                <td className="px-3 py-2 tabular-nums">{s.targetLevel}</td>
                <td className="px-3 py-2 tabular-nums">{s.suggestedQty}</td>
                <td className="px-3 py-2 tabular-nums">{s.velocity30d}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApprove([s.shadeId])}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-sidebar disabled:opacity-50"
                  >
                    Approve
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onApprove(suggestions.map((s) => s.shadeId))}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-sidebar disabled:opacity-50"
      >
        Approve all
      </button>
    </div>
  );
}
