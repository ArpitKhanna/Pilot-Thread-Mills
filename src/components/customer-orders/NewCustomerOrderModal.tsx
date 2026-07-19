"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import type { Salesman } from "@/lib/salesmen/types";

type NewCustomerOrderModalProps = {
  open: boolean;
  onClose: () => void;
  customers: Salesman[];
};

export function NewCustomerOrderModal({
  open,
  onClose,
  customers: initialCustomers,
}: NewCustomerOrderModalProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);

  useEffect(() => {
    if (open) setCustomers(initialCustomers);
  }, [open, initialCustomers]);
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => c.isActive)
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  function reset() {
    setCustomerId("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setSearch("");
    setError("");
    setQuickAdd(false);
    setNewName("");
    setNewPhone("");
    setSaving(false);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

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
        order?: { id: string; customerId?: string };
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Failed to create order");
      }
      reset();
      onClose();
      router.push(`/orders/customers/${json.order.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
      setSaving(false);
    }
  }

  async function handleCreate() {
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

  async function handleQuickAddCustomer() {
    if (!newName.trim()) {
      setError("Customer name is required");
      return;
    }
    await createOrder({
      orderDate,
      notes: notes.trim() || null,
      createCustomer: {
        name: newName.trim(),
        phone: newPhone.trim(),
      },
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="New customer order">
      <div className="space-y-4">
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
                setQuickAdd((v) => !v);
                setError("");
              }}
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              {quickAdd ? "Pick existing" : "+ Quick add"}
            </button>
          </div>

          {quickAdd ? (
            <div className="space-y-3 rounded-xl border border-border p-3">
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
            </div>
          ) : (
            <>
              <input
                type="search"
                placeholder="Search customers"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
              />
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-surface">
                {filtered.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    No customers found. Use Quick add.
                  </p>
                ) : (
                  <ul>
                    {filtered.map((customer) => (
                      <li
                        key={customer.id}
                        className="border-b border-border last:border-0"
                      >
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
            </>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground"
            placeholder="Market day, delivery notes…"
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={handleClose}
            className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || (!quickAdd && !customerId)}
            onClick={quickAdd ? handleQuickAddCustomer : handleCreate}
            className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create order"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
