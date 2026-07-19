"use client";

import { useMemo, useState } from "react";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { CountCombobox } from "@/components/ui/CountCombobox";
import type { AppContext } from "@/app/(app)/layout";
import {
  COUNT_ITEM_TYPES,
  COUNT_OPTIONS,
  ITEM_TYPE_LABELS,
  ITEM_TYPES,
  type ItemType,
  type PriceListItem,
} from "@/lib/auth/types";

type PriceListClientProps = {
  context: AppContext;
  initialItems: PriceListItem[];
  pendingCount: number;
};

type FormState = {
  item_name: string;
  item_type: ItemType | "";
  count_label: string;
  salesmen_price: string;
  customer_price: string;
};

const emptyForm: FormState = {
  item_name: "",
  item_type: "",
  count_label: "",
  salesmen_price: "",
  customer_price: "",
};

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function capitalizeType(type: string) {
  return ITEM_TYPE_LABELS[type as ItemType] ?? type;
}

export function PriceListClient({
  context,
  initialItems,
  pendingCount,
}: PriceListClientProps) {
  const isAdmin = context.profile.role === "admin";
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<"approved" | "pending">("approved");
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [countFilter, setCountFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"approve" | "delete" | null>(
    null,
  );
  const [error, setError] = useState("");

  const displayedItems = useMemo(() => {
    return items
      .filter((item) =>
        tab === "approved"
          ? item.status === "approved"
          : item.status === "pending_approval",
      )
      .filter((item) =>
        search
          ? item.item_name.toLowerCase().includes(search.toLowerCase())
          : true,
      )
      .filter((item) =>
        typeFilter === "all" ? true : item.item_type === typeFilter,
      )
      .filter((item) =>
        countFilter === "all" ? true : item.count_label === countFilter,
      );
  }, [items, tab, search, typeFilter, countFilter]);

  function openAddModal() {
    setEditingItem(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(item: PriceListItem) {
    setEditingItem(item);
    setForm({
      item_name: item.item_name,
      item_type: item.item_type,
      count_label: item.count_label ?? "",
      salesmen_price: String(item.salesmen_price),
      customer_price: String(item.customer_price),
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        item_name: form.item_name,
        item_type: form.item_type,
        count_label:
          form.item_type &&
          COUNT_ITEM_TYPES.includes(form.item_type as ItemType)
            ? form.count_label || null
            : null,
        salesmen_price: Number(form.salesmen_price),
        customer_price: Number(form.customer_price),
      };

      const url = editingItem
        ? `/api/price-list/${editingItem.id}`
        : "/api/price-list";
      const method = editingItem ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      if (editingItem) {
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? data.item : i)),
        );
      } else {
        setItems((prev) => [...prev, data.item]);
      }
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item from the price list?")) return;
    if (busyId) return;
    setBusyId(id);
    setBusyAction("delete");
    try {
      const res = await fetch(`/api/price-list/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleApprove(id: string) {
    if (busyId) return;
    setBusyId(id);
    setBusyAction("approve");
    try {
      const res = await fetch(`/api/price-list/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? data.item : i)),
        );
      }
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  const pendingTabCount = items.filter(
    (i) => i.status === "pending_approval",
  ).length;

  const showCountField =
    form.item_type !== "" &&
    COUNT_ITEM_TYPES.includes(form.item_type as ItemType);

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Price List" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Price List
            </h1>
            <p className="mt-1 text-sm text-muted">
              List of all the items and their prices for salesmen and customers
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => setEditMode((e) => !e)}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                editMode
                  ? "border-foreground bg-foreground text-surface"
                  : "border-border bg-surface hover:bg-sidebar"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              Edit
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              <span className="text-lg leading-none">+</span>
              Add New Item
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="inline-flex w-full rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
            <button
              type="button"
              onClick={() => setTab("approved")}
              className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none sm:px-4 sm:py-1.5 ${
                tab === "approved"
                  ? "bg-sidebar font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Current Prices
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setTab("pending")}
                className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none sm:px-4 sm:py-1.5 ${
                  tab === "pending"
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                For Approval ({pendingTabCount || pendingCount})
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm sm:py-2"
            >
            <option value="all">Item Type</option>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {ITEM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

            <select
              value={countFilter}
              onChange={(e) => setCountFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm sm:py-2"
            >
              <option value="all">Count</option>
              {COUNT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:ml-auto sm:max-w-xs sm:py-2 lg:min-w-[220px]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-muted"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <input
              type="search"
              placeholder="Search by Item Name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {/* Mobile card list */}
        <div className="space-y-3 md:hidden">
          {displayedItems.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
              No items found
            </div>
          ) : (
            displayedItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium leading-snug">{item.item_name}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {capitalizeType(item.item_type)}
                      {item.count_label ? ` · ${item.count_label}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Salesmen
                    </p>
                    <p className="mt-0.5 font-medium">
                      {formatPrice(Number(item.salesmen_price))}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Customer
                    </p>
                    <p className="mt-0.5 font-medium">
                      {formatPrice(Number(item.customer_price))}
                    </p>
                  </div>
                </div>
                {(editMode || (tab === "pending" && isAdmin)) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {tab === "pending" && isAdmin && (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleApprove(item.id)}
                        className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-surface disabled:opacity-60"
                      >
                        {busyId === item.id && busyAction === "approve"
                          ? "Approving…"
                          : "Approve"}
                      </button>
                    )}
                    {editMode && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => openEditModal(item)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar disabled:opacity-60"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleDelete(item.id)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-60"
                          >
                            {busyId === item.id && busyAction === "delete"
                              ? "Deleting…"
                              : "Delete"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-table-header">
                <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                  Item Name
                </th>
                <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                  Count
                </th>
                <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                  Item Type
                </th>
                <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                  Salesmen
                </th>
                <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                  Customer
                </th>
                {(editMode || (tab === "pending" && isAdmin)) && (
                  <th className="px-5 py-3 text-right font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-muted"
                  >
                    No items found
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-sidebar/30"
                  >
                    <td className="px-5 py-4 font-medium">{item.item_name}</td>
                    <td className="px-5 py-4 text-muted">
                      {item.count_label ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      {capitalizeType(item.item_type)}
                    </td>
                    <td className="px-5 py-4">
                      {formatPrice(Number(item.salesmen_price))}
                    </td>
                    <td className="px-5 py-4">
                      {formatPrice(Number(item.customer_price))}
                    </td>
                    {(editMode || (tab === "pending" && isAdmin)) && (
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {tab === "pending" && isAdmin && (
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => handleApprove(item.id)}
                              className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-surface disabled:opacity-60"
                            >
                              {busyId === item.id && busyAction === "approve"
                                ? "Approving…"
                                : "Approve"}
                            </button>
                          )}
                          {editMode && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => openEditModal(item)}
                                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-sidebar disabled:opacity-60"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  disabled={busyId === item.id}
                                  onClick={() => handleDelete(item.id)}
                                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                                >
                                  {busyId === item.id && busyAction === "delete"
                                    ? "Deleting…"
                                    : "Delete"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Edit Item" : "Add New Item"}
        footer={
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Item"}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Item Name<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.item_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, item_name: e.target.value }))
              }
              placeholder="Item Name"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Item Type<span className="text-red-500">*</span>
            </label>
            <select
              value={form.item_type}
              onChange={(e) => {
                const item_type = e.target.value as ItemType | "";
                setForm((f) => ({
                  ...f,
                  item_type,
                  count_label:
                    item_type &&
                    COUNT_ITEM_TYPES.includes(item_type as ItemType)
                      ? f.count_label
                      : "",
                }));
              }}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
            >
              <option value="">Select type</option>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ITEM_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {showCountField && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Count</label>
              <CountCombobox
                options={COUNT_OPTIONS}
                value={form.count_label}
                onChange={(count_label) =>
                  setForm((f) => ({ ...f, count_label }))
                }
                placeholder="Count Type"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Salesmen Price<span className="text-red-500">*</span>
            </label>
            <div className="flex w-full items-center rounded-lg border border-border px-3 py-2.5">
              <span className="mr-2 text-muted">₹</span>
              <input
                type="number"
                min="0"
                value={form.salesmen_price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, salesmen_price: e.target.value }))
                }
                placeholder="Salesmen Price"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Customer Price<span className="text-red-500">*</span>
            </label>
            <div className="flex w-full items-center rounded-lg border border-border px-3 py-2.5">
              <span className="mr-2 text-muted">₹</span>
              <input
                type="number"
                min="0"
                value={form.customer_price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customer_price: e.target.value }))
                }
                placeholder="Customer Price"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          {!isAdmin && !editingItem && (
            <p className="rounded-lg bg-sidebar px-3 py-2 text-xs text-muted">
              Items you add will be sent to the admin for approval before
              appearing in Current Prices.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
