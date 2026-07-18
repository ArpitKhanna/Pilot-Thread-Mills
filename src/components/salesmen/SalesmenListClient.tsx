"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import type { AppContext } from "@/app/(app)/layout";
import { formatINR, formatShortDate } from "@/lib/salesmen/mock-data";
import type { Salesman } from "@/lib/salesmen/types";

type SalesmenListClientProps = {
  context: AppContext;
  initialSalesmen: Salesman[];
};

export function SalesmenListClient({
  context,
  initialSalesmen,
}: SalesmenListClientProps) {
  const [salesmen, setSalesmen] = useState<Salesman[]>(initialSalesmen);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [lastBalance, setLastBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayed = useMemo(() => {
    return salesmen
      .filter((s) => (tab === "active" ? s.isActive : !s.isActive))
      .filter((s) =>
        search
          ? s.name.toLowerCase().includes(search.toLowerCase().trim())
          : true,
      )
      .sort((a, b) => {
        const aTime = a.lastInvoiceAt
          ? new Date(a.lastInvoiceAt).getTime()
          : 0;
        const bTime = b.lastInvoiceAt
          ? new Date(b.lastInvoiceAt).getTime()
          : 0;
        return bTime - aTime;
      });
  }, [salesmen, tab, search]);

  const activeCount = salesmen.filter((s) => s.isActive).length;
  const inactiveCount = salesmen.filter((s) => !s.isActive).length;

  function resetForm() {
    setName("");
    setPhone("");
    setAlternatePhone("");
    setLastBalance("");
    setError(null);
  }

  function closeAdd() {
    if (saving) return;
    setAddOpen(false);
    resetForm();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setError("Salesman name is required");
      return;
    }
    if (!trimmedPhone) {
      setError("Phone number is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/salesmen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          alternatePhone: alternatePhone.trim() || undefined,
          pendingBalance:
            lastBalance.trim() === "" ? undefined : Number(lastBalance),
        }),
      });
      const data = (await res.json()) as {
        salesman?: Salesman;
        error?: string;
      };
      if (!res.ok || !data.salesman) {
        setError(data.error ?? "Failed to create salesman");
        return;
      }
      setSalesmen((prev) => [data.salesman!, ...prev]);
      setTab("active");
      setAddOpen(false);
      resetForm();
    } catch {
      setError("Failed to create salesman");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Salesmen" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Salesmen
            </h1>
            <p className="mt-1 text-sm text-muted">
              Track purchases, payments, and pending balances
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setAddOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 sm:w-auto"
          >
            <span className="text-lg leading-none">+</span>
            Add New
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            No salesmen found
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {displayed.map((salesman) => (
              <Link
                key={salesman.id}
                href={`/entities/salesmen/${salesman.id}`}
                className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-foreground/20 hover:bg-sidebar/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="truncate text-base font-medium">
                    {salesman.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      salesman.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-sidebar text-muted"
                    }`}
                  >
                    {salesman.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Pending
                    </p>
                    <p
                      className={`mt-0.5 font-medium ${
                        salesman.pendingBalance > 0
                          ? "text-[#c45c26]"
                          : "text-foreground"
                      }`}
                    >
                      {formatINR(salesman.pendingBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Last Invoice
                    </p>
                    <p className="mt-0.5 text-sm font-medium">
                      {formatShortDate(salesman.lastInvoiceAt)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Modal
        open={addOpen}
        onClose={closeAdd}
        title="Add New Salesman"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={closeAdd}
              disabled={saving}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-salesman-form"
              disabled={saving}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Create salesman"}
            </button>
          </div>
        }
      >
        <form id="add-salesman-form" onSubmit={handleCreate} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Salesman name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
              placeholder="Full name"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Phone number
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
              placeholder="919876543210"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Alternate phone number
            </span>
            <input
              type="tel"
              value={alternatePhone}
              onChange={(e) => setAlternatePhone(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Last balance
            </span>
            <div className="flex overflow-hidden rounded-lg border border-border bg-background focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20">
              <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                ₹
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={lastBalance}
                onChange={(e) => setLastBalance(e.target.value)}
                className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none"
                placeholder="Optional"
              />
            </div>
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
