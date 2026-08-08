"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { CustomerOrder, CustomerOrderLine } from "@/lib/customer-orders/types";
import { ORDER_LINE_UNIT_LABELS } from "@/lib/customer-orders/types";
import { ELLFA_270_ITEM_NAME } from "@/lib/inventory/ellfa-shades";

type PackLineDraft = {
  lineId: string;
  itemName: string;
  shadeCode: string;
  orderedQty: number;
  unit: string;
  available: number;
  fulfilledQty: string;
  isEllfaDibbi: boolean;
};

type PackOrderModalProps = {
  open: boolean;
  order: CustomerOrder;
  ellfa270ItemId: string | null;
  onClose: () => void;
  onPacked: (summary: {
    stockOutCount: number;
    missingCount: number;
    autoDyeingJobs: number;
  }) => void;
};

export function PackOrderModal({
  open,
  order,
  ellfa270ItemId,
  onClose,
  onPacked,
}: PackOrderModalProps) {
  const [lines, setLines] = useState<PackLineDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ellfaItem = useMemo(
    () => order.lines.some((l) => l.priceListItemId === ellfa270ItemId),
    [order.lines, ellfa270ItemId],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const lineIds = order.lines.map((l) => l.id).join(",");
        const availRes = await fetch(
          `/api/inventory/pack-order?lineIds=${encodeURIComponent(lineIds)}`,
        );
        const availData = await availRes.json();
        const available: Record<string, number> = availRes.ok
          ? (availData.available ?? {})
          : {};

        if (cancelled) return;

        setLines(
          order.lines.map((line) => buildDraft(line, available[line.id] ?? 0)),
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load stock");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, order.lines]);

  function buildDraft(
    line: CustomerOrderLine,
    available: number,
  ): PackLineDraft {
    const isEllfaDibbi =
      line.unit === "dibbi" &&
      Boolean(ellfa270ItemId && line.priceListItemId === ellfa270ItemId);
    const orderedQty = line.qty;
    const defaultFulfilled =
      line.fulfilledQty != null
        ? line.fulfilledQty
        : isEllfaDibbi
          ? Math.min(orderedQty, available)
          : orderedQty;

    return {
      lineId: line.id,
      itemName: line.itemName ?? "Item",
      shadeCode: line.shadeCode,
      orderedQty,
      unit: ORDER_LINE_UNIT_LABELS[line.unit],
      available,
      fulfilledQty: String(defaultFulfilled),
      isEllfaDibbi,
    };
  }

  async function confirmPack() {
    setBusy(true);
    setError("");
    try {
      const payload = lines.map((l) => ({
        lineId: l.lineId,
        fulfilledQty: Number(l.fulfilledQty),
      }));

      for (const l of lines) {
        const fulfilled = Number(l.fulfilledQty);
        if (Number.isNaN(fulfilled) || fulfilled < 0 || fulfilled > l.orderedQty) {
          throw new Error(`Invalid fulfilled qty for shade ${l.shadeCode}`);
        }
      }

      const res = await fetch("/api/inventory/pack-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, lines: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pack failed");

      onPacked({
        stockOutCount: data.stockOutCount ?? 0,
        missingCount: data.missingCount ?? 0,
        autoDyeingJobs: data.autoDyeingJobs ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pack failed");
    } finally {
      setBusy(false);
    }
  }

  const missingCount = lines.filter(
    (l) => Number(l.fulfilledQty) < l.orderedQty,
  ).length;

  return (
    <Modal open={open} onClose={onClose} title="Pack order">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Enter how many dibbis were picked for each line. Stock is deducted for{" "}
          {ELLFA_270_ITEM_NAME} shades; shortfalls are queued for dyeing.
        </p>

        {ellfaItem ? null : (
          <p className="rounded-md border border-border bg-sidebar/50 px-3 py-2 text-xs text-muted">
            Only {ELLFA_270_ITEM_NAME} dibbi lines affect finished stock. Other
            lines record fulfilled qty only.
          </p>
        )}

        {error ? (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted">Loading available stock…</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-sidebar/60 text-left text-xs text-muted">
                  <th className="px-3 py-2">Item / shade</th>
                  <th className="px-3 py-2">Ordered</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Picked</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const fulfilled = Number(line.fulfilledQty);
                  const short =
                    !Number.isNaN(fulfilled) && fulfilled < line.orderedQty;
                  return (
                    <tr
                      key={line.lineId}
                      className={`border-b border-border last:border-0 ${short ? "bg-amber-50/80 dark:bg-amber-950/20" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{line.itemName}</div>
                        <div className="text-xs text-muted">{line.shadeCode}</div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {line.orderedQty} {line.unit}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {line.isEllfaDibbi ? line.available : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={line.orderedQty}
                          step={1}
                          value={line.fulfilledQty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((row) =>
                                row.lineId === line.lineId
                                  ? { ...row, fulfilledQty: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {missingCount > 0 ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {missingCount} line(s) partially missing — will be queued for dyeing.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-sidebar disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmPack()}
            disabled={busy || loading}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {busy ? "Packing…" : "Confirm & mark packed"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
