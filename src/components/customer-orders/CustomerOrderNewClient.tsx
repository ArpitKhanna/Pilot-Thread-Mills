"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import type { Salesman } from "@/lib/salesmen/types";

type CustomerOrderNewClientProps = {
  context: AppContext;
  customers: Salesman[];
};

export function CustomerOrderNewClient({
  context,
  customers: initialCustomers,
}: CustomerOrderNewClientProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => c.isActive)
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  async function createOrder(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        order?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Failed to create order");
      }
      router.push(`/orders/customers/${json.order.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
      setSaving(false);
    }
  }

  async function handleContinue() {
    if (!customerId) {
      setError("Select a customer");
      return;
    }
    await createOrder({
      customerId,
      orderDate,
      notes: notes.trim() || null,
    });
  }

  async function handleCreateCustomer() {
    if (!newName.trim()) {
      setError("Customer name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customer-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderDate,
          notes: notes.trim() || null,
          createCustomer: {
            name: newName.trim(),
            phone: newPhone.trim(),
          },
        }),
      });
      const json = (await res.json()) as {
        order?: { id: string; customerId: string; customerName?: string };
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Failed to create customer order");
      }
      setCustomers((prev) => [
        ...prev,
        {
          id: json.order!.customerId,
          name: newName.trim(),
          phone: newPhone.trim(),
          alternatePhone: "",
          entityType: "customer",
          isActive: true,
          pendingBalance: 0,
          lastInvoiceAt: null,
          discountRules: [],
        },
      ]);
      setModalOpen(false);
      router.push(`/orders/customers/${json.order.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
      setSaving(false);
    }
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Customer Orders", href: "/orders/customers" },
          { label: "New" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto max-w-xl space-y-6">
          <div>
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              New customer order
            </h1>
            <p className="mt-1 text-sm text-muted">
              Pick the customer, then upload the order slip and review shades.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Order date</span>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Customer</span>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(true);
                  setError("");
                }}
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                + Quick add
              </button>
            </div>
            <input
              type="search"
              placeholder="Search customers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-surface">
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  No customers found. Quick-add one to continue.
                </p>
              ) : (
                <ul>
                  {filtered.map((customer) => (
                    <li key={customer.id} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        onClick={() => setCustomerId(customer.id)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                          customerId === customer.id
                            ? "bg-sidebar font-medium"
                            : "hover:bg-sidebar/50"
                        }`}
                      >
                        <span>{customer.name}</span>
                        <span className="text-xs text-muted">
                          {customer.phone || "No phone"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
              placeholder="Market day, delivery notes…"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => router.push("/orders/customers")}
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-sidebar"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !customerId}
              onClick={handleContinue}
              className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Continue to slip upload"}
            </button>
          </div>
        </div>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="Quick add customer"
      >
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Phone</span>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={handleCreateCustomer}
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create customer & order"}
          </button>
        </div>
      </Modal>
    </>
  );
}
