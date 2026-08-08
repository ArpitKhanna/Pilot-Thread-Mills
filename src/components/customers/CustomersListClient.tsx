"use client";

import { useMemo, useState } from "react";
import { CustomersSummaryCounters } from "@/components/customers/CustomersSummaryCounters";
import { AppPage } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListStatusTabs } from "@/components/ui/list-status-tabs";
import { Modal } from "@/components/ui/Modal";
import { ModalFooterActions } from "@/components/ui/modal-footer";
import { NativeSelect } from "@/components/ui/native-select";
import { PendingLink } from "@/components/ui/PendingLink";
import type { AppContext } from "@/app/(app)/layout";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { InvoiceSummary, MarketDay, Salesman } from "@/lib/salesmen/types";
import { useSyncedState } from "@/lib/realtime/use-synced-state";
import { MARKET_DAY_LABELS, MARKET_DAYS } from "@/lib/salesmen/types";

type CustomersListClientProps = {
  context: AppContext;
  initialCustomers: Salesman[];
  initialInvoiceSummaries: InvoiceSummary[];
};

type FormState = {
  name: string;
  phone: string;
  alternatePhone: string;
  lastBalance: string;
  marketDay: MarketDay | "";
  area: string;
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
  isActive: true,
};

export function CustomersListClient({
  context,
  initialCustomers,
  initialInvoiceSummaries,
}: CustomersListClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [customers, setCustomers] = useSyncedState(
    initialCustomers,
    !modalOpen,
  );
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [marketDayFilter, setMarketDayFilter] = useState<MarketDay | "">("");
  const [defaulterFilter, setDefaulterFilter] = useState<
    "all" | "defaulter" | "not"
  >("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [editMode, setEditMode] = useState(false);
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
      <AppPage
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers" },
        ]}
      >
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
            <Button
              type="button"
              variant={editMode ? "default" : "outline"}
              onClick={() => setEditMode((e) => !e)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              Edit
            </Button>
            <Button type="button" onClick={openAddModal}>
              <span className="text-lg leading-none">+</span>
              Add New
            </Button>
          </div>
        </div>

        <CustomersSummaryCounters
          customers={customers}
          invoiceSummaries={initialInvoiceSummaries}
        />

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ListStatusTabs
              value={tab}
              onValueChange={setTab}
              tabs={[
                { value: "active", label: "Active", count: activeCount },
                { value: "inactive", label: "Inactive", count: inactiveCount },
              ]}
            />

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
              <Input
                type="search"
                placeholder="Search by shop or area"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <NativeSelect
              value={marketDayFilter}
              onChange={(e) =>
                setMarketDayFilter(e.target.value as MarketDay | "")
              }
              aria-label="Filter by market day"
            >
              <option value="">All market days</option>
              {MARKET_DAYS.map((day) => (
                <option key={day} value={day}>
                  {MARKET_DAY_LABELS[day]}
                </option>
              ))}
            </NativeSelect>

            <NativeSelect
              value={defaulterFilter}
              onChange={(e) =>
                setDefaulterFilter(
                  e.target.value as "all" | "defaulter" | "not",
                )
              }
              aria-label="Filter by defaulter"
            >
              <option value="all">All customers</option>
              <option value="defaulter">Defaulters only</option>
              <option value="not">Not defaulters</option>
            </NativeSelect>

            <NativeSelect
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              aria-label="Filter by area"
            >
              <option value="">All areas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </NativeSelect>

            <NativeSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort customers"
            >
              <option value="name">Sort by Name</option>
              <option value="balance">Sort by Balance</option>
            </NativeSelect>
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            No customers found
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayed.map((customer) => (
              <article
                key={customer.id}
                className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-foreground/20 hover:bg-sidebar/40"
              >
                <PendingLink
                  href={`/entities/customers/${customer.id}`}
                  className="block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-2 text-base font-medium leading-snug">
                      {customer.name}
                    </h2>
                    {customer.isDefaulter ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"
                          aria-hidden
                        />
                        Defaulter
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                        Pending
                      </p>
                      <p
                        className={`mt-0.5 font-medium tabular-nums ${
                          customer.pendingBalance > 0
                            ? "text-warning"
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
                      <p className="mt-0.5 truncate text-sm font-medium">
                        {customer.area.trim() || "—"}
                      </p>
                    </div>
                  </div>
                </PendingLink>

                {editMode ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === customer.id}
                      onClick={() => openEditModal(customer)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === customer.id}
                      onClick={() => handleDelete(customer.id)}
                    >
                      {busyId === customer.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </AppPage>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Customer" : "Add New Customer"}
        footer={
          <ModalFooterActions
            onCancel={() => setModalOpen(false)}
            onSubmit={handleSave}
            submitLabel="Save Customer"
            busy={saving}
            busyLabel="Saving…"
          />
        }
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              Shop Name<span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Shop Name"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">
              Phone Number<span className="text-red-500">*</span>
            </Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="Phone Number"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Alternate Phone Number</Label>
            <Input
              type="tel"
              value={form.alternatePhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, alternatePhone: e.target.value }))
              }
              placeholder="Alternate Phone Number"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">Market Day</Label>
              <NativeSelect
                value={form.marketDay}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    marketDay: e.target.value as MarketDay | "",
                  }))
                }
                className="w-full sm:w-full sm:min-w-0"
              >
                <option value="">Select day</option>
                {MARKET_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {MARKET_DAY_LABELS[day]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <Label className="mb-1.5 block">Area</Label>
              <Input
                type="text"
                value={form.area}
                onChange={(e) =>
                  setForm((f) => ({ ...f, area: e.target.value }))
                }
                placeholder="Area"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Last Balance</Label>
            <div className="flex w-full items-center rounded-lg border border-border px-3 py-2.5">
              <span className="mr-2 text-muted">₹</span>
              <Input
                type="number"
                min="0"
                value={form.lastBalance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastBalance: e.target.value }))
                }
                placeholder="Last Balance"
                className="border-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

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
