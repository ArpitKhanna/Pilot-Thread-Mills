import type { PriceListItem } from "@/lib/auth/types";
import type { CustomerPriceRule } from "@/lib/salesmen/types";

/**
 * Find the matching price rule for a line (by price-list id, else item name).
 */
export function matchCustomerPriceRule(
  rules: CustomerPriceRule[] | null | undefined,
  opts: {
    priceListItemId?: string | null;
    itemName?: string | null;
    priceList?: Array<{ id: string; item_name: string }>;
  },
): CustomerPriceRule | null {
  if (!rules || rules.length === 0) return null;

  const { priceListItemId, itemName, priceList = [] } = opts;

  if (priceListItemId) {
    const byId = rules.find(
      (rule) =>
        rule.priceListItemId && rule.priceListItemId === priceListItemId,
    );
    if (byId) return byId;
  }

  const catalog = priceListItemId
    ? priceList.find((p) => p.id === priceListItemId)
    : undefined;
  const lineName = (itemName ?? catalog?.item_name ?? "").trim().toLowerCase();
  if (!lineName) return null;

  for (const rule of rules) {
    const needle = rule.itemName.trim().toLowerCase();
    if (!needle) continue;
    if (lineName.includes(needle) || needle.includes(lineName)) {
      return rule;
    }
  }

  return null;
}

/** List customer price ± matching rule adjustment (floored at 0). */
export function resolveCustomerUnitPrice(
  listPrice: number,
  rules: CustomerPriceRule[] | null | undefined,
  opts: {
    priceListItemId?: string | null;
    itemName?: string | null;
    priceList?: Array<{ id: string; item_name: string }>;
  },
): number {
  const base = Number(listPrice);
  if (!Number.isFinite(base) || base < 0) return 0;

  const rule = matchCustomerPriceRule(rules, opts);
  const adjusted = rule ? base + rule.adjustmentPerUnit : base;
  return Math.max(0, Math.round(adjusted * 100) / 100);
}

export function estimateCustomerLinesTotal(
  lines: Array<{
    priceListItemId: string | null;
    itemName?: string;
    qty: number;
  }>,
  priceList: PriceListItem[],
  rules: CustomerPriceRule[] | null | undefined,
): number {
  return Math.round(
    lines.reduce((sum, line) => {
      if (!(line.qty > 0) || !line.priceListItemId) return sum;
      const item = priceList.find((p) => p.id === line.priceListItemId);
      if (!item) return sum;
      const unit = resolveCustomerUnitPrice(item.customer_price, rules, {
        priceListItemId: line.priceListItemId,
        itemName: line.itemName ?? item.item_name,
        priceList,
      });
      return sum + unit * line.qty;
    }, 0) * 100,
  ) / 100;
}
