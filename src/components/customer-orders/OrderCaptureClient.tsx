"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import type { PriceListItem } from "@/lib/auth/types";
import type { ExtractedOrderSlip } from "@/lib/customer-orders/ocr-extract";
import {
  ORDER_LINE_UNIT_LABELS,
  type CustomerOrderLineUnit,
} from "@/lib/customer-orders/types";
import { useMobileOrderEntry } from "@/lib/customer-orders/use-mobile-order-entry";
import type { Salesman } from "@/lib/salesmen/types";

type Step = "capture" | "processing" | "review";

type MenuPos = { top: number; left: number; width: number };

type DraftLine = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
};

type OrderCaptureClientProps = {
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

function linesFromExtraction(extraction: ExtractedOrderSlip): DraftLine[] {
  if (extraction.lines.length === 0) {
    return [emptyLine()];
  }
  return extraction.lines.map((line) => ({
    key: crypto.randomUUID(),
    priceListItemId: null,
    itemName: line.itemName ?? "",
    shadeCode: line.shadeCode,
    qty: String(line.qty),
    unit: line.unit,
  }));
}

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function matchCustomer(
  customers: Salesman[],
  extraction: ExtractedOrderSlip,
): Salesman | null {
  const phone = normalizePhone(extraction.customerPhone ?? "");
  if (phone.length >= 6) {
    const byPhone = customers.find(
      (c) => normalizePhone(c.phone ?? "").includes(phone) ||
        phone.includes(normalizePhone(c.phone ?? "")),
    );
    if (byPhone) return byPhone;
  }

  const name = (extraction.customerName ?? "").trim().toLowerCase();
  if (!name) return null;

  const exact = customers.find((c) => c.name.trim().toLowerCase() === name);
  if (exact) return exact;

  const partial = customers.find(
    (c) =>
      c.name.trim().toLowerCase().includes(name) ||
      name.includes(c.name.trim().toLowerCase()),
  );
  return partial ?? null;
}

function CaptureIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm">
      {children}
    </span>
  );
}

