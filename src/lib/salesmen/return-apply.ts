import type { InvoiceLineItem, SalesmanReturn } from "./types";

/**
 * Prefill invoice return lines from open stand-alone returns.
 * Manual (non-linked) return lines are preserved; linked ones are rebuilt.
 * Staff may reduce amounts afterward; never force higher than what they set.
 */
export function buildAutoAppliedReturnItems(
  openReturns: SalesmanReturn[],
  existingReturns: InvoiceLineItem[] = [],
): InvoiceLineItem[] {
  const manual = existingReturns.filter((r) => !r.standAloneReturnId);
  const applied: InvoiceLineItem[] = [];

  for (const ret of openReturns) {
    const remaining = Math.round(ret.remainingAmount * 100) / 100;
    if (remaining <= 0) continue;

    if (
      Math.abs(remaining - ret.totalAmount) < 0.01 &&
      ret.lineItems.length > 0
    ) {
      for (const line of ret.lineItems) {
        applied.push({
          id: `ret-apply-${ret.id}-${line.id}`,
          name: line.name,
          qty: line.qty,
          unitPrice: line.unitPrice,
          amount: line.amount,
          priceListItemId: line.priceListItemId,
          standAloneReturnId: ret.id,
        });
      }
    } else {
      // Partially remaining: single credit line up to remaining
      const first = ret.lineItems[0];
      applied.push({
        id: `ret-apply-${ret.id}-credit`,
        name: first?.name
          ? `${first.name}${ret.lineItems.length > 1 ? " (+)" : ""}`
          : "Return credit",
        qty: 1,
        unitPrice: remaining,
        amount: remaining,
        priceListItemId: first?.priceListItemId,
        standAloneReturnId: ret.id,
      });
    }
  }

  return [...applied, ...manual];
}
