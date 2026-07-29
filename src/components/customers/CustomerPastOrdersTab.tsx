"use client";

import { useEffect, useState } from "react";
import { CustomerOrderSidebar } from "@/components/customer-orders/CustomerOrderSidebar";
import type { PriceListItem } from "@/lib/auth/types";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrder,
  type CustomerOrderStatus,
} from "@/lib/customer-orders/types";
import {
  formatINR,
  formatShortDate,
  formatShortTime,
} from "@/lib/salesmen/mock-data";
import type { Invoice, Salesman } from "@/lib/salesmen/types";

type CustomerPastOrdersTabProps = {
  orders: CustomerOrder[];
  invoices?: Invoice[];
  customer: Salesman;
  priceList: PriceListItem[];
  title?: string;
  onOrderUpdated?: (order: CustomerOrder) => void;
  onOrderDeleted?: (orderId: string) => void;
  onRequestInvoice?: (orderId: string) => void;
};

function statusTone(status: CustomerOrderStatus): string {
  switch (status) {
    case "draft":
      return "bg-sidebar text-muted";
    case "picking":
      return "bg-amber-50 text-amber-900";
    case "packed":
      return "bg-sky-50 text-sky-900";
    case "invoiced":
      return "bg-emerald-50 text-emerald-900";
    case "out_for_delivery":
      return "bg-indigo-50 text-indigo-900";
    case "delivered":
      return "bg-teal-50 text-teal-900";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sidebar text-muted";
  }
}

function PastOrderCard({
  order,
  invoice,
  selected,
  onOpen,
}: {
  order: CustomerOrder;
  invoice?: Invoice;
  selected: boolean;
  onOpen: () => void;
}) {
  const slips = order.attachments.filter((a) => a.kind === "order_slip");
  const patches = order.attachments.filter((a) => a.kind === "cloth_patch");
  const orderTime = formatShortTime(order.createdAt);
  const meta: string[] = [];
  if (order.lineCount > 0) {
    meta.push(`${order.lineCount} item${order.lineCount === 1 ? "" : "s"}`);
  }
  if (slips.length > 0) {
    meta.push(`${slips.length} slip${slips.length === 1 ? "" : "s"}`);
  }
  if (patches.length > 0) {
    meta.push(`${patches.length} patch${patches.length === 1 ? "" : "es"}`);
  }
  if (order.deliveryByName) {
    meta.push(`Delivery: ${order.deliveryByName}`);
  }
  if (invoice) {
    meta.push(`Invoice ${invoice.number}`);
  }

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-pressed={selected}
        className={`w-full rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-colors hover:bg-sidebar/40 ${
          selected ? "ring-2 ring-foreground/20" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">
                {formatShortDate(order.orderDate)}
                {orderTime ? (
                  <span className="font-normal text-muted">
                    {" "}
                    · {orderTime}
                  </span>
                ) : null}
              </p>
              {order.isUrgent ? (
                <span className="inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                  Urgent
                </span>
              ) : null}
            </div>
            {meta.length > 0 ? (
              <p className="mt-1 truncate text-xs text-muted">
                {meta.join(" · ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">No line items yet</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(order.status)}`}
            >
              {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
            </span>
            {order.amount > 0 ? (
              <span className="text-sm font-medium">
                {formatINR(order.amount)}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

export function CustomerPastOrdersTab({
  orders,
  invoices = [],
  customer,
  priceList,
  title = "Past Orders",
  onOrderUpdated,
  onOrderDeleted,
  onRequestInvoice,
}: CustomerPastOrdersTabProps) {
  const [localOrders, setLocalOrders] = useState(orders);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
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
      <ul className="space-y-2">
        {localOrders.map((order) => (
          <PastOrderCard
            key={order.id}
            order={order}
            invoice={
              order.invoiceId
                ? invoiceById.get(order.invoiceId)
                : undefined
            }
            selected={detailOrderId === order.id}
            onOpen={() => setDetailOrderId(order.id)}
          />
        ))}
      </ul>

      <CustomerOrderSidebar
        orderId={detailOrderId}
        priceList={priceList}
        customers={[customer]}
        onClose={() => setDetailOrderId(null)}
        onOrderChange={handleUpdated}
        onDeleted={(id) => {
          setLocalOrders((prev) => prev.filter((o) => o.id !== id));
          setDetailOrderId(null);
          onOrderDeleted?.(id);
        }}
        onRequestInvoice={
          onRequestInvoice
            ? (id) => {
                setDetailOrderId(null);
                onRequestInvoice(id);
              }
            : undefined
        }
      />
    </div>
  );
}
