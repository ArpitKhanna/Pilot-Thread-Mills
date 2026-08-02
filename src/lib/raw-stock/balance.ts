import type {
  CountBalance,
  MonthReport,
  MonthReportRow,
  RawStockBalances,
  RawStockCategory,
  RawStockMovement,
  RawStockMovementType,
} from "./types";
import { CONE_COUNTS, HANK_COUNTS, balanceKey } from "./types";

function roundKg(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function emptyRowsForCategory(category: RawStockCategory): CountBalance[] {
  const counts = category === "hank" ? HANK_COUNTS : CONE_COUNTS;
  return counts.map((countLabel) => ({
    category,
    countLabel,
    narelaKg: 0,
  }));
}

function sortMovements(movements: RawStockMovement[]): RawStockMovement[] {
  return [...movements].sort((a, b) => {
    const dateCmp = a.movementDate.localeCompare(b.movementDate);
    if (dateCmp !== 0) return dateCmp;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function deriveBalances(
  movements: RawStockMovement[],
): RawStockBalances {
  const map = new Map<string, CountBalance>();

  for (const row of [
    ...emptyRowsForCategory("hank"),
    ...emptyRowsForCategory("cone"),
  ]) {
    map.set(balanceKey(row.category, row.countLabel), { ...row });
  }

  for (const m of sortMovements(movements)) {
    const key = balanceKey(m.category, m.countLabel);
    let row = map.get(key);
    if (!row) {
      row = {
        category: m.category,
        countLabel: m.countLabel,
        narelaKg: 0,
      };
      map.set(key, row);
    }

    const kg = m.quantityKg;
    switch (m.movementType) {
      case "opening_balance":
      case "stock_in":
        row.narelaKg = roundKg(row.narelaKg + kg);
        break;
      case "stock_out":
        row.narelaKg = roundKg(row.narelaKg - kg);
        break;
    }
  }

  const hank = HANK_COUNTS.map(
    (countLabel) =>
      map.get(balanceKey("hank", countLabel)) ?? {
        category: "hank" as const,
        countLabel,
        narelaKg: 0,
      },
  );
  const cone = CONE_COUNTS.map(
    (countLabel) =>
      map.get(balanceKey("cone", countLabel)) ?? {
        category: "cone" as const,
        countLabel,
        narelaKg: 0,
      },
  );

  const byCount = [...hank, ...cone];
  const hankKg = roundKg(hank.reduce((sum, r) => sum + r.narelaKg, 0));
  const coneKg = roundKg(cone.reduce((sum, r) => sum + r.narelaKg, 0));

  return {
    byCount,
    byCategory: { hank, cone },
    totals: {
      hankKg,
      coneKg,
      narelaKg: roundKg(hankKg + coneKg),
    },
  };
}

export function getCountBalance(
  balances: RawStockBalances,
  category: RawStockCategory,
  countLabel: string,
): CountBalance {
  return (
    balances.byCount.find(
      (r) => r.category === category && r.countLabel === countLabel,
    ) ?? {
      category,
      countLabel,
      narelaKg: 0,
    }
  );
}

function monthKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function emptyMonthRow(
  category: RawStockCategory,
  countLabel: string,
): MonthReportRow {
  return {
    category,
    countLabel,
    openingKg: 0,
    stockInKg: 0,
    stockOutKg: 0,
    closingKg: 0,
  };
}

function sumRows(
  rows: MonthReportRow[],
): Omit<MonthReportRow, "category" | "countLabel"> {
  return {
    openingKg: roundKg(rows.reduce((s, r) => s + r.openingKg, 0)),
    stockInKg: roundKg(rows.reduce((s, r) => s + r.stockInKg, 0)),
    stockOutKg: roundKg(rows.reduce((s, r) => s + r.stockOutKg, 0)),
    closingKg: roundKg(rows.reduce((s, r) => s + r.closingKg, 0)),
  };
}

/** Build opening / in / out / closing for a calendar month (YYYY-MM). */
export function buildMonthReport(
  movements: RawStockMovement[],
  monthKey: string,
): MonthReport {
  const map = new Map<string, MonthReportRow>();

  for (const countLabel of HANK_COUNTS) {
    map.set(balanceKey("hank", countLabel), emptyMonthRow("hank", countLabel));
  }
  for (const countLabel of CONE_COUNTS) {
    map.set(balanceKey("cone", countLabel), emptyMonthRow("cone", countLabel));
  }

  for (const m of sortMovements(movements)) {
    const key = balanceKey(m.category, m.countLabel);
    let row = map.get(key);
    if (!row) {
      row = emptyMonthRow(m.category, m.countLabel);
      map.set(key, row);
    }

    const mKey = monthKeyFromDate(m.movementDate);
    const kg = m.quantityKg;

    if (mKey < monthKey) {
      // Prior movements contribute to opening
      if (m.movementType === "opening_balance" || m.movementType === "stock_in") {
        row.openingKg = roundKg(row.openingKg + kg);
      } else if (m.movementType === "stock_out") {
        row.openingKg = roundKg(row.openingKg - kg);
      }
    } else if (mKey === monthKey) {
      if (m.movementType === "opening_balance" || m.movementType === "stock_in") {
        // Opening dated inside the month still adds to stock for the period.
        // Treat as stock_in for in-month totals so closing stays correct.
        if (m.movementType === "opening_balance") {
          row.openingKg = roundKg(row.openingKg + kg);
        } else {
          row.stockInKg = roundKg(row.stockInKg + kg);
        }
      } else if (m.movementType === "stock_out") {
        row.stockOutKg = roundKg(row.stockOutKg + kg);
      }
    }
  }

  for (const row of map.values()) {
    row.closingKg = roundKg(row.openingKg + row.stockInKg - row.stockOutKg);
  }

  const hank = HANK_COUNTS.map(
    (countLabel) =>
      map.get(balanceKey("hank", countLabel)) ??
      emptyMonthRow("hank", countLabel),
  );
  const cone = CONE_COUNTS.map(
    (countLabel) =>
      map.get(balanceKey("cone", countLabel)) ??
      emptyMonthRow("cone", countLabel),
  );
  const rows = [...hank, ...cone];
  const hankTotals = sumRows(hank);
  const coneTotals = sumRows(cone);

  return {
    monthKey,
    label: monthLabel(monthKey),
    rows,
    byCategory: { hank, cone },
    totals: {
      hank: hankTotals,
      cone: coneTotals,
      overall: {
        openingKg: roundKg(hankTotals.openingKg + coneTotals.openingKg),
        stockInKg: roundKg(hankTotals.stockInKg + coneTotals.stockInKg),
        stockOutKg: roundKg(hankTotals.stockOutKg + coneTotals.stockOutKg),
        closingKg: roundKg(hankTotals.closingKg + coneTotals.closingKg),
      },
    },
  };
}

export function listAvailableMonthKeys(
  movements: RawStockMovement[],
  now = new Date(),
): string[] {
  const keys = new Set<string>();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  keys.add(current);

  for (const m of movements) {
    keys.add(monthKeyFromDate(m.movementDate));
  }

  // Also include months from earliest movement through current
  if (movements.length > 0) {
    const earliest = sortMovements(movements)[0]!.movementDate;
    const [ey, em] = earliest.split("-").map(Number);
    const cursor = new Date(ey!, (em ?? 1) - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= end) {
      keys.add(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return [...keys].sort((a, b) => b.localeCompare(a));
}

export function formatKg(n: number): string {
  return `${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} kg`;
}

export function isValidMovementType(
  value: string,
): value is RawStockMovementType {
  return (
    value === "opening_balance" ||
    value === "stock_in" ||
    value === "stock_out"
  );
}
