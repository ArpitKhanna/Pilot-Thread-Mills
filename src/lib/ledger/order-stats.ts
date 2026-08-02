import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerOrderStatus } from "@/lib/customer-orders/types";
import { calendarDaysBetween, dayBounds } from "./date-utils";
import type { OrderStats } from "./types";

const ACTIVE_STATUSES: CustomerOrderStatus[] = [
  "picking",
  "packed",
  "invoiced",
  "out_for_delivery",
];

export async function fetchOrderStats(
  supabase: SupabaseClient,
  dateInput: string,
): Promise<OrderStats> {
  const { start, end, date } = dayBounds(dateInput);
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);

  const [ordersRes, deliveredEventsRes] = await Promise.all([
    supabase
      .from("customer_orders")
      .select("id, status, order_date, created_at, is_urgent, customer_id, salesmen:customer_id ( name )")
      .neq("status", "cancelled"),
    supabase
      .from("customer_order_events")
      .select("order_id")
      .eq("to_status", "delivered")
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (deliveredEventsRes.error) throw deliveredEventsRes.error;

  const deliveredTodayIds = new Set(
    (deliveredEventsRes.data ?? []).map((e) => e.order_id as string),
  );

  let receivedToday = 0;
  let carriedOver = 0;
  let urgentCount = 0;
  const carriedOverList: OrderStats["oldestCarriedOver"] = [];

  for (const row of ordersRes.data ?? []) {
    const orderDateRaw = (row.order_date as string | null) ?? (row.created_at as string);
    const orderDay = orderDateRaw.slice(0, 10);
    const status = row.status as CustomerOrderStatus;
    const isUrgent = Boolean(row.is_urgent);
    const customerName =
      (row.salesmen as { name?: string } | null)?.name ?? "Unknown";

    if (orderDay === date) {
      receivedToday += 1;
      if (isUrgent && ACTIVE_STATUSES.includes(status)) {
        urgentCount += 1;
      }
    }

    if (orderDay < date && ACTIVE_STATUSES.includes(status)) {
      carriedOver += 1;
      if (isUrgent) urgentCount += 1;
      carriedOverList.push({
        id: row.id as string,
        customerName,
        status,
        ageDays: calendarDaysBetween(orderDateRaw),
      });
    }
  }

  carriedOverList.sort((a, b) => b.ageDays - a.ageDays);

  return {
    date,
    receivedToday,
    deliveredToday: deliveredTodayIds.size,
    carriedOver,
    urgentCount,
    oldestCarriedOver: carriedOverList.slice(0, 5),
  };
}
