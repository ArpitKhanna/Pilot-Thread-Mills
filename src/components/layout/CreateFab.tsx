"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BankAccount } from "@/lib/bank-accounts/types";
import { AddExpenseModal } from "@/components/dashboard/AddExpenseModal";
import { AddLedgerReceiptModal } from "@/components/dashboard/AddLedgerReceiptModal";

type CreateFabProps = {
  canAddReceipt: boolean;
  canAddPayment: boolean;
  canCreateOrder: boolean;
  canCreateCustomerInvoice: boolean;
  canCreateSalesmenInvoice: boolean;
  canCreateDyeingOrder: boolean;
};

type FabAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

const menuVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 12 },
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: index * 0.045,
      type: "spring" as const,
      stiffness: 420,
      damping: 28,
    },
  }),
  exit: (index: number) => ({
    opacity: 0,
    scale: 0.94,
    y: 8,
    transition: {
      delay: (5 - index) * 0.025,
      duration: 0.15,
    },
  }),
};

function ActionIcon({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_rgba(0,0,0,0.18)] ${className}`}
    >
      {children}
    </span>
  );
}

export function CreateFab({
  canAddReceipt,
  canAddPayment,
  canCreateOrder,
  canCreateCustomerInvoice,
  canCreateSalesmenInvoice,
  canCreateDyeingOrder,
}: CreateFabProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const openReceipt = useCallback(() => {
    closeMenu();
    setReceiptOpen(true);
  }, [closeMenu]);

  const openPayment = useCallback(() => {
    closeMenu();
    setPaymentOpen(true);
  }, [closeMenu]);

  const actions = useMemo(() => {
    const items: FabAction[] = [];

    if (canCreateOrder) {
      items.push({
        id: "order",
        label: "Order",
        icon: (
          <ActionIcon className="bg-gradient-to-br from-sky-400 to-blue-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4 3h10a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M6 7h6M6 10h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </ActionIcon>
        ),
        onSelect: () => {
          closeMenu();
          router.push("/orders/customers/new");
        },
      });
    }

    if (canCreateCustomerInvoice) {
      items.push({
        id: "customer-invoice",
        label: "Customer Invoice",
        icon: (
          <ActionIcon className="bg-gradient-to-br from-violet-400 to-purple-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M5 2h8l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M13 2v3h3M6 9h6M6 12h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </ActionIcon>
        ),
        onSelect: () => {
          closeMenu();
          router.push("/orders/customers?create=customer-invoice");
        },
      });
    }

    if (canCreateSalesmenInvoice) {
      items.push({
        id: "salesmen-invoice",
        label: "Salesmen Invoice",
        icon: (
          <ActionIcon className="bg-gradient-to-br from-indigo-400 to-blue-700">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 14V6l6-3 6 3v8l-6 3-6-3z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M9 3v12M3 6l6 3 6-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </ActionIcon>
        ),
        onSelect: () => {
          closeMenu();
          router.push("/orders/salesmen");
        },
      });
    }

    if (canCreateDyeingOrder) {
      items.push({
        id: "dyeing-order",
        label: "Dyeing Order",
        icon: (
          <ActionIcon className="bg-gradient-to-br from-fuchsia-400 to-pink-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 14a5 5 0 100-10 5 5 0 000 10z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M6 8h6M7 11h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </ActionIcon>
        ),
        onSelect: () => {
          closeMenu();
          router.push("/orders/customers?create=dyeing");
        },
      });
    }

    if (canAddReceipt) {
      items.push({
        id: "receipt",
        label: "Receipt",
        icon: (
          <ActionIcon className="bg-gradient-to-br from-emerald-400 to-green-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M12 4L6 10l-2-2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 4v10H4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ActionIcon>
        ),
        onSelect: openReceipt,
      });
    }

    if (canAddPayment) {
      items.push({
        id: "payment",
        label: "Payment",
        icon: (
          <ActionIcon className="bg-gradient-to-br from-orange-400 to-amber-600">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M6 14l6-6M8 4h6v6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 14V4h10"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ActionIcon>
        ),
        onSelect: openPayment,
      });
    }

    return items;
  }, [
    canAddPayment,
    canAddReceipt,
    canCreateCustomerInvoice,
    canCreateDyeingOrder,
    canCreateOrder,
    canCreateSalesmenInvoice,
    closeMenu,
    openPayment,
    openReceipt,
    router,
  ]);

  useEffect(() => {
    if (!receiptOpen) return;
    void fetch("/api/bank-accounts")
      .then((r) => r.json())
      .then((data: { accounts?: BankAccount[] }) => {
        setBankAccounts(data.accounts ?? []);
      })
      .catch(() => setBankAccounts([]));
  }, [receiptOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function onEntryCreated() {
    router.refresh();
  }

  if (actions.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close create menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
            onClick={closeMenu}
          />
        )}
      </AnimatePresence>

      <div
        className="create-fab-root pointer-events-none fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 sm:right-6"
        aria-live="polite"
      >
        <AnimatePresence>
          {open &&
            actions.map((action, index) => (
              <motion.button
                key={action.id}
                type="button"
                custom={index}
                variants={menuVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                whileTap={{ scale: 0.97 }}
                onClick={action.onSelect}
                className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-[#1c1c1e]/92 py-2 pr-4 pl-2 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl"
              >
                {action.icon}
                <span className="text-sm font-medium text-white">
                  {action.label}
                </span>
              </motion.button>
            ))}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label={open ? "Close create menu" : "Create"}
          aria-expanded={open}
          whileTap={{ scale: 0.94 }}
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          onClick={() => setOpen((value) => !value)}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#1c1c1e] text-white shadow-[0_8px_28px_rgba(0,0,0,0.32)]"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 4v14M4 11h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </motion.button>
      </div>

      {canAddReceipt && (
        <AddLedgerReceiptModal
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          bankAccounts={bankAccounts}
          onCreated={onEntryCreated}
        />
      )}
      {canAddPayment && (
        <AddExpenseModal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          onCreated={onEntryCreated}
        />
      )}
    </>
  );
}
