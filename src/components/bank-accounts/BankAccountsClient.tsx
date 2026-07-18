"use client";

import { useMemo, useState } from "react";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import type { AppContext } from "@/app/(app)/layout";
import type { BankAccount } from "@/lib/bank-accounts/types";

type BankAccountsClientProps = {
  context: AppContext;
  initialAccounts: BankAccount[];
};

type FormState = {
  name: string;
  bankName: string;
  accountNumber: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  bankName: "",
  accountNumber: "",
  isActive: true,
};

function maskAccountNumber(accountNumber: string) {
  const digits = accountNumber.replace(/\s+/g, "");
  if (!digits) return "No. pending";
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
}

export function BankAccountsClient({
  context,
  initialAccounts,
}: BankAccountsClientProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const displayed = useMemo(() => {
    return accounts
      .filter((a) => (tab === "active" ? a.isActive : !a.isActive))
      .filter((a) => {
        if (!search) return true;
        const q = search.toLowerCase().trim();
        return (
          a.name.toLowerCase().includes(q) ||
          a.bankName.toLowerCase().includes(q) ||
          a.accountNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, tab, search]);

  const activeCount = accounts.filter((a) => a.isActive).length;
  const inactiveCount = accounts.filter((a) => !a.isActive).length;

  function openAddModal() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(account: BankAccount) {
    setEditing(account);
    setForm({
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      isActive: account.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        isActive: form.isActive,
      };

      const url = editing
        ? `/api/bank-accounts/${editing.id}`
        : "/api/bank-accounts";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      if (editing) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === editing.id ? data.account : a)),
        );
      } else {
        setAccounts((prev) => [...prev, data.account]);
      }
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this bank account?")) return;
    const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    }
  }

  async function handleToggleActive(account: BankAccount) {
    const res = await fetch(`/api/bank-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name || account.name,
        bankName: form.bankName || account.bankName,
        accountNumber: form.accountNumber,
        isActive: !form.isActive,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? data.account : a)),
      );
      setEditing(data.account);
      setForm((f) => ({ ...f, isActive: data.account.isActive }));
    }
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Bank Accounts" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Bank Accounts
            </h1>
            <p className="mt-1 text-sm text-muted">
              Deposit accounts used on invoices and payment entries
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
              placeholder="Search by name, bank, or account"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            No bank accounts found
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {displayed.map((account) => (
              <article
                key={account.id}
                className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-foreground/20 hover:bg-sidebar/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-medium">
                      {account.name}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {account.bankName}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      account.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-sidebar text-muted"
                    }`}
                  >
                    {account.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                    Account
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                    {maskAccountNumber(account.accountNumber)}
                  </p>
                </div>
                {editMode && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(account);
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(account.id);
                      }}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
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
        title={editing ? "Edit Bank Account" : "Add Bank Account"}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {editing && (
              <button
                type="button"
                onClick={() => handleToggleActive(editing)}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
              >
                {form.isActive ? "Mark inactive" : "Mark active"}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-surface disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Add account"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Account holder name
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Pilot Thread Mills"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Bank name
            </span>
            <input
              type="text"
              value={form.bankName}
              onChange={(e) =>
                setForm((f) => ({ ...f, bankName: e.target.value }))
              }
              placeholder="e.g. HDFC"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Account number
            </span>
            <input
              type="text"
              value={form.accountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountNumber: e.target.value }))
              }
              placeholder="Optional if not available yet"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-foreground/40"
            />
          </label>

          {!editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="rounded border-border"
              />
              Active (available for invoice deposits)
            </label>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}