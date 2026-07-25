"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_REALTIME_TABLES } from "./tables";

const DEBOUNCE_MS = 350;

/**
 * Subscribes to Postgres changes on core tables and refreshes the current
 * route's server components so open sessions stay in sync.
 */
export function useRealtimeRefresh(
  tables: readonly string[] = APP_REALTIME_TABLES,
) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(`app-sync:${tablesKey}`);

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        router.refresh();
      }, DEBOUNCE_MS);
    };

    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }

    void channel.subscribe();

    function onVisibility() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [router, tables, tablesKey]);
}
