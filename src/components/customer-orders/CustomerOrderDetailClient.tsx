"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { InvoicePaymentsStep } from "@/components/salesmen/InvoicePaymentsStep";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  ORDER_LINE_UNIT_LABELS,
  type CustomerOrder,
  type CustomerOrderLineUnit,
  type CustomerOrderStatus,
} from "@/lib/customer-orders/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { InvoicePaymentEntry } from "@/lib/salesmen/types";

type DraftLine = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
  shadeId: string | null;
  colorLabel: string;
  colorHex: string;
};

type CustomerOrderDetailClientProps = {
  context: AppContext;
  initialOrder: CustomerOrder;
  priceList: PriceListItem[];
  bankAccounts: BankAccount[];
};

function linesFromOrder(order: CustomerOrder): DraftLine[] {
  if (order.lines.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        priceListItemId: null,
        itemName: "",
        shadeCode: "",
        qty: "1",
        unit: "box",
        shadeId: null,
        colorLabel: "",
        colorHex: "",
      },
    ];
  }
  return order.lines.map((line) => ({
    key: line.id,
    priceListItemId: line.priceListItemId,
    itemName: line.itemName ?? "",
    shadeCode: line.shadeCode,
    qty: String(line.qty),
    unit: line.unit,
    shadeId: line.shadeId,
    colorLabel: line.shade?.colorLabel ?? "",
    colorHex: line.shade?.colorHex ?? "",
  }));
}

function estimateTotal(lines: DraftLine[], priceList: PriceListItem[]): number {
  return lines.reduce((sum, line) => {
    const qty = Number(line.qty);
    if (!(qty > 0) || !line.priceListItemId) return sum;
    const item = priceList.find((p) => p.id === line.priceListItemId);
    if (!item) return sum;
    return sum + Number(item.customer_price) * qty;
  }, 0);
}

