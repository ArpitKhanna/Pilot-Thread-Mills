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

type DyeingShadeDraft = {
  key: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
};

type DyeingPatchDraft = {
  key: string;
  file: File;
  previewUrl: string;
};

type NewCustomerOrderModalProps = {
  open: boolean;
  onClose: () => void;
  customers: Salesman[];
  priceList: PriceListItem[];
  initialCustomerId?: string;
  initialExpandDyeing?: boolean;
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

function emptyDyeingShade(): DyeingShadeDraft {
  return {
    key: crypto.randomUUID(),
    shadeCode: "",
    qty: "1",
    unit: "box",
  };
}

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function revokeDyeingPreviews(patches: DyeingPatchDraft[]) {
  for (const patch of patches) {
    URL.revokeObjectURL(patch.previewUrl);
  }
}

export function NewCustomerOrderModal({
  open,
  onClose,
  customers,
  priceList,
  initialCustomerId,
  initialExpandDyeing = false,
}: NewCustomerOrderModalProps) {
  const router = useRouter();
  const dyeingSectionRef = useRef<HTMLElement | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerMenuPos, setCustomerMenuPos] = useState<MenuPos | null>(null);
  const customerListId = useId();
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const customerMenuRef = useRef<HTMLDivElement | null>(null);
  const [orderDate, setOrderDate] = useState(todayLocalDate);
  const [isUrgent, setIsUrgent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [slips, setSlips] = useState<CustomerOrderAttachment[]>([]);
  const [patches, setPatches] = useState<CustomerOrderAttachment[]>([]);
  const [lines, setLines] = useState<DraftLine[]>(() => emptyLines(3));
  const [dyeingShades, setDyeingShades] = useState<DyeingShadeDraft[]>(() => [
    emptyDyeingShade(),
  ]);
  const [dyeingPatches, setDyeingPatches] = useState<DyeingPatchDraft[]>([]);

  const selectedCustomer =
    customers.find((c) => c.id === customerId) ?? null;

  useEffect(() => {
    if (!open) return;
    if (!initialCustomerId) return;
    const customer = customers.find((c) => c.id === initialCustomerId);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerQuery(customer.name);
  }, [open, initialCustomerId, customers]);

  useEffect(() => {
    if (!open || !initialExpandDyeing) return;
    const timer = window.setTimeout(() => {
      dyeingSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, initialExpandDyeing]);

  useEffect(() => {
    return () => {
      revokeDyeingPreviews(dyeingPatches);
    };
    // Only revoke on unmount; reset() handles mid-session cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const orderLinePayload = useMemo(
    () =>
      lines
        .filter(
          (l) =>
            Number(l.qty) > 0 &&
            (l.itemName.trim() || l.priceListItemId || l.shadeCode.trim()),
        )
        .map((l) => ({
          priceListItemId: l.priceListItemId,
          itemName: l.itemName.trim() || null,
          shadeCode: l.shadeCode.trim(),
          qty: Number(l.qty),
          unit: l.unit,
          source: "manual" as const,
        })),
    [lines],
  );

  const dyeingShadePayload = useMemo(
    () =>
      dyeingShades
        .filter((s) => s.shadeCode.trim() && Number(s.qty) > 0)
        .map((s) => ({
          shadeCode: s.shadeCode.trim(),
          qty: Number(s.qty),
          unit: s.unit,
        })),
    [dyeingShades],
  );

  const hasOrderContent =
    Boolean(orderId) ||
    slips.length > 0 ||
    patches.length > 0 ||
    orderLinePayload.length > 0;

  const hasDyeingContent =
    dyeingShadePayload.length > 0 || dyeingPatches.length > 0;

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
    setOrderId(null);
    setCustomerId("");
    setCustomerQuery("");
    setCustomerOpen(false);
    setOrderDate(todayLocalDate());
    setIsUrgent(false);
    setError("");
    setBusy("");
    setSlips([]);
    setPatches([]);
    setLines(emptyLines(3));
    setDyeingShades([emptyDyeingShade()]);
    setDyeingPatches((prev) => {
      revokeDyeingPreviews(prev);
      return [];
    });
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

  async function ensureOrder(): Promise<string | null> {
    if (orderId) return orderId;
    if (!customerId) {
      setError("Select a customer");
      return null;
    }
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          orderDate,
          isUrgent,
        }),
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
      return json.order.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function uploadFiles(
    files: FileList | null,
    kind: "order_slip" | "cloth_patch",
  ) {
    if (!files?.length) return;
    const id = await ensureOrder();
    if (!id) return;
    setBusy("upload");
    setError("");
    try {
      let latest: CustomerOrder | null = null;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        const res = await fetch(`/api/customer-orders/${id}/attachments`, {
          method: "POST",
          body: form,
        });
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

  function updateDyeingShade(key: string, patch: Partial<DyeingShadeDraft>) {
    setDyeingShades((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addDyeingPatchFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!customerId) {
      setError("Select a customer before uploading cloth patches");
      return;
    }
    const next = Array.from(files).map((file) => ({
      key: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setDyeingPatches((prev) => [...prev, ...next]);
    setError("");
  }

  function removeDyeingPatch(key: string) {
    setDyeingPatches((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }

  async function saveDyeingRequest(forCustomerId: string) {
    if (dyeingShadePayload.length > 0) {
      const res = await fetch("/api/customer-pending-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: forCustomerId,
          isUrgent,
          items: dyeingShadePayload.map((item) => ({
            customerId: forCustomerId,
            shadeCode: item.shadeCode,
            qty: item.qty,
            unit: item.unit,
            isUrgent,
          })),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save dyeing shades");
      }
    }

    for (const patch of dyeingPatches) {
      const form = new FormData();
      form.set("customerId", forCustomerId);
      form.set("file", patch.file);
      const res = await fetch("/api/customer-cloth-patches", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to upload dyeing cloth patch");
      }
    }
  }

  async function finish() {
    if (!customerId) {
      setError("Select a customer");
      return;
    }
    if (!hasOrderContent && !hasDyeingContent) {
      setError(
        "Add an order (slip, custom lines, or cloth patches) or a dyeing request (shade number or cloth patch)",
      );
      return;
    }

    setBusy("save");
    setError("");
    try {
      let createdOrderId: string | null = orderId;

      if (hasOrderContent) {
        const id = await ensureOrder();
        if (!id) return;
        createdOrderId = id;

        setBusy("save");
        await fetch(`/api/customer-orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isUrgent, orderDate }),
        });

        const res = await fetch(`/api/customer-orders/${id}/lines`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLinePayload,
            createMissingShades: true,
          }),
        });
        const json = (await res.json()) as {
          order?: CustomerOrder;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to save lines");
        }
      }

      if (hasDyeingContent) {
        await saveDyeingRequest(customerId);
      }

      reset();
      onClose();
      if (createdOrderId) {
        router.push(`/orders/customers/${createdOrderId}`);
      } else {
        router.push(`/entities/customers/${customerId}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setBusy("");
    }
  }

  const saveLabel =
    busy === "save" || busy === "create"
      ? "Saving…"
      : hasOrderContent && hasDyeingContent
        ? "Save"
        : hasDyeingContent && !hasOrderContent
          ? "Save dyeing request"
          : "Save and create order";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New customer order"
      size="xl"
    >
      <div className="space-y-5">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
                            className={`flex w-full items-center px-3 py-2 text-left text-sm ${
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
                          </button>
                        ))
                      )}
                    </div>,
                    document.body,
                  )
                : null}
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Date</span>
              <input
                type="date"
                value={orderDate}
                readOnly
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-border bg-sidebar/50 px-3 py-2.5 text-sm text-muted"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 sm:max-w-xs">
            <span className="text-sm font-medium">Urgent</span>
            <button
              type="button"
              role="switch"
              aria-checked={isUrgent}
              aria-label="Urgent"
              onClick={() => setIsUrgent((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isUrgent ? "bg-foreground" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${
                  isUrgent ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* 1. Order */}
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">1. Order</h3>
            <p className="mt-0.5 text-xs text-muted">
              Order slip, custom order, or cloth patches
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Order slips</h4>
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
                      <p className="mb-2 text-sm">{slip.fileName ?? "File"}</p>
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
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Custom order</h4>
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
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Add items
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Cloth patches</h4>
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
          </div>
        </section>

        <div className="relative flex items-center gap-3 py-1" role="separator">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* 2. Dyeing Request */}
        <section ref={dyeingSectionRef} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              2. Dyeing Request
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Shade number or cloth patch
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Shade number</h4>
            <div className="space-y-2">
              {dyeingShades.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.4fr_0.5fr_0.6fr_auto]"
                >
                  <input
                    value={row.shadeCode}
                    onChange={(e) =>
                      updateDyeingShade(row.key, {
                        shadeCode: e.target.value,
                      })
                    }
                    placeholder="Shade number"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                  />
                  <input
                    value={row.qty}
                    onChange={(e) =>
                      updateDyeingShade(row.key, { qty: e.target.value })
                    }
                    placeholder="Qty"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                  />
                  <select
                    value={row.unit}
                    onChange={(e) =>
                      updateDyeingShade(row.key, {
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
                      setDyeingShades((prev) =>
                        prev.length <= 1
                          ? prev
                          : prev.filter((s) => s.key !== row.key),
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
                  setDyeingShades((prev) => [...prev, emptyDyeingShade()])
                }
                className="text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Add shade
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Cloth patch</h4>
              <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addDyeingPatchFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {dyeingPatches.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {dyeingPatches.map((patch) => (
                  <div
                    key={patch.key}
                    className="rounded-lg border border-border p-1"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={patch.previewUrl}
                      alt={patch.file.name}
                      className="mb-1 h-20 w-full rounded object-cover"
                    />
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => removeDyeingPatch(patch.key)}
                      className="w-full rounded-md border border-border px-1 py-0.5 text-[10px]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3 pt-1">
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
            onClick={() => void finish()}
            className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
