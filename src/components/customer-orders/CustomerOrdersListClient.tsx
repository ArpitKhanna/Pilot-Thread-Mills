"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { NewCustomerOrderModal } from "@/components/customer-orders/NewCustomerOrderModal";
import { TopBar } from "@/components/layout/AppShell";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import { PendingLink } from "@/components/ui/PendingLink";
import type { PriceListItem } from "@/lib/auth/types";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  ORDER_LINE_UNIT_LABELS,
  type CustomerOrder,
  type CustomerOrderLineUnit,
  type CustomerOrderStatus,
  type DeliveryStaff,
} from "@/lib/customer-orders/types";
import { formatINR, formatShortDate } from "@/lib/salesmen/mock-data";
import {
  MARKET_DAY_LABELS,
  type MarketDay,
  type Salesman,
} from "@/lib/salesmen/types";

type CustomerOrdersListClientProps = {
  context: AppContext;
  initialOrders: CustomerOrder[];
  customers: Salesman[];
  priceList: PriceListItem[];
  deliveryStaff: DeliveryStaff[];
};

const STATUS_FILTERS: Array<CustomerOrderStatus | "all"> = [
  "all",
  "draft",
  "ready",
  "packed",
  "invoiced",
  "cancelled",
];

const WEEKDAY_TO_MARKET: Record<number, MarketDay> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

type MissingDraft = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
};

function statusTone(status: CustomerOrderStatus): string {
  switch (status) {
    case "draft":
      return "bg-sidebar text-muted";
    case "ready":
      return "bg-amber-50 text-amber-900";
    case "packed":
      return "bg-sky-50 text-sky-900";
    case "invoiced":
      return "bg-emerald-50 text-emerald-900";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sidebar text-muted";
  }
}

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyMissingLine(): MissingDraft {
  return {
    key: crypto.randomUUID(),
    priceListItemId: null,
    itemName: "",
    shadeCode: "",
    qty: "1",
    unit: "box",
  };
}

