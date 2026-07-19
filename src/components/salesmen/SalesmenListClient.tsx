"use client";

import { useMemo, useState } from "react";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { PendingLink } from "@/components/ui/PendingLink";
import type { AppContext } from "@/app/(app)/layout";
import { formatINR, formatShortDate } from "@/lib/salesmen/mock-data";
import type { Salesman } from "@/lib/salesmen/types";

type SalesmenListClientProps = {
  context: AppContext;
  initialSalesmen: Salesman[];
};

type FormState = {
  name: string;
  phone: string;
  alternatePhone: string;
  lastBalance: string;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  alternatePhone: "",
  lastBalance: "",
};

export function SalesmenListClient({
  context,
  initialSalesmen,
}: SalesmenListClientProps) {
  const [salesmen, setSalesmen] = useState<Salesman[]>(initialSalesmen);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Salesman | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  function openAddModal() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(salesman: Salesman) {
    setEditing(salesman);
    setForm({
      name: salesman.name,
      phone: salesman.phone,
      alternatePhone: salesman.alternatePhone,
      lastBalance:
        salesman.pendingBalance > 0 ? String(salesman.pendingBalance) : "",
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
      if (!trimmedName) throw new Error("Salesman Name is required");
      if (!trimmedPhone) throw new Error("Phone Number is required");

      const payload = {
        name: trimmedName,
        phone: trimmedPhone,
        alternatePhone: form.alternatePhone.trim(),
        pendingBalance:
          form.lastBalance.trim() === ""
            ? 0
            : Number(form.lastBalance),
      };

      const url = editing
        ? `/api/salesmen/${encodeURIComponent(editing.id)}`
        : "/api/salesmen";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        salesman?: Salesman;
        error?: string;
      };
      if (!res.ok || !data.salesman) {
        throw new Error(data.error ?? "Failed to save");
      }

      if (editing) {
        setSalesmen((prev) =>
          prev.map((s) => (s.id === editing.id ? data.salesman! : s)),
        );
      } else {
        setSalesmen((prev) => [data.salesman!, ...prev]);
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
    if (!confirm("Delete this salesman?")) return;
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/salesmen/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Failed to delete salesman");
        return;
      }
      setSalesmen((prev) => prev.filter((s) => s.id !== id));
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
              <article
                key={salesman.id}
                className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-foreground/20 hover:bg-sidebar/40"
              >
                <PendingLink
                  href={`/entities/salesmen/${salesman.id}`}
                  className="block"
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
                </PendingLink>

                {editMode && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      disabled={busyId === salesman.id}
                      onClick={() => openEditModal(salesman)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === salesman.id}
                      onClick={() => handleDelete(salesman.id)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 disabled:opacity-60"
                    >
                      {busyId === salesman.id ? "Deleting…" : "Delete"}
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
        title={editing ? "Edit Salesman" : "Add New Salesman"}
        footer={
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {saving ? "Saving…" : editing ? "Save Salesman" : "Save Salesman"}
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Salesman Name<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Salesman Name"
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
