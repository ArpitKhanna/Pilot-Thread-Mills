import type { CustomerOrder } from "@/lib/customer-orders/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import type {
  CustomerTier,
  CustomerTierRubric,
  Invoice,
  TierRubricScore,
} from "@/lib/salesmen/types";

const WINDOW_DAYS = 90;

export type CustomerTierFactorDetail = {
  score: TierRubricScore | null;
  summary: string;
};

export type CustomerTierInsight = {
  rubric: CustomerTierRubric;
  tier: CustomerTier | "";
  factors: {
    orderFrequency: CustomerTierFactorDetail;
    orderAmount: CustomerTierFactorDetail;
    paymentAmount: CustomerTierFactorDetail;
    paymentSpeed: CustomerTierFactorDetail;
  };
  hasData: boolean;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function scoreOrderFrequency(count90d: number): TierRubricScore {
  if (count90d <= 0) return 1;
  if (count90d === 1) return 2;
  if (count90d <= 3) return 3;
  if (count90d <= 5) return 4;
  return 5;
}

function scoreAverageAmount(avg: number): TierRubricScore {
  if (avg < 5_000) return 1;
  if (avg < 15_000) return 2;
  if (avg < 40_000) return 3;
  if (avg < 100_000) return 4;
  return 5;
}

function scorePaymentCoverage(ratio: number): TierRubricScore {
  if (ratio <= 0) return 1;
  if (ratio < 0.25) return 2;
  if (ratio < 0.5) return 3;
  if (ratio < 0.85) return 4;
  return 5;
}

function scorePaymentSpeed(avgDays: number): TierRubricScore {
  if (avgDays <= 3) return 5;
  if (avgDays <= 7) return 4;
  if (avgDays <= 14) return 3;
  if (avgDays <= 30) return 2;
  return 1;
}

/** Overall tier from average of available 1–5 scores. */
export function deriveCustomerTierFromScores(
  scores: Array<TierRubricScore | null>,
): CustomerTier | "" {
  const present = scores.filter((s): s is TierRubricScore => s != null);
  if (present.length === 0) return "";
  const avg = present.reduce((sum, s) => sum + s, 0) / present.length;
  if (avg >= 4) return "A";
  if (avg >= 3) return "B";
  if (avg >= 2) return "C";
  return "D";
}

/**
 * Auto-score customer tier from order + invoice history.
 * Window: last 90 days for frequency; amounts/speed use linked history.
 */
export function computeCustomerTierInsight(
  orders: CustomerOrder[],
  invoices: Invoice[],
  now: Date = new Date(),
): CustomerTierInsight {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const orders90d = activeOrders.filter((o) => {
    const d = new Date(o.orderDate);
    return Number.isFinite(d.getTime()) && d >= windowStart;
  });

  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

  // --- Order frequency ---
  const freqCount = orders90d.length;
  const orderFrequency: CustomerTierFactorDetail =
    activeOrders.length === 0
      ? { score: null, summary: "No orders yet" }
      : {
          score: scoreOrderFrequency(freqCount),
          summary: `${freqCount} order${freqCount === 1 ? "" : "s"} in last ${WINDOW_DAYS} days`,
        };

  // --- Order amount (avg of orders in window, else all-time) ---
  const amountPool = orders90d.length > 0 ? orders90d : activeOrders;
  const amounts = amountPool.map((o) => o.amount).filter((a) => a > 0);
  let orderAmount: CustomerTierFactorDetail;
  if (amounts.length === 0) {
    orderAmount = { score: null, summary: "No order amounts yet" };
  } else {
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    orderAmount = {
      score: scoreAverageAmount(avg),
      summary: `Avg order ${formatINR(avg)} (${amounts.length} order${amounts.length === 1 ? "" : "s"})`,
    };
  }

  // --- Payment amount (coverage of invoices) ---
  let paymentAmount: CustomerTierFactorDetail;
  if (invoices.length === 0) {
    paymentAmount = { score: null, summary: "No invoices yet" };
  } else {
    const totalBilled = invoices.reduce((s, inv) => s + inv.totalAmount, 0);
    const totalPaid = invoices.reduce((s, inv) => s + inv.amountPaid, 0);
    const ratio = totalBilled > 0 ? totalPaid / totalBilled : 0;
    paymentAmount = {
      score: scorePaymentCoverage(ratio),
      summary: `Paid ${formatINR(totalPaid)} of ${formatINR(totalBilled)} invoiced (${Math.round(ratio * 100)}%)`,
    };
  }

  // --- Payment speed (days from order date to paid / outstanding) ---
  const speedDays: number[] = [];
  for (const order of activeOrders) {
    const orderDate = new Date(order.orderDate);
    if (!Number.isFinite(orderDate.getTime())) continue;

    const invoice = order.invoiceId
      ? invoiceById.get(order.invoiceId)
      : undefined;

    if (invoice && invoice.totalAmount > 0) {
      const fullyPaid = invoice.amountPaid >= invoice.totalAmount * 0.99;
      if (fullyPaid) {
        // Payments are captured with the invoice today; use invoice date as pay date.
        speedDays.push(daysBetween(orderDate, new Date(invoice.issuedAt)));
      } else {
        speedDays.push(daysBetween(orderDate, now));
      }
    } else if (
      order.status === "confirmed" ||
      order.status === "picking" ||
      order.status === "draft"
    ) {
      // Open / not yet invoiced — treat as unpaid since order date
      speedDays.push(daysBetween(orderDate, now));
    }
  }

  let paymentSpeed: CustomerTierFactorDetail;
  if (speedDays.length === 0) {
    paymentSpeed = {
      score: null,
      summary: "Not enough payment timing data",
    };
  } else {
    const avgDays =
      speedDays.reduce((s, d) => s + d, 0) / speedDays.length;
    paymentSpeed = {
      score: scorePaymentSpeed(avgDays),
      summary: `Avg ${avgDays.toFixed(1)} days from order to payment / clearance`,
    };
  }

  const rubric: CustomerTierRubric = {
    orderFrequency: orderFrequency.score,
    orderAmount: orderAmount.score,
    paymentAmount: paymentAmount.score,
    paymentSpeed: paymentSpeed.score,
  };

  const tier = deriveCustomerTierFromScores([
    rubric.orderFrequency,
    rubric.orderAmount,
    rubric.paymentAmount,
    rubric.paymentSpeed,
  ]);

  const hasData =
    orderFrequency.score != null ||
    orderAmount.score != null ||
    paymentAmount.score != null ||
    paymentSpeed.score != null;

  return {
    rubric,
    tier,
    factors: {
      orderFrequency,
      orderAmount,
      paymentAmount,
      paymentSpeed,
    },
    hasData,
  };
}

/** @deprecated Prefer deriveCustomerTierFromScores — kept for stored rubric compat */
export function deriveCustomerTier(
  rubric: CustomerTierRubric,
): CustomerTier | "" {
  return deriveCustomerTierFromScores([
    rubric.orderFrequency,
    rubric.orderAmount,
    rubric.paymentAmount,
    rubric.paymentSpeed,
  ]);
}
