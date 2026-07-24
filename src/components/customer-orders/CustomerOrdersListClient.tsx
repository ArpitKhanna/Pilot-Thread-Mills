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
  KANBAN_COLUMNS,
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

const WEEKDAY_TO_MARKET: Record<number, MarketDay> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const BULK_TARGET: Partial<Record<CustomerOrderStatus, CustomerOrderStatus>> = {
  picking: "packed",
  invoiced: "out_for_delivery",
  out_for_delivery: "delivered",
};

const BULK_LABEL: Partial<Record<CustomerOrderStatus, string>> = {
  picking: "Mark packed",
  packed: "Generate invoices",
  invoiced: "Mark out for delivery",
  out_for_delivery: "Mark delivered",
};

type MissingDraft = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
};

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

function sortOrders(a: CustomerOrder, b: CustomerOrder): number {
  if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
  const areaA = (a.areaSnapshot || a.customerArea || "").toLowerCase();
  const areaB = (b.areaSnapshot || b.customerArea || "").toLowerCase();
  if (areaA !== areaB) return areaA.localeCompare(areaB);
  return b.orderDate.localeCompare(a.orderDate);
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
  const [dateFilter, setDateFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [initialCustomerId, setInitialCustomerId] = useState<
    string | undefined
  >();
  const [selectColumn, setSelectColumn] = useState<CustomerOrderStatus | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [runOpen, setRunOpen] = useState(false);
  const [deliveryBy, setDeliveryBy] = useState("");
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [draftsOpen, setDraftsOpen] = useState(false);
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
    () => customers.filter((c) => c.isActive && c.marketDay === todayMarket),
    [customers, todayMarket],
  );

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (dateFilter && order.orderDate.slice(0, 10) !== dateFilter) {
        return false;
      }
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
  }, [orders, dateFilter, areaFilter, search]);

  const drafts = useMemo(
    () => filtered.filter((o) => o.status === "draft").sort(sortOrders),
    [filtered],
  );

  const columns = useMemo(() => {
    const map = Object.fromEntries(
      KANBAN_COLUMNS.map((status) => [status, [] as CustomerOrder[]]),
    ) as Record<(typeof KANBAN_COLUMNS)[number], CustomerOrder[]>;
    for (const order of filtered) {
      if (order.status in map) {
        map[order.status as (typeof KANBAN_COLUMNS)[number]].push(order);
      }
    }
    for (const status of KANBAN_COLUMNS) {
      map[status].sort(sortOrders);
    }
    return map;
  }, [filtered]);

  const selectedOrders = useMemo(
    () =>
      filtered.filter(
        (o) =>
          selected.has(o.id) &&
          selectColumn != null &&
          o.status === selectColumn,
      ),
    [filtered, selected, selectColumn],
  );

  function toggleSelect(column: CustomerOrderStatus, id: string) {
    if (selectColumn !== column) {
      setSelectColumn(column);
      setSelected(new Set([id]));
      return;
    }
    setSelected((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectColumn(null);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectColumn(null);
    setBulkError("");
  }

  function openNewOrder(customerId?: string) {
    setInitialCustomerId(customerId);
    setNewOpen(true);
  }

  async function patchStatuses(
    ids: string[],
    status: CustomerOrderStatus,
  ): Promise<void> {
    for (const id of ids) {
      const res = await fetch(`/api/customer-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update order");
    }
  }

  async function submitBulkStatus() {
    if (!selectColumn || selectedOrders.length === 0) return;
    const target = BULK_TARGET[selectColumn];
    if (!target) return;
    setBulkBusy(true);
    setBulkError("");
    try {
      await patchStatuses(
        selectedOrders.map((o) => o.id),
        target,
      );
      clearSelection();
      router.refresh();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitDeliveryRun() {
    if (selectedOrders.length === 0 || selectColumn !== "packed") {
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
          : selectedOrders[0]?.customerArea ||
            selectedOrders[0]?.areaSnapshot ||
            null;
      const res = await fetch("/api/delivery-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedOrders.map((o) => o.id),
          deliveryBy,
          area,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Delivery run failed");
      setRunOpen(false);
      setDeliveryBy("");
      clearSelection();
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

  const bulkLabel =
    selectColumn != null ? BULK_LABEL[selectColumn] : undefined;

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

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex shrink-0 flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Customer Orders
            </h1>
            <p className="mt-1 text-sm text-muted">
              Picking → packed → invoice → out → delivered. Missing shades at
              end of day.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraftsOpen(true)}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium hover:bg-sidebar"
            >
              Drafts ({drafts.length})
            </button>
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
              onClick={() => openNewOrder()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              <span className="text-lg leading-none">+</span>
              New Order
            </button>
          </div>
        </div>

        {marketCustomers.length > 0 ? (
          <section className="mb-5 shrink-0 rounded-xl border border-border bg-surface p-4">
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

        <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-muted">Date</span>
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
            <span className="shrink-0 text-xs font-medium text-muted">Area</span>
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

        {selectedOrders.length > 0 && selectColumn && bulkLabel ? (
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
            <span className="text-sm text-muted">
              {selectedOrders.length} selected in{" "}
              {CUSTOMER_ORDER_STATUS_LABELS[selectColumn]}
            </span>
            {bulkError ? (
              <span className="text-sm text-red-700">{bulkError}</span>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
              >
                Clear
              </button>
              {selectColumn === "packed" ? (
                <button
                  type="button"
                  onClick={() => {
                    setRunError("");
                    setRunOpen(true);
                  }}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
                >
                  {bulkLabel}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void submitBulkStatus()}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-50"
                >
                  {bulkBusy ? "Updating…" : bulkLabel}
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="flex max-h-[calc(100dvh-16rem)] min-w-max gap-3">
            {KANBAN_COLUMNS.map((status) => {
              const columnOrders = columns[status];
              const selectable = status !== "delivered";
              return (
                <section
                  key={status}
                  className="flex max-h-[calc(100dvh-16rem)] w-[280px] shrink-0 flex-col rounded-xl border border-border bg-sidebar/40"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <h2 className="text-sm font-medium">
                      {CUSTOMER_ORDER_STATUS_LABELS[status]}
                    </h2>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs tabular-nums text-muted">
                      {columnOrders.length}
                    </span>
                  </header>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    {columnOrders.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-muted">
                        No orders
                      </p>
                    ) : (
                      columnOrders.map((order) => {
                        const area =
                          order.areaSnapshot || order.customerArea || "—";
                        const checked = selected.has(order.id);
                        return (
                          <article
                            key={order.id}
                            className={`rounded-lg border border-border bg-surface p-3 shadow-sm ${
                              checked ? "ring-2 ring-foreground/20" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {selectable ? (
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onChange={() =>
                                    toggleSelect(status, order.id)
                                  }
                                  aria-label={`Select ${order.customerName}`}
                                />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <PendingLink
                                  href={`/orders/customers/${order.id}`}
                                  className="block font-medium hover:underline"
                                >
                                  {order.customerName ?? "Customer"}
                                </PendingLink>
                                {order.isUrgent ? (
                                  <span className="mt-1 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                                    Urgent
                                  </span>
                                ) : null}
                                <div className="mt-1 text-xs text-muted">
                                  {area} · {formatShortDate(order.orderDate)}
                                </div>
                                <div className="mt-1 text-xs tabular-nums text-muted">
                                  {formatINR(order.amount)}
                                  {order.lineCount
                                    ? ` · ${order.lineCount} lines`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
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
        open={draftsOpen}
        onClose={() => setDraftsOpen(false)}
        title={`Drafts (${drafts.length})`}
      >
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted">No draft orders match filters.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {drafts.map((order) => (
                <li key={order.id}>
                  <PendingLink
                    href={`/orders/customers/${order.id}`}
                    className="block rounded-lg border border-border px-3 py-2 text-sm hover:bg-sidebar"
                  >
                    <div className="font-medium">
                      {order.customerName ?? "Customer"}
                    </div>
                    <div className="text-xs text-muted">
                      {formatShortDate(order.orderDate)} ·{" "}
                      {formatINR(order.amount)}
                    </div>
                  </PendingLink>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDraftsOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title="Generate invoices"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Invoice {selectedOrders.length} packed order
            {selectedOrders.length === 1 ? "" : "s"} and assign one delivery
            person.
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {selectedOrders.map((o) => (
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
