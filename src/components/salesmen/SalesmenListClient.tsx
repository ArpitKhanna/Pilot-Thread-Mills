"use client";

import { useMemo, useState } from "react";
import { AppPage } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListStatusTabs } from "@/components/ui/list-status-tabs";
import { Modal } from "@/components/ui/Modal";
import { ModalFooterActions } from "@/components/ui/modal-footer";
import { PendingLink } from "@/components/ui/PendingLink";
import { SalesmenSummaryCounters } from "@/components/salesmen/SalesmenSummaryCounters";
import type { AppContext } from "@/app/(app)/layout";
import { formatINR, formatShortDate } from "@/lib/salesmen/mock-data";
import { useSyncedState } from "@/lib/realtime/use-synced-state";
import type { InvoiceSummary, Salesman } from "@/lib/salesmen/types";

type SalesmenListClientProps = {
  context: AppContext;
  initialSalesmen: Salesman[];
  initialInvoiceSummaries: InvoiceSummary[];
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
  initialInvoiceSummaries,
}: SalesmenListClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [salesmen, setSalesmen] = useSyncedState(initialSalesmen, !modalOpen);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
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
        salesman.openingBalance > 0 ? String(salesman.openingBalance) : "",
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
      <AppPage
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Salesmen" },
        ]}
      >
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

        <SalesmenSummaryCounters
          salesmen={salesmen}
          invoiceSummaries={initialInvoiceSummaries}
        />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0"
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
                  href={`/entities/salesmen/${salesman.id}?tab=invoices`}
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
                            ? "text-warning"
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === salesman.id}
                      onClick={() => openEditModal(salesman)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === salesman.id}
                      onClick={() => handleDelete(salesman.id)}
                    >
                      {busyId === salesman.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </AppPage>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Salesman" : "Add New Salesman"}
        footer={
          <ModalFooterActions
            onCancel={() => setModalOpen(false)}
            onSubmit={handleSave}
            submitLabel="Save Salesman"
            busy={saving}
            busyLabel="Saving…"
          />
        }
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              Salesman Name<span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Salesman Name"
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
