"use client";

import type { OrderStats } from "@/lib/ledger/types";
import { useSyncedState } from "@/lib/realtime/use-synced-state";
import { WidgetKpi, WidgetSection } from "./WidgetKpi";

type OrderStatusWidgetProps = {
  initialStats: OrderStats;
};

export function OrderStatusWidget({ initialStats }: OrderStatusWidgetProps) {
  const [stats] = useSyncedState(initialStats);

  return (
    <WidgetSection
      title="Orders today"
      description={`Status for ${stats.date}`}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WidgetKpi
          label="Received today"
          value={stats.receivedToday}
          format="count"
          href="/orders/customers"
        />
        <WidgetKpi
          label="Delivered today"
          value={stats.deliveredToday}
          format="count"
          href="/orders/customers"
        />
        <WidgetKpi
          label="Carried over"
          value={stats.carriedOver}
          format="count"
          valueClass={stats.carriedOver > 0 ? "text-[#c45c26]" : undefined}
          href="/orders/customers"
        />
        <WidgetKpi
          label="Urgent"
          value={stats.urgentCount}
          format="count"
          valueClass={stats.urgentCount > 0 ? "text-red-700" : undefined}
          href="/orders/customers"
        />
      </div>

      {stats.oldestCarriedOver.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Oldest pending
          </p>
          <ul className="space-y-1.5">
            {stats.oldestCarriedOver.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <span className="truncate font-medium">{order.customerName}</span>
                <span className="shrink-0 text-xs text-muted capitalize">
                  {order.status.replace(/_/g, " ")} · {order.ageDays}d
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetSection>
  );
}
