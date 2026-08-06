"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { DailyLedgerSummary } from "@/lib/ledger/types";
import { useSyncedState } from "@/lib/realtime/use-synced-state";

export function useDailyLedger(initialLedger: DailyLedgerSummary) {
  const router = useRouter();
  const [ledger, setLedger] = useSyncedState(initialLedger);
  const [date, setDate] = useState(initialLedger.date);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (nextDate?: string) => {
      const d = nextDate ?? date;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/dashboard/ledger?date=${encodeURIComponent(d)}`,
        );
        const data = (await res.json()) as {
          ledger?: DailyLedgerSummary;
          error?: string;
        };
        if (data.ledger) {
          setLedger(data.ledger);
        }
      } finally {
        setLoading(false);
      }
    },
    [date, setLedger],
  );

  async function handleDateChange(next: string) {
    setDate(next);
    await refresh(next);
  }

  function onEntryCreated() {
    void refresh();
    router.refresh();
  }

  return {
    ledger,
    date,
    loading,
    receiptOpen,
    setReceiptOpen,
    expenseOpen,
    setExpenseOpen,
    handleDateChange,
    onEntryCreated,
  };
}
