"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import {
  ORDER_LINE_UNIT_LABELS,
  type CustomerOrder,
  type CustomerOrderAttachment,
  type CustomerOrderLineUnit,
} from "@/lib/customer-orders/types";
import type { Salesman } from "@/lib/salesmen/types";

type MenuPos = { top: number; left: number; width: number };

type DraftLine = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
};

type NewCustomerOrderModalProps = {
  open: boolean;
  onClose: () => void;
  customers: Salesman[];
  priceList: PriceListItem[];
};

function emptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    priceListItemId: null,
    itemName: "",
    shadeCode: "",
    qty: "1",
    unit: "box",
  };
}

function emptyLines(count = 3): DraftLine[] {
  return Array.from({ length: count }, () => emptyLine());
}

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function NewCustomerOrderModal({
  open,
  onClose,
  customers,
  priceList,
}: NewCustomerOrderModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerMenuPos, setCustomerMenuPos] = useState<MenuPos | null>(null);
  const customerListId = useId();
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const customerMenuRef = useRef<HTMLDivElement | null>(null);
  const [orderDate, setOrderDate] = useState(todayLocalDate);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [slips, setSlips] = useState<CustomerOrderAttachment[]>([]);
  const [patches, setPatches] = useState<CustomerOrderAttachment[]>([]);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() => emptyLines(3));

  const selectedCustomer =
    customers.find((c) => c.id === customerId) ?? null;

  const filteredCustomers = useMemo(() => {
    const active = customers
      .filter((c) => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
    const q = customerQuery.trim().toLowerCase();
    if (
      !q ||
      (selectedCustomer && selectedCustomer.name.toLowerCase() === q)
    ) {
      return active;
    }
    return active.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, customerQuery, selectedCustomer]);

  function updateCustomerMenuPosition() {
    const el = customerInputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 240);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    setCustomerMenuPos({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
    });
  }

  useLayoutEffect(() => {
    if (!customerOpen) {
      setCustomerMenuPos(null);
      return;
    }
    updateCustomerMenuPosition();
  }, [customerOpen, customerQuery, filteredCustomers.length]);

  useEffect(() => {
    if (!customerOpen) return;
    function onScrollOrResize() {
      updateCustomerMenuPosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [customerOpen]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (customerInputRef.current?.contains(target)) return;
      if (customerMenuRef.current?.contains(target)) return;
      setCustomerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function selectCustomer(customer: Salesman) {
    setCustomerId(customer.id);
    setCustomerQuery(customer.name);
    setCustomerOpen(false);
    setError("");
  }

  function reset() {
    setStep(1);
    setOrderId(null);
    setCustomerId("");
    setCustomerQuery("");
    setCustomerOpen(false);
    setOrderDate(todayLocalDate());
    setError("");
    setBusy("");
    setSlips([]);
    setPatches([]);
    setManualOrderOpen(false);
    setLines(emptyLines(3));
  }

  function handleClose() {
    if (busy) return;
    const createdId = orderId;
    reset();
    onClose();
    if (createdId) {
      router.refresh();
    }
  }

  async function createOrderDraft(payload: Record<string, unknown>) {
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Failed to create order");
      }
      setOrderId(json.order.id);
      setSlips(
        json.order.attachments.filter((a) => a.kind === "order_slip"),
      );
      setPatches(
        json.order.attachments.filter((a) => a.kind === "cloth_patch"),
      );
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setBusy("");
    }
  }

  async function goToStep2() {
    if (!customerId) {
      setError("Select a customer");
      return;
    }
    await createOrderDraft({
      customerId,
      orderDate,
    });
  }

  async function uploadFiles(
    files: FileList | null,
    kind: "order_slip" | "cloth_patch",
  ) {
    if (!files?.length || !orderId) return;
    setBusy("upload");
    setError("");
    try {
      let latest: CustomerOrder | null = null;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        const res = await fetch(
          `/api/customer-orders/${orderId}/attachments`,
          { method: "POST", body: form },
        );
        const json = (await res.json()) as {
          order?: CustomerOrder;
          error?: string;
        };
        if (!res.ok || !json.order) {
          throw new Error(json.error ?? "Upload failed");
        }
        latest = json.order;
      }
      if (latest) {
        setSlips(latest.attachments.filter((a) => a.kind === "order_slip"));
        setPatches(
          latest.attachments.filter((a) => a.kind === "cloth_patch"),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!orderId) return;
    setBusy("upload");
    setError("");
    try {
      const res = await fetch(
        `/api/customer-orders/${orderId}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Delete failed");
      }
      setSlips(json.order.attachments.filter((a) => a.kind === "order_slip"));
      setPatches(
        json.order.attachments.filter((a) => a.kind === "cloth_patch"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy("");
    }
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  async function finishOrder() {
    if (!orderId) return;
    setBusy("save");
    setError("");
    try {
      const payload = lines
        .filter((l) => l.shadeCode.trim() && Number(l.qty) > 0)
        .map((l) => ({
          priceListItemId: l.priceListItemId,
          shadeCode: l.shadeCode.trim(),
          qty: Number(l.qty),
          unit: l.unit,
          source: "manual" as const,
        }));

      const res = await fetch(`/api/customer-orders/${orderId}/lines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: payload, createMissingShades: true }),
      });
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save lines");
      }

      const id = orderId;
      reset();
      onClose();
      router.push(`/orders/customers/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save order");
      setBusy("");
    }
  }

  const title =
    step === 1
      ? "New customer order"
      : "Order slips, patches & shades";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size={step === 2 ? "xl" : "md"}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span
            className={
              step === 1 ? "font-medium text-foreground" : undefined
            }
          >
            1. Customer
          </span>
          <span aria-hidden>/</span>
          <span
            className={
              step === 2 ? "font-medium text-foreground" : undefined
            }
          >
            2. Slips & shades
          </span>
        </div>

        {step === 1 ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Order date</span>
              <input
                type="date"
                value={orderDate}
                readOnly
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-border bg-sidebar/50 px-3 py-2.5 text-sm text-muted"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Customer</span>
              <input
                ref={customerInputRef}
                type="text"
                role="combobox"
                aria-expanded={customerOpen}
                aria-controls={customerListId}
                aria-autocomplete="list"
                value={customerQuery}
                placeholder="Search customer…"
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                onFocus={() => setCustomerOpen(true)}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerId("");
                  setCustomerOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setCustomerOpen(false);
                    return;
                  }
                  if (e.key === "Enter" && filteredCustomers[0]) {
                    e.preventDefault();
                    selectCustomer(filteredCustomers[0]);
                  }
                }}
              />
              {customerOpen &&
              customerMenuPos &&
              typeof document !== "undefined"
                ? createPortal(
                    <div
                      ref={customerMenuRef}
                      id={customerListId}
                      role="listbox"
                      style={{
                        position: "fixed",
                        top: customerMenuPos.top,
                        left: customerMenuPos.left,
                        width: customerMenuPos.width,
                        transform:
                          customerMenuPos.top <
                          (customerInputRef.current?.getBoundingClientRect()
                            .top ?? 0)
                            ? "translateY(-100%)"
                            : undefined,
                        zIndex: 80,
                      }}
                      className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
                    >
                      {filteredCustomers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted">
                          No matching customers
                        </div>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            role="option"
                            aria-selected={customerId === customer.id}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                              customerId === customer.id
                                ? "bg-sidebar"
                                : "hover:bg-sidebar"
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectCustomer(customer);
                            }}
                          >
                            <span className="min-w-0 truncate">
                              {customer.name}
                            </span>
                            <span className="shrink-0 text-xs text-muted">
                              {customer.phone || "No phone"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>,
                    document.body,
                  )
                : null}
            </label>

          </>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Create manual order</h3>
                <button
                  type="button"
                  onClick={() => {
                    setManualOrderOpen(true);
                    setLines((prev) =>
                      prev.length >= 3 ? prev : emptyLines(3),
                    );
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar"
                >
                  Create
                </button>
              </div>
              {manualOrderOpen ? (
                <div className="space-y-2">
                  {lines.map((line) => (
                    <div
                      key={line.key}
                      className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.3fr_0.8fr_0.45fr_0.55fr_auto]"
                    >
                      <ItemNameCombobox
                        items={priceList}
                        value={line.itemName}
                        onChange={(value) =>
                          updateLine(line.key, {
                            itemName: value,
                            priceListItemId: null,
                          })
                        }
                        onSelect={(item) =>
                          updateLine(line.key, {
                            itemName: item.item_name,
                            priceListItemId: item.id,
                          })
                        }
                        onTabToQty={() => undefined}
                        showPrice={false}
                        placeholder="Item"
                      />
                      <input
                        value={line.shadeCode}
                        onChange={(e) =>
                          updateLine(line.key, { shadeCode: e.target.value })
                        }
                        placeholder="Shade"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                      <input
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.key, { qty: e.target.value })
                        }
                        placeholder="Qty"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                      />
                      <select
                        value={line.unit}
                        onChange={(e) =>
                          updateLine(line.key, {
                            unit: e.target.value as CustomerOrderLineUnit,
                          })
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
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) =>
                            prev.length <= 1
                              ? prev
                              : prev.filter((l) => l.key !== line.key),
                          )
                        }
                        className="rounded-md border border-border px-2 py-1.5 text-xs text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => [...prev, emptyLine()])
                    }
                    className="text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Add items
                  </button>
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Order slips</h3>
                <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar">
                  Upload
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void uploadFiles(e.target.files, "order_slip");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {slips.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {slips.map((slip) => (
                    <li
                      key={slip.id}
                      className="rounded-lg border border-border p-2"
                    >
                      {slip.signedUrl &&
                      slip.contentType?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slip.signedUrl}
                          alt={slip.fileName ?? "Order slip"}
                          className="mb-2 max-h-36 w-full rounded-md object-contain bg-sidebar"
                        />
                      ) : (
                        <p className="mb-2 text-sm">
                          {slip.fileName ?? "File"}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => removeAttachment(slip.id)}
                        className="rounded-md border border-border px-2 py-1 text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Cloth patches</h3>
                <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void uploadFiles(e.target.files, "cloth_patch");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {patches.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {patches.map((patch) => (
                    <div
                      key={patch.id}
                      className="rounded-lg border border-border p-1"
                    >
                      {patch.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={patch.signedUrl}
                          alt={patch.fileName ?? "Cloth patch"}
                          className="mb-1 h-20 w-full rounded object-cover"
                        />
                      ) : (
                        <p className="p-1 text-xs">{patch.fileName}</p>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => removeAttachment(patch.id)}
                        className="w-full rounded-md border border-border px-1 py-0.5 text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        )}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3 pt-1">
          {step === 1 ? (
            <>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={handleClose}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || !customerId}
                onClick={goToStep2}
                className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
              >
                {busy === "create" ? "Creating…" : "Continue"}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={finishOrder}
              className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Save and create order"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
