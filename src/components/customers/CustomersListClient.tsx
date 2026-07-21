"use client";

import { useMemo, useState } from "react";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import type { AppContext } from "@/app/(app)/layout";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { MarketDay, Salesman } from "@/lib/salesmen/types";
import { MARKET_DAY_LABELS, MARKET_DAYS } from "@/lib/salesmen/types";

type CustomersListClientProps = {
  context: AppContext;
  initialCustomers: Salesman[];
};

type FormState = {
  name: string;
  phone: string;
  alternatePhone: string;
  lastBalance: string;
  marketDay: MarketDay | "";
  area: string;
  isDefaulter: boolean;
  isActive: boolean;
};

type SortKey = "name" | "balance";

const emptyForm: FormState = {
  name: "",
  phone: "",
  alternatePhone: "",
  lastBalance: "",
  marketDay: "",
  area: "",
  isDefaulter: false,
  isActive: true,
};

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground sm:w-auto sm:min-w-[140px]";

export function CustomersListClient({
  context,
  initialCustomers,
}: CustomersListClientProps) {
  const [customers, setCustomers] = useState<Salesman[]>(initialCustomers);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [marketDayFilter, setMarketDayFilter] = useState<MarketDay | "">("");
  const [defaulterFilter, setDefaulterFilter] = useState<
    "all" | "defaulter" | "not"
  >("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [editMode, setEditMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Salesman | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      const area = c.area.trim();
      if (area) set.add(area);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const displayed = useMemo(() => {
    const filtered = customers
      .filter((c) => (tab === "active" ? c.isActive : !c.isActive))
      .filter((c) =>
        search
          ? c.name.toLowerCase().includes(search.toLowerCase().trim()) ||
            c.area.toLowerCase().includes(search.toLowerCase().trim())
          : true,
      )
      .filter((c) =>
        marketDayFilter ? c.marketDay === marketDayFilter : true,
      )
      .filter((c) => {
        if (defaulterFilter === "defaulter") return c.isDefaulter;
        if (defaulterFilter === "not") return !c.isDefaulter;
        return true;
      })
      .filter((c) =>
        areaFilter ? c.area.trim() === areaFilter : true,
      );

    return filtered.sort((a, b) => {
      if (sortBy === "balance") {
        if (b.pendingBalance !== a.pendingBalance) {
          return b.pendingBalance - a.pendingBalance;
        }
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    customers,
    tab,
    search,
    marketDayFilter,
    defaulterFilter,
    areaFilter,
    sortBy,
  ]);

  const activeCount = customers.filter((c) => c.isActive).length;
  const inactiveCount = customers.filter((c) => !c.isActive).length;

  function openAddModal() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(customer: Salesman) {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      alternatePhone: customer.alternatePhone,
      lastBalance:
        customer.pendingBalance > 0 ? String(customer.pendingBalance) : "",
      marketDay: customer.marketDay,
      area: customer.area,
      isDefaulter: customer.isDefaulter,
      isActive: customer.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const trimmedName = form.name.trim();
      const trimmedPhone = form.phone.trim();
      if (!trimmedName) throw new Error("Shop Name is required");
      if (!trimmedPhone) throw new Error("Phone Number is required");

      const payload = {
        name: trimmedName,
        phone: trimmedPhone,
        alternatePhone: form.alternatePhone.trim(),
        pendingBalance:
          form.lastBalance.trim() === "" ? 0 : Number(form.lastBalance),
        marketDay: form.marketDay,
        area: form.area.trim(),
        isDefaulter: form.isDefaulter,
        ...(editing ? { isActive: form.isActive } : {}),
      };

      const url = editing
        ? `/api/customers/${encodeURIComponent(editing.id)}`
        : "/api/customers";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        customer?: Salesman;
        error?: string;
      };
      if (!res.ok || !data.customer) {
        throw new Error(data.error ?? "Failed to save");
      }

      if (editing) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === editing.id ? data.customer! : c)),
        );
      } else {
        setCustomers((prev) => [data.customer!, ...prev]);
        setTab("active");
      }
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Failed to delete customer");
        return;
      }
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Customers
            </h1>
            <p className="mt-1 text-sm text-muted">
              Track shops, market days, balances, and defaulters
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
              Add New
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex w-full rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none sm:px-4 sm:py-1.5 ${
                  tab === "active"
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setTab("inactive")}
                className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none sm:px-4 sm:py-1.5 ${
                  tab === "inactive"
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Inactive ({inactiveCount})
              </button>
            </div>

            <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:ml-auto sm:max-w-xs sm:py-2 lg:min-w-[220px]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-muted"
                aria-hidden
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
                <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <input
                type="search"
                placeholder="Search by shop or area"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              value={marketDayFilter}
              onChange={(e) =>
                setMarketDayFilter(e.target.value as MarketDay | "")
              }
              className={selectClass}
              aria-label="Filter by market day"
            >
              <option value="">All market days</option>
              {MARKET_DAYS.map((day) => (
                <option key={day} value={day}>
                  {MARKET_DAY_LABELS[day]}
                </option>
              ))}
            </select>

            <select
              value={defaulterFilter}
              onChange={(e) =>
                setDefaulterFilter(
                  e.target.value as "all" | "defaulter" | "not",
                )
              }
              className={selectClass}
              aria-label="Filter by defaulter"
            >
              <option value="all">All customers</option>
              <option value="defaulter">Defaulters only</option>
              <option value="not">Not defaulters</option>
            </select>

            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className={selectClass}
              aria-label="Filter by area"
            >
              <option value="">All areas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className={selectClass}
              aria-label="Sort customers"
            >
              <option value="name">Sort by Name</option>
              <option value="balance">Sort by Balance</option>
            </select>
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            No customers found
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {displayed.map((customer) => (
              <article
                key={customer.id}
                className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-foreground/20 hover:bg-sidebar/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="truncate text-base font-medium">
                    {customer.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      customer.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-sidebar text-muted"
                    }`}
                  >
                    {customer.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {customer.isDefaulter ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"
                      aria-hidden
                    />
                    Defaulter
                  </p>
                ) : (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                      aria-hidden
                    />
                    Not a defaulter
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Pending
                    </p>
                    <p
                      className={`mt-0.5 font-medium ${
                        customer.pendingBalance > 0
                          ? "text-[#c45c26]"
                          : "text-foreground"
                      }`}
                    >
                      {formatINR(customer.pendingBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Market Day
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                      {customer.marketDay
                        ? MARKET_DAY_LABELS[customer.marketDay]
                        : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Area
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                      {customer.area.trim() || "—"}
                    </p>
                  </div>
                </div>

                {editMode && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      disabled={busyId === customer.id}
                      onClick={() => openEditModal(customer)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === customer.id}
                      onClick={() => handleDelete(customer.id)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-60"
                    >
                      {busyId === customer.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Customer" : "Add New Customer"}
        footer={
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Customer"}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Shop Name<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Shop Name"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Phone Number<span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="Phone Number"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Alternate Phone Number
            </label>
            <input
              type="tel"
              value={form.alternatePhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, alternatePhone: e.target.value }))
              }
              placeholder="Alternate Phone Number"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Market Day
              </label>
              <select
                value={form.marketDay}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    marketDay: e.target.value as MarketDay | "",
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
              >
                <option value="">Select day</option>
                {MARKET_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {MARKET_DAY_LABELS[day]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Area</label>
              <input
                type="text"
                value={form.area}
                onChange={(e) =>
                  setForm((f) => ({ ...f, area: e.target.value }))
                }
                placeholder="Area"
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-foreground"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Last Balance
            </label>
            <div className="flex w-full items-center rounded-lg border border-border px-3 py-2.5">
              <span className="mr-2 text-muted">₹</span>
              <input
                type="number"
                min="0"
                value={form.lastBalance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastBalance: e.target.value }))
                }
                placeholder="Last Balance"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefaulter}
              onChange={(e) =>
                setForm((f) => ({ ...f, isDefaulter: e.target.checked }))
              }
              className="rounded border-border"
            />
            Mark as defaulter
          </label>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="rounded border-border"
              />
              Active
            </label>
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
