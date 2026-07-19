"use client";

import { useEffect, useMemo, useState } from "react";
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

export function NewCustomerOrderModal({
  open,
  onClose,
  customers: initialCustomers,
  priceList,
}: NewCustomerOrderModalProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [step, setStep] = useState<1 | 2>(1);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [slips, setSlips] = useState<CustomerOrderAttachment[]>([]);
  const [patches, setPatches] = useState<CustomerOrderAttachment[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  useEffect(() => {
    if (open) setCustomers(initialCustomers);
  }, [open, initialCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => c.isActive)
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  function reset() {
    setStep(1);
    setOrderId(null);
    setCustomerId("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setSearch("");
    setError("");
    setQuickAdd(false);
    setNewName("");
    setNewPhone("");
    setBusy("");
    setSlips([]);
    setPatches([]);
    setLines([emptyLine()]);
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
    if (quickAdd) {
      if (!newName.trim()) {
        setError("Customer name is required");
        return;
      }
      await createOrderDraft({
        orderDate,
        notes: notes.trim() || null,
        createCustomer: {
          name: newName.trim(),
          phone: newPhone.trim(),
        },
      });
      return;
    }
    if (!customerId) {
      setError("Select a customer");
      return;
    }
    await createOrderDraft({
      customerId,
      orderDate,
      notes: notes.trim() || null,
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
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Customer</span>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAdd((v) => !v);
                    setError("");
                  }}
                  className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {quickAdd ? "Pick existing" : "+ Quick add"}
                </button>
              </div>

              {quickAdd ? (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Name</span>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Phone</span>
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    placeholder="Search customers"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-surface">
                    {filtered.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted">
                        No customers found. Use Quick add.
                      </p>
                    ) : (
                      <ul>
                        {filtered.map((customer) => (
                          <li
                            key={customer.id}
                            className="border-b border-border last:border-0"
                          >
                            <button
                              type="button"
                              onClick={() => setCustomerId(customer.id)}
                              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                                customerId === customer.id
                                  ? "bg-sidebar font-medium"
                                  : "hover:bg-sidebar/50"
                              }`}
                            >
                              <span>{customer.name}</span>
                              <span className="text-xs text-muted">
                                {customer.phone || "No phone"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
                placeholder="Market day, delivery notes…"
              />
            </label>
          </>
        ) : (
          <div className="space-y-5">
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
              {slips.length === 0 ? (
                <p className="text-sm text-muted">
                  Upload WhatsApp / notebook photos as proof.
                </p>
              ) : (
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
              )}
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
              {patches.length === 0 ? (
                <p className="text-sm text-muted">
                  Optional fabric swatches for color matching.
                </p>
              ) : (
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
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Shade lines</h3>
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar"
                >
                  + Line
                </button>
              </div>
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
              </div>
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
                disabled={Boolean(busy) || (!quickAdd && !customerId)}
                onClick={goToStep2}
                className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
              >
                {busy === "create" ? "Creating…" : "Continue"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={handleClose}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
              >
                Save for later
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={finishOrder}
                className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save & open order"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
