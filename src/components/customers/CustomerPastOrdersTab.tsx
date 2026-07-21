"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PendingLink } from "@/components/ui/PendingLink";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrder,
  type CustomerOrderAttachment,
  type CustomerOrderStatus,
} from "@/lib/customer-orders/types";
import { formatINR, formatShortDate } from "@/lib/salesmen/mock-data";
import type { Invoice } from "@/lib/salesmen/types";

type CustomerPastOrdersTabProps = {
  orders: CustomerOrder[];
  invoices?: Invoice[];
  title?: string;
  onOrderUpdated?: (order: CustomerOrder) => void;
};

function statusTone(status: CustomerOrderStatus): string {
  switch (status) {
    case "draft":
      return "bg-sidebar text-muted";
    case "confirmed":
      return "bg-amber-50 text-amber-900";
    case "picking":
      return "bg-sky-50 text-sky-900";
    case "invoiced":
      return "bg-emerald-50 text-emerald-900";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sidebar text-muted";
  }
}

function isImageAttachment(attachment: CustomerOrderAttachment): boolean {
  return Boolean(
    attachment.signedUrl &&
      (attachment.contentType?.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif)$/i.test(attachment.fileName ?? "")),
  );
}

function AttachmentThumb({
  attachment,
  label,
  onOpen,
}: {
  attachment: CustomerOrderAttachment;
  label: string;
  onOpen: () => void;
}) {
  if (isImageAttachment(attachment)) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-sidebar"
        title={label}
        aria-label={`Preview ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.signedUrl!}
          alt={attachment.fileName ?? label}
          className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
        />
      </button>
    );
  }

  return (
    <span
      className="inline-flex h-14 min-w-14 items-center justify-center rounded-lg border border-dashed border-border px-2 text-center text-[10px] text-muted"
      title={attachment.fileName ?? label}
    >
      {label}
    </span>
  );
}

function PastOrderRow({
  order,
  invoice,
  onOrderUpdated,
}: {
  order: CustomerOrder;
  invoice?: Invoice;
  onOrderUpdated?: (order: CustomerOrder) => void;
}) {
  const [preview, setPreview] = useState<CustomerOrderAttachment | null>(null);
  const [shadeDraft, setShadeDraft] = useState("");
  const [editingShade, setEditingShade] = useState(false);
  const [savingShade, setSavingShade] = useState(false);
  const [shadeError, setShadeError] = useState<string | null>(null);

  const slips = order.attachments.filter((a) => a.kind === "order_slip");
  const patches = order.attachments.filter((a) => a.kind === "cloth_patch");
  const hasCustomPatch = patches.length > 0;
  const canEditShade =
    hasCustomPatch &&
    order.status !== "invoiced" &&
    order.status !== "cancelled" &&
    order.lines.length > 0;
  const targetLine =
    order.lines.find((l) => !l.shadeCode.trim()) ?? order.lines[0] ?? null;
  const existingShades = [
    ...new Set(
      order.lines.map((l) => l.shadeCode.trim()).filter(Boolean),
    ),
  ];

  const showViewInvoice =
    order.status !== "draft" &&
    order.status !== "cancelled" &&
    Boolean(order.invoiceId);

  async function saveShade() {
    if (!targetLine) return;
    const code = shadeDraft.trim();
    if (!code) {
      setShadeError("Enter a shade number");
      return;
    }
    const missingOther = order.lines.some(
      (line) => line.id !== targetLine.id && !line.shadeCode.trim(),
    );
    if (missingOther) {
      setShadeError("Other lines are missing shade numbers — open the order to edit them.");
      return;
    }

    setSavingShade(true);
    setShadeError(null);
    try {
      const payload = order.lines.map((line) => ({
        priceListItemId: line.priceListItemId,
        shadeId: line.id === targetLine.id ? null : line.shadeId,
        shadeCode:
          line.id === targetLine.id ? code : line.shadeCode.trim(),
        qty: line.qty,
        unit: line.unit,
        source: line.source,
      }));
      const res = await fetch(`/api/customer-orders/${order.id}/lines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: payload }),
      });
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Could not save shade");
      }
      onOrderUpdated?.(json.order);
      setEditingShade(false);
      setShadeDraft("");
    } catch (e) {
      setShadeError(e instanceof Error ? e.message : "Could not save shade");
    } finally {
      setSavingShade(false);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <PendingLink
            href={`/orders/customers/${order.id}`}
            className="block min-w-0 hover:underline"
          >
            <p className="truncate text-sm font-medium">
              {formatShortDate(order.orderDate)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {order.lineCount} item{order.lineCount === 1 ? "" : "s"}
              {order.deliveryByName
                ? ` · Delivery: ${order.deliveryByName}`
                : ""}
              {invoice ? ` · Invoice ${invoice.number}` : ""}
            </p>
          </PendingLink>

          {hasCustomPatch && (
            <div className="space-y-2 rounded-lg border border-border bg-sidebar/40 px-3 py-2">
              <p className="text-xs font-medium text-muted">
                Custom match — shade number
              </p>
              {existingShades.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {existingShades.map((code) => (
                    <span
                      key={code}
                      className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No shade number yet</p>
              )}
              {canEditShade && targetLine ? (
                editingShade ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={shadeDraft}
                      onChange={(e) => setShadeDraft(e.target.value)}
                      placeholder="Shade no."
                      className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-foreground"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={savingShade}
                      onClick={() => void saveShade()}
                      className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-surface disabled:opacity-60"
                    >
                      {savingShade ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={savingShade}
                      onClick={() => {
                        setEditingShade(false);
                        setShadeDraft("");
                        setShadeError(null);
                      }}
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingShade(true);
                      setShadeDraft(targetLine.shadeCode || "");
                      setShadeError(null);
                    }}
                    className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {targetLine.shadeCode.trim()
                      ? "Edit shade number"
                      : "Add shade number"}
                  </button>
                )
              ) : null}
              {shadeError ? (
                <p className="text-xs text-red-700">{shadeError}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          {(slips.length > 0 || patches.length > 0) && (
            <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
              {slips.map((slip) => (
                <div key={slip.id} className="space-y-1 text-center">
                  <AttachmentThumb
                    attachment={slip}
                    label="WhatsApp"
                    onOpen={() => setPreview(slip)}
                  />
                  <p className="text-[10px] text-muted">Order slip</p>
                </div>
              ))}
              {patches.map((patch) => (
                <div key={patch.id} className="space-y-1 text-center">
                  <AttachmentThumb
                    attachment={patch}
                    label="Patch"
                    onOpen={() => setPreview(patch)}
                  />
                  <p className="text-[10px] text-muted">Sample / patch</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col items-stretch gap-2 sm:min-w-[7.5rem] sm:items-end">
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(order.status)}`}
              >
                {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
              </span>
              <span className="text-sm font-medium">
                {formatINR(order.amount)}
              </span>
            </div>
            {showViewInvoice ? (
              <PendingLink
                href={`/orders/salesmen/${order.invoiceId}/edit`}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-sidebar"
              >
                View Invoice
              </PendingLink>
            ) : order.status !== "draft" && order.status !== "cancelled" ? (
              <PendingLink
                href={`/orders/customers/${order.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-sidebar"
              >
                Open order
              </PendingLink>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={
          preview?.kind === "cloth_patch"
            ? "Sample / patch"
            : "Order WhatsApp screenshot"
        }
        size="lg"
      >
        {preview && isImageAttachment(preview) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.signedUrl!}
            alt={preview.fileName ?? "Attachment"}
            className="max-h-[70vh] w-full rounded-lg object-contain bg-sidebar"
          />
        ) : (
          <p className="text-sm text-muted">
            {preview?.fileName ?? "No preview available"}
          </p>
        )}
      </Modal>
    </li>
  );
}

export function CustomerPastOrdersTab({
  orders,
  invoices = [],
  title = "Past Orders",
  onOrderUpdated,
}: CustomerPastOrdersTabProps) {
  const [localOrders, setLocalOrders] = useState(orders);
  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  function handleUpdated(order: CustomerOrder) {
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === order.id ? order : o)),
    );
    onOrderUpdated?.(order);
  }

  if (localOrders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
        No {title.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium tracking-tight">
        {title} ({localOrders.length})
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {localOrders.map((order) => (
          <PastOrderRow
            key={order.id}
            order={order}
            invoice={
              order.invoiceId
                ? invoiceById.get(order.invoiceId)
                : undefined
            }
            onOrderUpdated={handleUpdated}
          />
        ))}
      </ul>
    </div>
  );
}