export function CustomerOrderDetailClient({
  context,
  initialOrder,
  priceList,
  bankAccounts,
}: CustomerOrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [lines, setLines] = useState(() => linesFromOrder(initialOrder));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [payments, setPayments] = useState<InvoicePaymentEntry[]>([]);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [shadeEditorKey, setShadeEditorKey] = useState<string | null>(null);

  const locked = order.status === "invoiced" || order.status === "cancelled";
  const invoiceTotal = useMemo(
    () =>
      Math.max(
        0,
        estimateTotal(lines, priceList) - (Number(discountAmount) || 0),
      ),
    [lines, priceList, discountAmount],
  );

  const shadeEditor = lines.find((l) => l.key === shadeEditorKey) ?? null;

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        priceListItemId: null,
        itemName: "",
        shadeCode: "",
        qty: "1",
        unit: "box",
        shadeId: null,
        colorLabel: "",
        colorHex: "",
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((l) => l.key !== key),
    );
  }

  async function saveLines() {
    setBusy("lines");
    setError("");
    try {
      const payload = lines
        .filter((l) => l.shadeCode.trim() && Number(l.qty) > 0)
        .map((l) => ({
          priceListItemId: l.priceListItemId,
          shadeId: l.shadeId,
          shadeCode: l.shadeCode.trim(),
          qty: Number(l.qty),
          unit: l.unit,
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
        throw new Error(json.error ?? "Failed to save lines");
      }
      setOrder(json.order);
      setLines(linesFromOrder(json.order));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save lines");
      throw e;
    } finally {
      setBusy("");
    }
  }

  async function uploadFiles(
    files: FileList | null,
    kind: "order_slip" | "cloth_patch",
  ) {
    if (!files?.length) return;
    setBusy("upload");
    setError("");
    try {
      let latest = order;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        const res = await fetch(
          `/api/customer-orders/${order.id}/attachments`,
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
      setOrder(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
    }
  }

  async function removeAttachment(attachmentId: string) {
    setBusy("upload");
    setError("");
    try {
      const res = await fetch(
        `/api/customer-orders/${order.id}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Delete failed");
      }
      setOrder(json.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy("");
    }
  }

  async function setStatus(status: CustomerOrderStatus) {
    setBusy("status");
    setError("");
    try {
      if (!locked && status !== "cancelled") {
        await saveLines();
      }
      const res = await fetch(`/api/customer-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Status update failed");
      }
      setOrder(json.order);
      setLines(linesFromOrder(json.order));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setBusy("");
    }
  }

  async function saveShadeDetails() {
    if (!shadeEditor?.priceListItemId || !shadeEditor.shadeCode.trim()) {
      setError("Item and shade code are required for color matching");
      return;
    }
    setBusy("shade");
    setError("");
    try {
      const res = await fetch("/api/item-shades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceListItemId: shadeEditor.priceListItemId,
          shadeCode: shadeEditor.shadeCode,
          colorLabel: shadeEditor.colorLabel || null,
          colorHex: shadeEditor.colorHex || null,
        }),
      });
      const json = (await res.json()) as {
        shade?: { id: string; shadeCode: string };
        error?: string;
      };
      if (!res.ok || !json.shade) {
        throw new Error(json.error ?? "Failed to save shade");
      }
      updateLine(shadeEditor.key, {
        shadeId: json.shade.id,
        shadeCode: json.shade.shadeCode,
      });
      setShadeEditorKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save shade");
    } finally {
      setBusy("");
    }
  }

  async function uploadShadePatch(file: File | null) {
    if (!file || !shadeEditor?.priceListItemId || !shadeEditor.shadeCode.trim()) {
      return;
    }
    setBusy("shade");
    setError("");
    try {
      const form = new FormData();
      form.set("priceListItemId", shadeEditor.priceListItemId);
      form.set("shadeCode", shadeEditor.shadeCode);
      form.set("colorLabel", shadeEditor.colorLabel);
      form.set("colorHex", shadeEditor.colorHex);
      form.set("patch", file);
      const res = await fetch("/api/item-shades", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        shade?: { id: string; shadeCode: string; colorLabel?: string | null };
        error?: string;
      };
      if (!res.ok || !json.shade) {
        throw new Error(json.error ?? "Failed to upload patch");
      }
      updateLine(shadeEditor.key, {
        shadeId: json.shade.id,
        shadeCode: json.shade.shadeCode,
        colorLabel: json.shade.colorLabel ?? shadeEditor.colorLabel,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload patch");
    } finally {
      setBusy("");
    }
  }

  async function convertToInvoice() {
    setBusy("convert");
    setError("");
    try {
      await saveLines();

      let status = order.status;
      if (status === "draft") {
        const confirmRes = await fetch(`/api/customer-orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "confirmed" }),
        });
        const confirmJson = (await confirmRes.json()) as {
          order?: CustomerOrder;
          error?: string;
        };
        if (!confirmRes.ok || !confirmJson.order) {
          throw new Error(confirmJson.error ?? "Could not confirm order");
        }
        status = confirmJson.order.status;
        setOrder(confirmJson.order);
      }

      if (status === "confirmed") {
        const pickRes = await fetch(`/api/customer-orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "picking" }),
        });
        const pickJson = (await pickRes.json()) as {
          order?: CustomerOrder;
          error?: string;
        };
        if (!pickRes.ok || !pickJson.order) {
          throw new Error(pickJson.error ?? "Could not move to picking");
        }
        setOrder(pickJson.order);
      }

      const res = await fetch(
        `/api/customer-orders/${order.id}/convert-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentEntries: payments.filter((p) => p.amount > 0),
            discountAmount: Number(discountAmount) || 0,
          }),
        },
      );
      const json = (await res.json()) as {
        order?: CustomerOrder;
        invoice?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Conversion failed");
      }
      setOrder(json.order);
      setLines(linesFromOrder(json.order));
      setConvertOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setBusy("");
    }
  }

  const slips = order.attachments.filter((a) => a.kind === "order_slip");
  const patches = order.attachments.filter((a) => a.kind === "cloth_patch");

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Customer Orders", href: "/orders/customers" },
          { label: order.customerName ?? "Order" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              {order.customerName ?? "Customer order"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {order.orderDate} · {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
              {order.invoiceId ? " · Invoiced" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!locked ? (
              <>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => saveLines().catch(() => undefined)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
                >
                  {busy === "lines" ? "Saving…" : "Save lines"}
                </button>
                {order.status === "draft" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => setStatus("confirmed")}
                    className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    Confirm order
                  </button>
                ) : null}
                {order.status === "confirmed" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => setStatus("picking")}
                    className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    Start picking
                  </button>
                ) : null}
                {order.status === "confirmed" || order.status === "picking" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => setConvertOpen(true)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
                  >
                    Convert to invoice
                  </button>
                ) : null}
                {order.status !== "cancelled" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => setStatus("cancelled")}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <section className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Order slips</h2>
                {!locked ? (
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
                ) : null}
              </div>
              {slips.length === 0 ? (
                <p className="text-sm text-muted">
                  Upload WhatsApp / notebook photos as proof.
                </p>
              ) : (
                <ul className="space-y-3">
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
                          className="mb-2 max-h-56 w-full rounded-md object-contain bg-sidebar"
                        />
                      ) : (
                        <p className="mb-2 text-sm">{slip.fileName ?? "File"}</p>
                      )}
                      {!locked ? (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => removeAttachment(slip.id)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs"
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Cloth patches</h2>
                {!locked ? (
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
                ) : null}
              </div>
              {patches.length === 0 ? (
                <p className="text-sm text-muted">
                  Optional fabric swatches for color matching.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {patches.map((patch) => (
                    <div key={patch.id} className="rounded-lg border border-border p-1">
                      {patch.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={patch.signedUrl}
                          alt={patch.fileName ?? "Cloth patch"}
                          className="h-28 w-full rounded object-cover"
                        />
                      ) : (
                        <p className="p-2 text-xs">{patch.fileName}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">Shade lines</h2>
                <p className="text-xs text-muted">
                  Est. {formatINR(estimateTotal(lines, priceList))} at customer
                  prices
                </p>
              </div>
              {!locked ? (
                <button
                  type="button"
                  onClick={addLine}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar"
                >
                  + Line
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1.4fr_0.8fr_0.5fr_0.6fr_auto]"
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
                    disabled={locked}
                    showPrice={false}
                    placeholder="Item (ELFA, Pen Poly…)"
                  />
                  <input
                    value={line.shadeCode}
                    disabled={locked}
                    onChange={(e) =>
                      updateLine(line.key, { shadeCode: e.target.value })
                    }
                    placeholder="Shade"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground disabled:opacity-60"
                  />
                  <input
                    value={line.qty}
                    disabled={locked}
                    onChange={(e) =>
                      updateLine(line.key, { qty: e.target.value })
                    }
                    placeholder="Qty"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground disabled:opacity-60"
                  />
                  <select
                    value={line.unit}
                    disabled={locked}
                    onChange={(e) =>
                      updateLine(line.key, {
                        unit: e.target.value as CustomerOrderLineUnit,
                      })
                    }
                    className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none disabled:opacity-60"
                  >
                    {Object.entries(ORDER_LINE_UNIT_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  <div className="flex items-center gap-1">
                    {!locked ? (
                      <>
                        <button
                          type="button"
                          title="Color / patch"
                          onClick={() => setShadeEditorKey(line.key)}
                          className="rounded-md border border-border px-2 py-1.5 text-xs"
                        >
                          Color
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="rounded-md border border-border px-2 py-1.5 text-xs text-red-700"
                        >
                          ×
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Modal
        open={Boolean(shadeEditor)}
        onClose={() => setShadeEditorKey(null)}
        title="Shade color match"
      >
        {shadeEditor ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {shadeEditor.itemName || "Item"} · {shadeEditor.shadeCode || "—"}
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Color label</span>
              <input
                value={shadeEditor.colorLabel}
                onChange={(e) =>
                  updateLine(shadeEditor.key, { colorLabel: e.target.value })
                }
                placeholder="e.g. Deep maroon"
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Color swatch</span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={shadeEditor.colorHex || "#888888"}
                  onChange={(e) =>
                    updateLine(shadeEditor.key, { colorHex: e.target.value })
                  }
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
                />
                <input
                  value={shadeEditor.colorHex}
                  onChange={(e) =>
                    updateLine(shadeEditor.key, { colorHex: e.target.value })
                  }
                  placeholder="#RRGGBB"
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
                />
              </div>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Cloth patch photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void uploadShadePatch(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
                className="block w-full text-sm"
              />
            </label>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={saveShadeDetails}
              className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
            >
              {busy === "shade" ? "Saving…" : "Save shade details"}
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={convertOpen}
        onClose={() => !busy && setConvertOpen(false)}
        title="Convert to invoice"
      >
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Additional discount</span>
            <input
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </label>
          <InvoicePaymentsStep
            payments={payments}
            onChange={setPayments}
            invoiceTotal={invoiceTotal}
            bankAccounts={bankAccounts}
          />
          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={convertToInvoice}
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
          >
            {busy === "convert" ? "Converting…" : "Create invoice"}
          </button>
        </div>
      </Modal>
    </>
  );
}