export function CustomerOrdersListClient({
  context,
  initialOrders,
  customers,
  priceList,
  deliveryStaff,
}: CustomerOrdersListClientProps) {
  const router = useRouter();
  const [orders] = useState(initialOrders);
  const [status, setStatus] = useState<CustomerOrderStatus | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [initialCustomerId, setInitialCustomerId] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [runOpen, setRunOpen] = useState(false);
  const [deliveryBy, setDeliveryBy] = useState("");
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingCustomerId, setMissingCustomerId] = useState("");
  const [missingDate, setMissingDate] = useState(todayLocalDate);
  const [missingLines, setMissingLines] = useState<MissingDraft[]>([
    emptyMissingLine(),
  ]);
  const [missingBusy, setMissingBusy] = useState(false);
  const [missingError, setMissingError] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const order of orders) {
      const area = (order.areaSnapshot || order.customerArea || "").trim();
      if (area) set.add(area);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const todayMarket = WEEKDAY_TO_MARKET[new Date().getDay()]!;
  const marketCustomers = useMemo(
    () =>
      customers.filter(
        (c) => c.isActive && c.marketDay === todayMarket,
      ),
    [customers, todayMarket],
  );

  const displayed = useMemo(() => {
    const filtered = orders.filter((order) => {
      if (dateFilter && order.orderDate.slice(0, 10) !== dateFilter) {
        return false;
      }
      if (status !== "all" && order.status !== status) return false;
      const area = (order.areaSnapshot || order.customerArea || "").trim();
      if (areaFilter !== "all" && area !== areaFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        (order.customerName ?? "").toLowerCase().includes(q) ||
        area.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      const areaA = (a.areaSnapshot || a.customerArea || "").toLowerCase();
      const areaB = (b.areaSnapshot || b.customerArea || "").toLowerCase();
      if (areaA !== areaB) return areaA.localeCompare(areaB);
      return b.orderDate.localeCompare(a.orderDate);
    });
  }, [orders, status, dateFilter, areaFilter, search]);

  const selectedPacked = useMemo(
    () =>
      displayed.filter(
        (o) => selected.has(o.id) && o.status === "packed",
      ),
    [displayed, selected],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openNewOrder(customerId?: string) {
    setInitialCustomerId(customerId);
    setNewOpen(true);
  }

  async function submitDeliveryRun() {
    if (selectedPacked.length === 0) {
      setRunError("Select at least one packed order");
      return;
    }
    if (!deliveryBy) {
      setRunError("Select a delivery person");
      return;
    }
    setRunBusy(true);
    setRunError("");
    try {
      const area =
        areaFilter !== "all"
          ? areaFilter
          : selectedPacked[0]?.customerArea ||
            selectedPacked[0]?.areaSnapshot ||
            null;
      const res = await fetch("/api/delivery-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedPacked.map((o) => o.id),
          deliveryBy,
          area,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Delivery run failed");
      setRunOpen(false);
      setSelected(new Set());
      setDeliveryBy("");
      router.refresh();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Delivery run failed");
    } finally {
      setRunBusy(false);
    }
  }

  async function submitMissing() {
    if (!missingCustomerId) {
      setMissingError("Select a customer");
      return;
    }
    const items = missingLines
      .filter((l) => l.shadeCode.trim() && Number(l.qty) > 0)
      .map((l) => ({
        priceListItemId: l.priceListItemId,
        shadeCode: l.shadeCode.trim(),
        qty: Number(l.qty),
        unit: l.unit,
      }));
    if (items.length === 0) {
      setMissingError("Add at least one missing shade line");
      return;
    }
    setMissingBusy(true);
    setMissingError("");
    setWhatsappUrl(null);
    try {
      const res = await fetch("/api/customer-pending-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: missingCustomerId,
          invoiceDate: missingDate,
          items,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        whatsappUrl?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setWhatsappUrl(json.whatsappUrl ?? null);
      setMissingLines([emptyMissingLine()]);
      router.refresh();
    } catch (e) {
      setMissingError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setMissingBusy(false);
    }
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Orders" },
          { label: "Customers" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Customer Orders
            </h1>
            <p className="mt-1 text-sm text-muted">
              Ready → packed → delivery run invoice. Missing shades at end of day.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setWhatsappUrl(null);
                setMissingOpen(true);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium hover:bg-sidebar"
            >
              EOD missing
            </button>
            <button
              type="button"
              disabled={selectedPacked.length === 0}
              onClick={() => {
                setRunError("");
                setRunOpen(true);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
            >
              Delivery run ({selectedPacked.length})
            </button>
            <button
              type="button"
              onClick={() => openNewOrder()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              <span className="text-lg leading-none">+</span>
              New Order
            </button>
          </div>
        </div>

        {marketCustomers.length > 0 ? (
          <section className="mb-5 rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                Daily market call list · {MARKET_DAY_LABELS[todayMarket]}
              </h2>
              <span className="text-xs text-muted">
                {marketCustomers.length} customers
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {marketCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openNewOrder(c.id)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-sidebar"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted">
                    {c.phone || "No phone"} · New order
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
            {STATUS_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`shrink-0 rounded-md px-3 py-2 text-sm sm:py-1.5 ${
                  status === value
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {value === "all"
                  ? "All"
                  : CUSTOMER_ORDER_STATUS_LABELS[value]}
              </button>
            ))}
          </div>

          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-muted">
              Date
            </span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-36"
            />
            {dateFilter ? (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="text-xs text-muted hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </label>

          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-muted">
              Area
            </span>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-40"
            >
              <option value="all">All areas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>

          <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:ml-auto sm:max-w-xs sm:py-2">
            <input
              type="search"
              placeholder="Search customer or area"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            No orders match these filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-sidebar/50 text-muted">
                <tr>
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Area
                  </th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((order) => {
                  const area =
                    order.areaSnapshot || order.customerArea || "—";
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-0 hover:bg-sidebar/40"
                    >
                      <td className="px-3 py-3">
                        {order.status === "packed" ? (
                          <input
                            type="checkbox"
                            checked={selected.has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                            aria-label={`Select ${order.customerName}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <PendingLink
                          href={`/orders/customers/${order.id}`}
                          className="font-medium hover:underline"
                        >
                          {order.customerName ?? "Customer"}
                        </PendingLink>
                        {order.isUrgent ? (
                          <span className="ml-2 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                            Urgent
                          </span>
                        ) : null}
                        <div className="mt-0.5 text-xs text-muted md:hidden">
                          {area} · {formatShortDate(order.orderDate)}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted md:table-cell">
                        {area}
                      </td>
                      <td className="hidden px-4 py-3 text-muted sm:table-cell">
                        {formatShortDate(order.orderDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusTone(order.status)}`}
                        >
                          {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 tabular-nums text-muted lg:table-cell">
                        {formatINR(order.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <NewCustomerOrderModal
        open={newOpen}
        onClose={() => {
          setNewOpen(false);
          setInitialCustomerId(undefined);
        }}
        customers={customers}
        priceList={priceList}
        initialCustomerId={initialCustomerId}
      />

      <Modal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title="Start delivery run"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Invoice {selectedPacked.length} packed order
            {selectedPacked.length === 1 ? "" : "s"} and assign one delivery
            person.
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {selectedPacked.map((o) => (
              <li key={o.id}>
                {o.customerName}
                {o.isUrgent ? " · Urgent" : ""}
              </li>
            ))}
          </ul>
          {runError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {runError}
            </p>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Delivery by</span>
            <select
              value={deliveryBy}
              onChange={(e) => setDeliveryBy(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Select person…</option>
              {deliveryStaff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRunOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={runBusy || !deliveryBy}
              onClick={() => void submitDeliveryRun()}
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
            >
              {runBusy ? "Invoicing…" : "Invoice & assign"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        title="End-of-day missing items"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Upload missing shades from pick sheets. Creates dyeing jobs and a
            WhatsApp message.
          </p>
          {missingError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {missingError}
            </p>
          ) : null}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
            >
              Open WhatsApp missing list →
            </a>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Customer</span>
            <select
              value={missingCustomerId}
              onChange={(e) => setMissingCustomerId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Invoice / order date</span>
            <input
              type="date"
              value={missingDate}
              onChange={(e) => setMissingDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
            />
          </label>
          <div className="space-y-2">
            {missingLines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.5fr_0.6fr]"
              >
                <ItemNameCombobox
                  items={priceList}
                  value={line.itemName}
                  onChange={(value) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, itemName: value, priceListItemId: null }
                          : l,
                      ),
                    )
                  }
                  onSelect={(item) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? {
                              ...l,
                              itemName: item.item_name,
                              priceListItemId: item.id,
                            }
                          : l,
                      ),
                    )
                  }
                  onTabToQty={() => undefined}
                  showPrice={false}
                  placeholder="Item"
                />
                <input
                  value={line.shadeCode}
                  onChange={(e) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, shadeCode: e.target.value }
                          : l,
                      ),
                    )
                  }
                  placeholder="Shade"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <input
                  value={line.qty}
                  onChange={(e) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, qty: e.target.value }
                          : l,
                      ),
                    )
                  }
                  placeholder="Qty"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <select
                  value={line.unit}
                  onChange={(e) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? {
                              ...l,
                              unit: e.target.value as CustomerOrderLineUnit,
                            }
                          : l,
                      ),
                    )
                  }
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none"
                >
                  {Object.entries(ORDER_LINE_UNIT_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setMissingLines((prev) => [...prev, emptyMissingLine()])
              }
              className="text-sm font-medium text-muted hover:text-foreground"
            >
              + Add line
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMissingOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              Close
            </button>
            <button
              type="button"
              disabled={missingBusy}
              onClick={() => void submitMissing()}
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
            >
              {missingBusy ? "Saving…" : "Save & queue dyeing"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
