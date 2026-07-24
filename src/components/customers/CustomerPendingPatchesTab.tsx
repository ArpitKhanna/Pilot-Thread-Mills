"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import type { PriceListItem } from "@/lib/auth/types";
import {
  ORDER_LINE_UNIT_LABELS,
  PENDING_ITEM_STATUS_LABELS,
  type CustomerClothPatch,
  type CustomerOrderLineUnit,
  type CustomerPendingItem,
} from "@/lib/customer-orders/types";

type CustomerPendingPatchesTabProps = {
  customerId: string;
  customerName: string;
  phone?: string | null;
  priceList: PriceListItem[];
  initialPending: CustomerPendingItem[];
  initialPatches: CustomerClothPatch[];
};

export function CustomerPendingPatchesTab({
  customerId,
  customerName,
  priceList,
  initialPending,
  initialPatches,
}: CustomerPendingPatchesTabProps) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [patches, setPatches] = useState(initialPatches);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const [itemName, setItemName] = useState("");
  const [priceListItemId, setPriceListItemId] = useState<string | null>(null);
  const [shadeCode, setShadeCode] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<CustomerOrderLineUnit>("box");

  const [assignPatchId, setAssignPatchId] = useState<string | null>(null);
  const [assignShade, setAssignShade] = useState("");
  const [assignItemId, setAssignItemId] = useState<string | null>(null);
  const [assignItemName, setAssignItemName] = useState("");

  async function addMissing() {
    if (!shadeCode.trim() || !(Number(qty) > 0)) {
      setError("Shade and qty are required");
      return;
    }
    setBusy("missing");
    setError("");
    setWhatsappUrl(null);
    try {
      const res = await fetch("/api/customer-pending-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          items: [
            {
              priceListItemId,
              shadeCode: shadeCode.trim(),
              qty: Number(qty),
              unit,
            },
          ],
        }),
      });
      const json = (await res.json()) as {
        pending?: CustomerPendingItem[];
        whatsappUrl?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      if (json.pending) {
        setPending((prev) => [...json.pending!, ...prev]);
      }
      setWhatsappUrl(json.whatsappUrl ?? null);
      setShadeCode("");
      setQty("1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy("");
    }
  }

  async function uploadPatch(file: File | null) {
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const form = new FormData();
      form.set("customerId", customerId);
      form.set("file", file);
      const res = await fetch("/api/customer-cloth-patches", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as {
        patch?: CustomerClothPatch;
        error?: string;
      };
      if (!res.ok || !json.patch) {
        throw new Error(json.error ?? "Upload failed");
      }
      setPatches((prev) => [json.patch!, ...prev]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
    }
  }

  async function assignShadeToPatch() {
    if (!assignPatchId || !assignShade.trim()) {
      setError("Shade number is required");
      return;
    }
    setBusy("assign");
    setError("");
    try {
      const res = await fetch("/api/customer-cloth-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          patchId: assignPatchId,
          shadeCode: assignShade.trim(),
          priceListItemId: assignItemId,
        }),
      });
      const json = (await res.json()) as {
        patch?: CustomerClothPatch;
        error?: string;
      };
      if (!res.ok || !json.patch) {
        throw new Error(json.error ?? "Assign failed");
      }
      setPatches((prev) =>
        prev.map((p) => (p.id === assignPatchId ? json.patch! : p)),
      );
      setAssignPatchId(null);
      setAssignShade("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-sm font-medium">Pending / missing shades</h3>
        <p className="mt-1 text-xs text-muted">
          Missing items for {customerName}. Saving also creates a dyeing job.
        </p>

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
          >
            WhatsApp missing list →
          </a>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.5fr_0.6fr_auto]">
          <ItemNameCombobox
            items={priceList}
            value={itemName}
            onChange={(value) => {
              setItemName(value);
              setPriceListItemId(null);
            }}
            onSelect={(item) => {
              setItemName(item.item_name);
              setPriceListItemId(item.id);
            }}
            onTabToQty={() => undefined}
            showPrice={false}
            placeholder="Item"
          />
          <input
            value={shadeCode}
            onChange={(e) => setShadeCode(e.target.value)}
            placeholder="Shade"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <select
            value={unit}
            onChange={(e) =>
              setUnit(e.target.value as CustomerOrderLineUnit)
            }
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none"
          >
            {Object.entries(ORDER_LINE_UNIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy === "missing"}
            onClick={() => void addMissing()}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {busy === "missing" ? "…" : "Add"}
          </button>
        </div>

        <div className="mt-4 divide-y divide-border">
          {pending.length === 0 ? (
            <p className="py-4 text-sm text-muted">No pending items.</p>
          ) : (
            pending.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {item.itemName ?? "Item"} — {item.shadeCode}
                  </div>
                  <div className="text-xs text-muted">
                    {item.qty} {ORDER_LINE_UNIT_LABELS[item.unit]}
                    {item.invoiceDate ? ` · ${item.invoiceDate}` : ""}
                    {item.isUrgent ? " · Urgent" : ""}
                  </div>
                </div>
                <span className="rounded-md bg-sidebar px-2 py-0.5 text-xs">
                  {PENDING_ITEM_STATUS_LABELS[item.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Cloth patches</h3>
            <p className="mt-1 text-xs text-muted">
              Upload a patch, then assign a shade number when dyeing is done.
            </p>
          </div>
          <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-sidebar">
            {busy === "upload" ? "Uploading…" : "Upload patch"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={Boolean(busy)}
              onChange={(e) => {
                void uploadPatch(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {assignPatchId ? (
          <div className="mb-4 space-y-2 rounded-lg border border-border bg-sidebar/40 p-3">
            <p className="text-sm font-medium">Assign shade number</p>
            <ItemNameCombobox
              items={priceList}
              value={assignItemName}
              onChange={(value) => {
                setAssignItemName(value);
                setAssignItemId(null);
              }}
              onSelect={(item) => {
                setAssignItemName(item.item_name);
                setAssignItemId(item.id);
              }}
              onTabToQty={() => undefined}
              showPrice={false}
              placeholder="Item"
            />
            <input
              value={assignShade}
              onChange={(e) => setAssignShade(e.target.value)}
              placeholder="Shade code"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssignPatchId(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === "assign"}
                onClick={() => void assignShadeToPatch()}
                className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-50"
              >
                Save shade
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patches.length === 0 ? (
            <p className="text-sm text-muted">No cloth patches yet.</p>
          ) : (
            patches.map((patch) => (
              <div
                key={patch.id}
                className="overflow-hidden rounded-lg border border-border"
              >
                {patch.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={patch.signedUrl}
                    alt={patch.fileName ?? "Cloth patch"}
                    className="h-36 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-sidebar text-xs text-muted">
                    No preview
                  </div>
                )}
                <div className="space-y-1 p-3 text-sm">
                  <div className="font-medium">
                    {patch.status === "assigned"
                      ? `${patch.itemName ?? "Item"} — ${patch.shadeCode}`
                      : "Awaiting shade"}
                  </div>
                  {patch.status === "awaiting_shade" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignPatchId(patch.id);
                        setAssignItemId(patch.priceListItemId);
                        setAssignItemName(patch.itemName ?? "");
                        setAssignShade(patch.shadeCode ?? "");
                      }}
                      className="text-xs font-medium text-muted hover:text-foreground"
                    >
                      Assign shade number
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
