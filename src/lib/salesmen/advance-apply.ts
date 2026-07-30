import type { InvoicePaymentEntry, SalesmanAdvance } from "./types";

/**
 * Prefill payment rows from open advances up to owed (prev + invoice).
 * Existing non-advance rows are preserved; advance rows are rebuilt.
 */
export function buildAutoAppliedAdvancePayments(
  openAdvances: SalesmanAdvance[],
  previousBalance: number,
  invoiceTotal: number,
  existingPayments: InvoicePaymentEntry[] = [],
): InvoicePaymentEntry[] {
  const nonAdvance = existingPayments.filter((p) => !p.advanceId);
  const owed = Math.max(
    0,
    Math.round((previousBalance + invoiceTotal) * 100) / 100,
  );
  const alreadyCash = nonAdvance.reduce((s, p) => s + (p.amount || 0), 0);
  let budget = Math.max(0, Math.round((owed - alreadyCash) * 100) / 100);

  const applied: InvoicePaymentEntry[] = [];
  for (const advance of openAdvances) {
    if (budget <= 0) break;
    const remaining = Math.round(advance.remainingAmount * 100) / 100;
    if (remaining <= 0) continue;
    const amount = Math.min(remaining, budget);
    if (amount <= 0) continue;
    applied.push({
      id: `adv-apply-${advance.id}`,
      method: advance.method,
      amount,
      chequeNumber: advance.chequeNumber,
      depositAccountId: advance.depositAccountId,
      senderName: advance.senderName,
      advanceId: advance.id,
      status: "active",
    });
    budget = Math.round((budget - amount) * 100) / 100;
  }
  return [...applied, ...nonAdvance];
}
