"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const APPROVALS_COUNT_EVENT = "approvals-count-changed";
const REALTIME_TABLES = [
  "salesmen_invoices",
  "salesmen_advances",
  "salesmen_returns",
  "price_list_items",
] as const;

export function notifyApprovalsCountChanged() {
  window.dispatchEvent(new CustomEvent(APPROVALS_COUNT_EVENT));
}

export function useApprovalsCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const res = await fetch("/api/approvals/count");
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      setCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      // Keep last known count on transient failures.
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    function onCountEvent() {
      void refresh();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    window.addEventListener(APPROVALS_COUNT_EVENT, onCountEvent);
    document.addEventListener("visibilitychange", onVisibility);

    const supabase = createClient();
    let channel = supabase.channel("approvals-nav-count");
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refresh();
      }, 350);
    };

    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }

    void channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(APPROVALS_COUNT_EVENT, onCountEvent);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  return count;
}
