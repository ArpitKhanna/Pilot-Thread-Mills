"use client";

import { useMemo, useState } from "react";
import { AppPage } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFooterActions } from "@/components/ui/modal-footer";
import { Modal } from "@/components/ui/Modal";
import type { AppContext } from "@/app/(app)/layout";
import { buildBankAccountWhatsAppShareUrl } from "@/lib/bank-accounts/mappers";
import type { BankAccount } from "@/lib/bank-accounts/types";
import { useSyncedState } from "@/lib/realtime/use-synced-state";

type BankAccountsClientProps = {
  context: AppContext;
  initialAccounts: BankAccount[];
};

type FormState = {
  name: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
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
  const [modalOpen, setModalOpen] = useState(false);
  const [accounts, setAccounts] = useSyncedState(initialAccounts, !modalOpen);
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
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
          a.accountNumber.toLowerCase().includes(q) ||
          a.ifscCode.toLowerCase().includes(q)
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
      ifscCode: account.ifscCode,
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
        ifscCode: form.ifscCode,
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
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(account: BankAccount) {
    if (toggling || saving) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/bank-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || account.name,
          bankName: form.bankName || account.bankName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
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
    } finally {
      setToggling(false);
    }
  }

  function handleShareWhatsApp(account: BankAccount) {
    const url = buildBankAccountWhatsAppShareUrl(account);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <AppPage
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Bank Accounts" },
        ]}
      >
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
            <Button type="button" onClick={openAddModal}>
              <span className="text-lg leading-none">+</span>
              Add New
            </Button>
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
              placeholder="Search by name, bank, account, or IFSC"
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
                    <div className="mt-0.5 flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm text-muted">
                        {account.bankName}
                      </p>
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
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareWhatsApp(account);
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-sidebar"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                      className="text-[#25D366]"
                    >
                      <path d="M17.472 14.382c-.297-.139-1.633-.797-1.885-.887-.252-.09-.435-.139-.618.14-.183.278-.708.886-.867 1.068-.159.182-.318.205-.591.069-.272-.14-1.15-.424-2.19-1.353-.81-.722-1.357-1.614-1.516-1.886-.159-.272-.017-.419.121-.557.124-.123.278-.318.417-.477.139-.159.185-.272.278-.454.093-.182.047-.34-.023-.478-.07-.139-.618-1.49-.847-2.043-.223-.536-.45-.463-.618-.472-.159-.008-.34-.01-.522-.01-.182 0-.478.069-.728.34-.252.272-.96.938-.96 2.29 0 1.352.984 2.66 1.121 2.845.139.182 2.17 3.312 5.26 4.645.735.318 1.31.508 1.757.65.739.296 1.412.254 1.944.154.593-.112 1.633-.667 1.864-1.312.23-.645.23-1.197.161-1.312-.069-.114-.252-.182-.53-.32zM12.05 21.75h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982 1.004-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      Account
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                      {maskAccountNumber(account.accountNumber)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      IFSC
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-medium tracking-wide">
                      {account.ifscCode || "—"}
                    </p>
                  </div>
                </div>
                {editMode && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === account.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(account);
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === account.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(account.id);
                      }}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
                    >
                      {busyId === account.id ? "Deleting…" : "Delete"}
                    </button>
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
        title={editing ? "Edit Bank Account" : "Add Bank Account"}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {editing && (
              <Button
                type="button"
                variant="outline"
                disabled={toggling || saving}
                onClick={() => handleToggleActive(editing)}
                className="sm:mr-auto"
              >
                {toggling
                  ? "Updating…"
                  : form.isActive
                    ? "Mark inactive"
                    : "Mark active"}
              </Button>
            )}
            <ModalFooterActions
              onCancel={() => setModalOpen(false)}
              onSubmit={handleSave}
              submitLabel={editing ? "Save changes" : "Add account"}
              busy={saving}
              submitDisabled={toggling}
            />
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="bank-name" className="mb-1.5 block text-xs text-muted">
              Account holder name
            </Label>
            <Input
              id="bank-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Pilot Thread Mills"
            />
          </div>

          <div>
            <Label htmlFor="bank-bank-name" className="mb-1.5 block text-xs text-muted">
              Bank name
            </Label>
            <Input
              id="bank-bank-name"
              type="text"
              value={form.bankName}
              onChange={(e) =>
                setForm((f) => ({ ...f, bankName: e.target.value }))
              }
              placeholder="e.g. HDFC"
            />
          </div>

          <div>
            <Label htmlFor="bank-account-number" className="mb-1.5 block text-xs text-muted">
              Account number
            </Label>
            <Input
              id="bank-account-number"
              type="text"
              value={form.accountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountNumber: e.target.value }))
              }
              placeholder="Optional if not available yet"
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="bank-ifsc" className="mb-1.5 block text-xs text-muted">
              IFSC code
            </Label>
            <Input
              id="bank-ifsc"
              type="text"
              value={form.ifscCode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ifscCode: e.target.value.toUpperCase(),
                }))
              }
              placeholder="e.g. HDFC0001234"
              maxLength={11}
              className="font-mono uppercase"
            />
          </div>

          {!editing && (
            <Label className="flex items-center gap-2 text-sm font-normal">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="size-4 rounded border-border"
              />
              Active (available for invoice deposits)
            </Label>
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