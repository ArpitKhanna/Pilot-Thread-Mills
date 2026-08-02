import type { Salesman } from "@/lib/salesmen/types";

/** True when pending balance has reached or exceeded the profile threshold. */
export function isCustomerDefaulter(
  pendingBalance: number,
  balanceThreshold: number | null,
): boolean {
  return (
    balanceThreshold != null &&
    balanceThreshold > 0 &&
    pendingBalance >= balanceThreshold
  );
}

/** Update pending balance and recompute defaulter status. */
export function withPendingBalance(
  customer: Salesman,
  pendingBalance: number,
): Salesman {
  const normalized = Math.max(0, Math.round(pendingBalance * 100) / 100);
  return {
    ...customer,
    pendingBalance: normalized,
    isDefaulter: isCustomerDefaulter(normalized, customer.balanceThreshold),
  };
}
