"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import {
  matchCustomerPriceRule,
  resolveCustomerUnitPrice,
} from "@/lib/customers/price-rules";
import type { CustomerOrder } from "@/lib/customer-orders/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  Salesman,
} from "@/lib/salesmen/types";

type PricedLine = {
  /** Existing order line id, or null for lines added in this modal */
  orderLineId: string | null;
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unitPrice: number;
  amount: number;
  listPrice: number;
  ruleDescription: string | null;
};

type OrderDraft = {
  lines: PricedLine[];
  additionalDiscount: string;
};

export type CustomerOrderInvoiceSubmitPayload = {
  orderIds: string[];
  invoicesByOrder: Record<
    string,
    {
      discountAmount: number;
      paymentEntries: InvoicePaymentEntry[];
      lineQtyOverrides: Record<string, number>;
      lineUnitPriceOverrides: Record<string, number>;
    }
  >;
};

const BLANK_ROWS = 3;

function matchCatalogByName(
  priceList: PriceListItem[],
  itemName: string,
): PriceListItem | undefined {
  const needle = itemName.trim().toLowerCase();
  if (!needle) return undefined;
  const exact = priceList.find(
    (p) => p.item_name.trim().toLowerCase() === needle,
  );
  if (exact) return exact;
  return priceList.find((p) => {
    const name = p.item_name.trim().toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
}

function emptyLine(): PricedLine {
  return {
    orderLineId: null,
    key: crypto.randomUUID(),
    priceListItemId: null,
    itemName: "",
    shadeCode: "",
    qty: "",
    unitPrice: 0,
    amount: 0,
    listPrice: 0,
    ruleDescription: null,
  };
}

function isBlankLine(line: PricedLine): boolean {
  return (
    !line.itemName.trim() &&
    !line.shadeCode.trim() &&
    !line.qty &&
    line.priceListItemId == null &&
    line.unitPrice <= 0
  );
}

function withTrailingBlanks(lines: PricedLine[]): PricedLine[] {
  const filled = lines.filter((l) => !isBlankLine(l));
  const blanks = Array.from({ length: BLANK_ROWS }, () => emptyLine());
  return [...filled, ...blanks];
}

function lineDisplayName(line: PricedLine): string {
  const base = line.itemName.trim() || "Item";
  return line.shadeCode.trim() ? `${base} — ${line.shadeCode.trim()}` : base;
}

type CustomerOrderInvoiceModalProps = {
  open: boolean;
  onClose: () => void;
  orders: CustomerOrder[];
  customers: Salesman[];
  priceList: PriceListItem[];
  busy?: boolean;
  error?: string;
  onSubmit: (payload: CustomerOrderInvoiceSubmitPayload) => void | Promise<void>;
};

function placeholderCustomer(name = "Customer"): Salesman {
  return {
    id: "preview-placeholder",
    name,
    phone: "",
    alternatePhone: "",
    entityType: "customer",
    isActive: true,
    openingBalance: 0,
    pendingBalance: 0,
    lastInvoiceAt: null,
    discountRules: [],
    marketDay: "",
    area: "",
    isDefaulter: false,
    tier: "",
    balanceThreshold: null,
    contactName: "",
    addressBuilding: "",
    addressArea: "",
    addressCity: "",
    addressState: "",
    addressPincode: "",
    mapLat: null,
    mapLng: null,
    tierRubric: {
      orderFrequency: null,
      orderAmount: null,
      paymentAmount: null,
      paymentSpeed: null,
    },
    priceRules: [],
  };
}

function buildPricedLines(
  order: CustomerOrder,
  customer: Salesman | null,
  priceList: PriceListItem[],
): PricedLine[] {
  const rules = customer?.priceRules ?? [];
  const seeded = order.lines
    .filter(
      (line) =>
        line.qty > 0 &&
        Boolean(
          line.itemName?.trim() ||
            line.priceListItemId ||
            line.shadeCode.trim(),
        ),
    )
    .map((line) => {
      const catalog =
        (line.priceListItemId
          ? priceList.find((p) => p.id === line.priceListItemId)
          : undefined) ??
        (line.itemName
          ? matchCatalogByName(priceList, line.itemName)
          : undefined);
      const itemName =
        (line.itemName?.trim() || catalog?.item_name || "Item").trim() ||
        "Item";
      const listPrice = catalog ? Number(catalog.customer_price) : 0;
      const priceListItemId = catalog?.id ?? line.priceListItemId ?? null;
      const unitPrice = resolveCustomerUnitPrice(listPrice, rules, {
        priceListItemId,
        itemName,
        priceList,
      });
      const rule = matchCustomerPriceRule(rules, {
        priceListItemId,
        itemName,
        priceList,
      });
      const qty = line.qty > 0 ? line.qty : 0;
      return {
        orderLineId: line.id,
        key: line.id,
        priceListItemId,
        itemName,
        shadeCode: line.shadeCode ?? "",
        qty: String(qty),
        unitPrice,
        amount: Math.round(unitPrice * qty * 100) / 100,
        listPrice,
        ruleDescription: rule?.description ?? null,
      };
    });
  return withTrailingBlanks(seeded);
}

function emptyDraft(
  order: CustomerOrder,
  customer: Salesman | null,
  priceList: PriceListItem[],
): OrderDraft {
  return {
    lines: buildPricedLines(order, customer, priceList),
    additionalDiscount: "",
  };
}

export function CustomerOrderInvoiceModal({
  open,
  onClose,
  orders,
  customers,
  priceList,
  busy = false,
  error,
  onSubmit,
}: CustomerOrderInvoiceModalProps) {
  const [loadedOrders, setLoadedOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [localError, setLocalError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [draftNumber] = useState(() => `INV-CU-${Date.now()}`);
  const [issuedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!open || orders.length === 0) {
      if (!open) {
        setLoadedOrders([]);
        setDrafts({});
        setActiveOrderId("");
      }
      return;
    }

    let cancelled = false;
    setLoadingOrders(true);
    setLocalError("");

    void (async () => {
      try {
        const results = await Promise.all(
          orders.map(async (order) => {
            const res = await fetch(`/api/customer-orders/${order.id}`);
            const json = (await res.json()) as {
              order?: CustomerOrder;
              error?: string;
            };
            if (!res.ok || !json.order) {
              throw new Error(
                json.error ??
                  `Could not load order for ${order.customerName ?? "customer"}`,
              );
            }
            return json.order;
          }),
        );
        if (cancelled) return;

        const nextDrafts: Record<string, OrderDraft> = {};
        for (const order of results) {
          const customer =
            customers.find((c) => c.id === order.customerId) ?? null;
          nextDrafts[order.id] = emptyDraft(order, customer, priceList);
        }
        setLoadedOrders(results);
        setDrafts(nextDrafts);
        setActiveOrderId(results[0]!.id);
      } catch (e) {
        if (cancelled) return;
        setLocalError(
          e instanceof Error ? e.message : "Could not load order lines",
        );
        setLoadedOrders([]);
        setDrafts({});
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orders, customers, priceList]);

  const workingOrders = loadedOrders.length > 0 ? loadedOrders : [];
  const activeOrder =
    workingOrders.find((o) => o.id === activeOrderId) ??
    workingOrders[0] ??
    null;
  const customer = activeOrder
    ? (customers.find((c) => c.id === activeOrder.customerId) ?? null)
    : null;
  const customerName =
    customer?.name ?? activeOrder?.customerName ?? "Customer";
  const priceRules = customer?.priceRules ?? [];
  const draft = activeOrder ? drafts[activeOrder.id] : undefined;

  const filledLines = useMemo(
    () =>
      (draft?.lines ?? []).filter(
        (l) =>
          l.itemName.trim() &&
          Number(l.qty) > 0 &&
          l.unitPrice > 0,
      ),
    [draft?.lines],
  );

  const subtotal = useMemo(
    () => filledLines.reduce((sum, l) => sum + l.amount, 0),
    [filledLines],
  );

  const additionalNum = Number(draft?.additionalDiscount ?? "");
  const discountAmount =
    Number.isFinite(additionalNum) && additionalNum > 0 ? additionalNum : 0;
  const invoiceTotal = Math.max(
    0,
    Math.round((subtotal - discountAmount) * 100) / 100,
  );
  const previousBalance = customer?.pendingBalance ?? 0;

  const liveInvoice: Invoice = useMemo(() => {
    const lineItems: InvoiceLineItem[] = filledLines.map((l) => ({
      id: l.key,
      name: lineDisplayName(l),
      qty: Number(l.qty),
      unitPrice: l.unitPrice,
      amount: l.amount,
      priceListItemId: l.priceListItemId ?? undefined,
    }));
    return {
      id: activeOrder?.id ?? "draft",
      number: draftNumber,
      salesmanId: activeOrder?.customerId ?? customer?.id ?? "",
      issuedAt,
      itemCount: lineItems.length,
      totalAmount: invoiceTotal,
      amountPaid: 0,
      lineItems,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
    };
  }, [
    filledLines,
    activeOrder?.id,
    activeOrder?.customerId,
    draftNumber,
    customer?.id,
    issuedAt,
    invoiceTotal,
    discountAmount,
  ]);

  const previewCustomer: Salesman = customer
    ? customer
    : {
        ...placeholderCustomer(customerName),
        id: activeOrder?.customerId ?? "preview-placeholder",
      };

  function updateActiveDraft(patch: Partial<OrderDraft>) {
    if (!activeOrder) return;
    setDrafts((prev) => ({
      ...prev,
      [activeOrder.id]: {
        ...(prev[activeOrder.id] ??
          emptyDraft(activeOrder, customer, priceList)),
        ...patch,
      },
    }));
  }

  function updateLine(key: string, patch: Partial<PricedLine>) {
    if (!activeOrder || !draft) return;
    const lines = withTrailingBlanks(
      draft.lines.map((line) => {
        if (line.key !== key) return line;
        const merged = { ...line, ...patch };
        const qtyNum = Number(merged.qty);
        const q = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
        merged.amount = Math.round(merged.unitPrice * q * 100) / 100;
        return merged;
      }),
    );
    updateActiveDraft({ lines });
  }

  function removeLine(key: string) {
    if (!activeOrder || !draft) return;
    updateActiveDraft({
      lines: withTrailingBlanks(draft.lines.filter((l) => l.key !== key)),
    });
  }

  function selectCatalogItem(key: string, item: PriceListItem) {
    const unitPrice = resolveCustomerUnitPrice(
      item.customer_price,
      priceRules,
      {
        priceListItemId: item.id,
        itemName: item.item_name,
        priceList,
      },
    );
    const rule = matchCustomerPriceRule(priceRules, {
      priceListItemId: item.id,
      itemName: item.item_name,
      priceList,
    });
    updateLine(key, {
      itemName: item.item_name,
      priceListItemId: item.id,
      unitPrice,
      listPrice: Number(item.customer_price),
      ruleDescription: rule?.description ?? null,
    });
  }

  function validateOrderDraft(
    order: CustomerOrder,
    orderDraft: OrderDraft,
  ): string | null {
    if (!order.customerId) {
      return "Order is missing a customer.";
    }
    const filled = orderDraft.lines.filter(
      (l) => l.itemName.trim() && Number(l.qty) > 0 && l.unitPrice > 0,
    );
    if (filled.length === 0) {
      return `Add at least one item for ${order.customerName ?? "this order"}.`;
    }
    return null;
  }

  async function syncOrderLines(
    order: CustomerOrder,
    orderDraft: OrderDraft,
  ): Promise<CustomerOrder> {
    const filled = orderDraft.lines.filter(
      (l) => l.itemName.trim() && Number(l.qty) > 0,
    );
    const payload = filled.map((l) => ({
      priceListItemId: l.priceListItemId,
      itemName: l.itemName.trim(),
      shadeCode: l.shadeCode.trim(),
      qty: Number(l.qty),
      unit: "box" as const,
      source: "manual" as const,
    }));

    const res = await fetch(`/api/customer-orders/${order.id}/lines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: payload, createMissingShades: true }),
    });
    const json = (await res.json()) as {
      order?: CustomerOrder;
      error?: string;
    };
    if (!res.ok || !json.order) {
      throw new Error(
        json.error ??
          `Could not save lines for ${order.customerName ?? "order"}`,
      );
    }
    return json.order;
  }

  async function handleSubmit() {
    if (workingOrders.length === 0) return;

    for (const order of workingOrders) {
      const orderDraft = drafts[order.id];
      if (!orderDraft) {
        setLocalError("Invoice draft missing. Close and reopen the modal.");
        setActiveOrderId(order.id);
        return;
      }
      const err = validateOrderDraft(order, orderDraft);
      if (err) {
        setLocalError(err);
        setActiveOrderId(order.id);
        return;
      }
    }

    setLocalError("");
    setSyncing(true);
    try {
      const invoicesByOrder: CustomerOrderInvoiceSubmitPayload["invoicesByOrder"] =
        {};

      for (const order of workingOrders) {
        const orderDraft = drafts[order.id]!;
        const filled = orderDraft.lines.filter(
          (l) => l.itemName.trim() && Number(l.qty) > 0 && l.unitPrice > 0,
        );
        const saved = await syncOrderLines(order, orderDraft);
        const discountNum = Number(orderDraft.additionalDiscount);
        const discount =
          Number.isFinite(discountNum) && discountNum > 0 ? discountNum : 0;

        const lineQtyOverrides: Record<string, number> = {};
        const lineUnitPriceOverrides: Record<string, number> = {};
        saved.lines.forEach((line, index) => {
          const draftLine = filled[index];
          if (!draftLine) return;
          lineQtyOverrides[line.id] = Number(draftLine.qty);
          lineUnitPriceOverrides[line.id] = draftLine.unitPrice;
        });

        invoicesByOrder[order.id] = {
          discountAmount: discount,
          paymentEntries: [],
          lineQtyOverrides,
          lineUnitPriceOverrides,
        };
      }

      await onSubmit({
        orderIds: workingOrders.map((o) => o.id),
        invoicesByOrder,
      });
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "Could not prepare invoice",
      );
    } finally {
      setSyncing(false);
    }
  }

  const displayError = localError || error || "";
  const actionBusy = busy || syncing || loadingOrders;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!actionBusy) onClose();
      }}
      title="Generate invoices"
      size="2xl"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r lg:py-5">
          <div className="mx-auto max-w-xl space-y-5">
            {workingOrders.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {workingOrders.map((order, index) => {
                  const active = order.id === activeOrder?.id;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => {
                        setActiveOrderId(order.id);
                        setLocalError("");
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                        active
                          ? "border-foreground bg-foreground text-surface"
                          : "border-border hover:bg-sidebar"
                      }`}
                    >
                      {index + 1}. {order.customerName ?? "Order"}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {loadingOrders ? (
              <p className="text-sm text-muted">Loading order lines…</p>
            ) : null}

            {!loadingOrders && draft && activeOrder ? (
              <>
                <section className="space-y-3">
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Customer
                    </span>
                    <input
                      type="text"
                      value={customerName}
                      disabled
                      className="w-full rounded-lg border border-border bg-sidebar/40 px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-90"
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_5.5rem_1.5rem] gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                      <span>Item</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Rate</span>
                      <span className="text-right">Amount</span>
                      <span />
                    </div>
                    {draft.lines.map((line) => {
                      const blank = isBlankLine(line);
                      return (
                        <div
                          key={line.key}
                          className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_5.5rem_1.5rem] items-start gap-2"
                        >
                          <div className="min-w-0 space-y-1">
                            <ItemNameCombobox
                              items={priceList}
                              value={line.itemName}
                              disabled={actionBusy}
                              showPrice={false}
                              placeholder="Item"
                              onChange={(value) =>
                                updateLine(line.key, {
                                  itemName: value,
                                  priceListItemId: null,
                                  unitPrice: 0,
                                  listPrice: 0,
                                  ruleDescription: null,
                                })
                              }
                              onSelect={(item) =>
                                selectCatalogItem(line.key, item)
                              }
                              onTabToQty={() => undefined}
                            />
                            {line.shadeCode.trim() ? (
                              <p className="truncate text-xs text-muted">
                                Shade {line.shadeCode.trim()}
                                {line.ruleDescription
                                  ? ` · ${line.ruleDescription}`
                                  : ""}
                              </p>
                            ) : line.ruleDescription ? (
                              <p className="truncate text-xs text-muted">
                                {line.ruleDescription}
                              </p>
                            ) : null}
                          </div>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            disabled={actionBusy}
                            value={line.qty}
                            placeholder="0"
                            onChange={(e) =>
                              updateLine(line.key, { qty: e.target.value })
                            }
                            className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40 disabled:opacity-50"
                          />
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            disabled={actionBusy}
                            value={line.unitPrice || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const priceNum = Number(e.target.value);
                              updateLine(line.key, {
                                unitPrice:
                                  Number.isFinite(priceNum) && priceNum >= 0
                                    ? Math.round(priceNum * 100) / 100
                                    : 0,
                              });
                            }}
                            className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40 disabled:opacity-50"
                          />
                          <span className="py-2 text-right text-sm tabular-nums">
                            {line.amount > 0 ? formatINR(line.amount) : "—"}
                          </span>
                          <div className="flex justify-center pt-2">
                            {!blank ? (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => removeLine(line.key)}
                                className="text-sm text-muted hover:text-foreground disabled:opacity-50"
                                aria-label="Remove line"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Additional discount
                    </span>
                    <div className="flex overflow-hidden rounded-lg border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20">
                      <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        disabled={actionBusy}
                        value={draft.additionalDiscount}
                        placeholder="0"
                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                        onChange={(e) =>
                          updateActiveDraft({
                            additionalDiscount: e.target.value,
                          })
                        }
                      />
                    </div>
                  </label>
                </section>

                {displayError ? (
                  <p
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                    role="alert"
                  >
                    {displayError}
                  </p>
                ) : null}

                <div className="flex justify-end gap-2 pb-1">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={onClose}
                    className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy || workingOrders.length === 0}
                    onClick={() => void handleSubmit()}
                    className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    {actionBusy
                      ? syncing
                        ? "Saving…"
                        : busy
                          ? "Invoicing…"
                          : "Loading…"
                      : workingOrders.length > 1
                        ? `Generate ${workingOrders.length} invoices`
                        : "Generate invoice"}
                  </button>
                </div>
              </>
            ) : null}

            {!loadingOrders && !draft && displayError ? (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {displayError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="hidden min-h-0 overflow-y-auto bg-sidebar/30 p-4 lg:block">
          <InvoicePreview
            invoice={liveInvoice}
            salesman={previewCustomer}
            hideToolbar
            previousBalance={previousBalance}
          />
        </div>
      </div>
    </Modal>
  );
}