export function OrderCaptureClient({
  customers,
  priceList,
}: OrderCaptureClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMobileOrderEntry();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("capture");
  const [cameraError, setCameraError] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [busy, setBusy] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrRaw, setOcrRaw] = useState<unknown>(null);

  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerMenuPos, setCustomerMenuPos] = useState<MenuPos | null>(null);
  const customerListId = useId();
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const customerMenuRef = useRef<HTMLDivElement | null>(null);

  const [orderDate, setOrderDate] = useState(todayLocalDate);
  const [isUrgent, setIsUrgent] = useState(false);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine()]);

  const activeCustomers = useMemo(
    () =>
      customers
        .filter((c) => c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  );

  const selectedCustomer =
    activeCustomers.find((c) => c.id === customerId) ?? null;

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (
      !q ||
      (selectedCustomer && selectedCustomer.name.toLowerCase() === q)
    ) {
      return activeCustomers;
    }
    return activeCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [activeCustomers, customerQuery, selectedCustomer]);

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
          source: "ocr" as const,
        })),
    [lines],
  );

  useEffect(() => {
    if (!isMobile) {
      router.replace("/orders/customers?create=order");
    }
  }, [isMobile, router]);

  useEffect(() => {
    const initialCustomerId = searchParams.get("customerId");
    if (!initialCustomerId) return;
    const customer = activeCustomers.find((c) => c.id === initialCustomerId);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerQuery(customer.name);
  }, [searchParams, activeCustomers]);

  const stopCamera = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (step !== "capture") return;
    setCameraError("");
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported on this device. Use Gallery instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError(
        "Camera access denied. Use Gallery to pick a photo or Manual Order.",
      );
    }
  }, [step, stopCamera]);

  useEffect(() => {
    if (step !== "capture") {
      stopCamera();
      return;
    }
    void startCamera();
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    setCaptureError("");
  }

  function applyExtraction(extraction: ExtractedOrderSlip, raw: unknown) {
    setOcrRaw(raw);
    setLines(linesFromExtraction(extraction));
    setNotes(extraction.notes ?? "");
    setIsUrgent(extraction.isUrgent);
    if (extraction.orderDate) {
      setOrderDate(extraction.orderDate);
    }

    const matched = matchCustomer(activeCustomers, extraction);
    if (matched) {
      setCustomerId(matched.id);
      setCustomerQuery(matched.name);
    } else if (extraction.customerName) {
      setCustomerId("");
      setCustomerQuery(extraction.customerName);
    } else {
      setCustomerId("");
      setCustomerQuery("");
    }

    setStep("review");
  }

  async function processImageFile(file: File) {
    setCaptureError("");
    setStep("processing");
    setImageFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    const form = new FormData();
    form.set("file", file);

    try {
      const res = await fetch("/api/customer-orders/extract-slip", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        extraction?: ExtractedOrderSlip;
        raw?: unknown;
        error?: string;
      };
      if (!res.ok || !json.extraction) {
        throw new Error(json.error ?? "Failed to read order slip");
      }
      applyExtraction(json.extraction, json.raw ?? json.extraction);
    } catch (e) {
      setCaptureError(
        e instanceof Error ? e.message : "Failed to extract order from image",
      );
      setStep("capture");
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setCaptureError("Camera not ready. Try again in a moment.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setCaptureError("Failed to capture photo");
      return;
    }

    const file = new File([blob], `order-slip-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    await processImageFile(file);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function retake() {
    setCaptureError("");
    setImageFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setOcrRaw(null);
    setStep("capture");
  }

  function goManual() {
    router.push("/orders/customers?create=order&manual=1");
  }

  async function confirmOrder() {
    if (!customerId) {
      setCaptureError("Select a customer");
      return;
    }
    if (orderLinePayload.length === 0 && !imageFile) {
      setCaptureError("Add at least one line item or retake the photo");
      return;
    }

    setBusy(true);
    setCaptureError("");

    try {
      const createRes = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          orderDate,
          isUrgent,
          notes: notes.trim() || null,
        }),
      });
      const createJson = (await createRes.json()) as {
        order?: { id: string };
        error?: string;
      };
      if (!createRes.ok || !createJson.order?.id) {
        throw new Error(createJson.error ?? "Failed to create order");
      }

      const orderId = createJson.order.id;

      if (imageFile) {
        const form = new FormData();
        form.set("file", imageFile);
        form.set("kind", "order_slip");
        if (ocrRaw) {
          form.set("ocrRawJson", JSON.stringify(ocrRaw));
        }
        const attachRes = await fetch(
          `/api/customer-orders/${orderId}/attachments`,
          { method: "POST", body: form },
        );
        const attachJson = (await attachRes.json()) as { error?: string };
        if (!attachRes.ok) {
          throw new Error(attachJson.error ?? "Failed to upload order slip");
        }
      }

      if (orderLinePayload.length > 0) {
        const linesRes = await fetch(`/api/customer-orders/${orderId}/lines`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: orderLinePayload,
            createMissingShades: true,
          }),
        });
        const linesJson = (await linesRes.json()) as { error?: string };
        if (!linesRes.ok) {
          throw new Error(linesJson.error ?? "Failed to save lines");
        }
      }

      router.push(`/orders/customers/${orderId}`);
      router.refresh();
    } catch (e) {
      setCaptureError(e instanceof Error ? e.message : "Failed to save order");
      setBusy(false);
    }
  }

  if (!isMobile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">
        Redirecting…
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={retake}
            className="rounded-lg p-2 text-muted hover:bg-sidebar"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 16L6.5 10l6-6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="text-base font-semibold">Review order</h1>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Captured order slip"
              className="max-h-48 w-full rounded-xl border border-border object-contain bg-sidebar"
            />
          ) : null}

          {captureError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {captureError}
            </p>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Customer</span>
            <input
              ref={customerInputRef}
              type="text"
              role="combobox"
              aria-expanded={customerOpen}
              aria-controls={customerListId}
              value={customerQuery}
              placeholder="Search customer…"
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
              onFocus={() => setCustomerOpen(true)}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerId("");
                setCustomerOpen(true);
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
                          className="flex w-full px-3 py-2 text-left text-sm hover:bg-sidebar"
                          onClick={() => selectCustomer(customer)}
                        >
                          <span className="font-medium">{customer.name}</span>
                          {customer.phone ? (
                            <span className="ml-2 text-muted">
                              {customer.phone}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>,
                  document.body,
                )
              : null}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Date</span>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </label>
            <div className="flex items-end justify-between gap-3 pb-1">
              <span className="text-sm font-medium">Urgent</span>
              <button
                type="button"
                role="switch"
                aria-checked={isUrgent}
                onClick={() => setIsUrgent((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
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

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Optional notes"
            />
          </label>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Line items</h2>
            {orderLinePayload.length === 0 ? (
              <p className="text-sm text-amber-700">
                No lines were extracted. Add items below or retake the photo.
              </p>
            ) : null}
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-border p-2"
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
                <div className="grid grid-cols-[1fr_0.5fr_0.7fr_auto] gap-2">
                  <input
                    value={line.shadeCode}
                    onChange={(e) =>
                      updateLine(line.key, { shadeCode: e.target.value })
                    }
                    placeholder="Shade"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    value={line.qty}
                    onChange={(e) =>
                      updateLine(line.key, { qty: e.target.value })
                    }
                    placeholder="Qty"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <select
                    value={line.unit}
                    onChange={(e) =>
                      updateLine(line.key, {
                        unit: e.target.value as CustomerOrderLineUnit,
                      })
                    }
                    className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
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
                    className="rounded-md border border-border px-2 text-xs text-red-700"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              className="text-sm font-medium text-muted underline-offset-2 hover:underline"
            >
              Add item
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={retake}
            disabled={busy}
            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={() => void confirmOrder()}
            disabled={busy}
            className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-surface disabled:opacity-60"
          >
            {busy ? "Saving…" : "Confirm order"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-black text-white">
      <canvas ref={canvasRef} className="hidden" />

      <header className="absolute top-0 right-0 left-0 z-20 flex items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => router.push("/orders/customers")}
          className="rounded-full p-2 text-white/90 hover:bg-white/10"
          aria-label="Back"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M13.5 17L7.5 11l6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {step === "processing" && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Processing"
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-black/45 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
            {step === "processing"
              ? "Reading order slip…"
              : "Photograph order slip"}
          </p>
        </div>

        {step === "processing" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : null}

        {cameraError ? (
          <div className="absolute right-4 bottom-4 left-4 rounded-xl bg-black/70 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
            {cameraError}
          </div>
        ) : null}

        {captureError ? (
          <div className="absolute right-4 bottom-24 left-4 rounded-xl bg-red-900/80 px-4 py-3 text-sm text-white backdrop-blur-sm">
            {captureError}
          </div>
        ) : null}
      </div>

      <div className="relative z-10 bg-[#0a0a0a] px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-5 flex items-end justify-center gap-10">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={step === "processing"}
            className="flex flex-col items-center gap-2 disabled:opacity-50"
          >
            <CaptureIcon>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect
                  x="3"
                  y="5"
                  width="16"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <circle cx="8" cy="9" r="1.5" fill="currentColor" />
                <path
                  d="M3 15l4-4 3 3 4-5 5 6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </CaptureIcon>
            <span className="text-xs text-white/70">Gallery</span>
          </button>

          <button
            type="button"
            onClick={goManual}
            disabled={step === "processing"}
            className="flex flex-col items-center gap-2 disabled:opacity-50"
          >
            <CaptureIcon>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M5 4h12v14H5z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 8h6M8 11h4M8 14h5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </CaptureIcon>
            <span className="text-xs text-white/70">Manual Order</span>
          </button>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void captureFromCamera()}
            disabled={step === "processing" || Boolean(cameraError)}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-white/10 disabled:opacity-40"
            aria-label="Capture photo"
          >
            <span className="h-[56px] w-[56px] rounded-full bg-white" />
          </button>
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void processImageFile(file);
          }}
        />
      </div>
    </div>
  );
}
