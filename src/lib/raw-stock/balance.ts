import type {
  CountBalance,
  DyedLot,
  RawStockAnalytics,
  RawStockBalances,
  RawStockMonthlyPoint,
  RawStockMovement,
  RawStockMovementType,
  RawStockTimeRangePreset,
} from "./types";

function roundKg(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function deriveBalances(
  movements: RawStockMovement[],
): RawStockBalances {
  const map = new Map<string, CountBalance>();

  function ensure(countLabel: string): CountBalance {
    let row = map.get(countLabel);
    if (!row) {
      row = {
        countLabel,
        ramaUndyedKg: 0,
        narelaUndyedKg: 0,
        narelaDyedKg: 0,
      };
      map.set(countLabel, row);
    }
    return row;
  }

  const sorted = [...movements].sort((a, b) => {
    const dateCmp = a.movementDate.localeCompare(b.movementDate);
    if (dateCmp !== 0) return dateCmp;
    return a.createdAt.localeCompare(b.createdAt);
  });

  for (const m of sorted) {
    const row = ensure(m.countLabel);
    const kg = m.quantityKg;
    switch (m.movementType) {
      case "opening_balance":
        row.narelaUndyedKg = roundKg(row.narelaUndyedKg + kg);
        break;
      case "purchase":
        row.ramaUndyedKg = roundKg(row.ramaUndyedKg + kg);
        break;
      case "send_to_narela":
        row.ramaUndyedKg = roundKg(row.ramaUndyedKg - kg);
        row.narelaUndyedKg = roundKg(row.narelaUndyedKg + kg);
        break;
      case "mark_dyed":
        row.narelaUndyedKg = roundKg(row.narelaUndyedKg - kg);
        row.narelaDyedKg = roundKg(row.narelaDyedKg + kg);
        break;
      case "receive_from_narela":
        row.narelaDyedKg = roundKg(row.narelaDyedKg - kg);
        break;
    }
  }

  const byCount = [...map.values()]
    .filter(
      (r) =>
        r.ramaUndyedKg > 0.0005 ||
        r.narelaUndyedKg > 0.0005 ||
        r.narelaDyedKg > 0.0005,
    )
    .sort((a, b) => a.countLabel.localeCompare(b.countLabel));

  const totals = byCount.reduce(
    (acc, r) => ({
      ramaUndyedKg: roundKg(acc.ramaUndyedKg + r.ramaUndyedKg),
      narelaUndyedKg: roundKg(acc.narelaUndyedKg + r.narelaUndyedKg),
      narelaDyedKg: roundKg(acc.narelaDyedKg + r.narelaDyedKg),
    }),
    { ramaUndyedKg: 0, narelaUndyedKg: 0, narelaDyedKg: 0 },
  );

  return {
    byCount,
    totals,
    dyedLots: deriveDyedLots(movements),
  };
}

export function deriveDyedLots(movements: RawStockMovement[]): DyedLot[] {
  const dyed = movements.filter((m) => m.movementType === "mark_dyed");
  const receives = movements.filter(
    (m) => m.movementType === "receive_from_narela",
  );

  const receivedByRelated = new Map<string, number>();
  for (const r of receives) {
    if (!r.relatedMovementId) continue;
    receivedByRelated.set(
      r.relatedMovementId,
      roundKg((receivedByRelated.get(r.relatedMovementId) ?? 0) + r.quantityKg),
    );
  }

  return dyed
    .map((m) => {
      const received = receivedByRelated.get(m.id) ?? 0;
      const remainingKg = roundKg(m.quantityKg - received);
      return {
        movementId: m.id,
        countLabel: m.countLabel,
        originalKg: m.quantityKg,
        remainingKg,
        movementDate: m.movementDate,
        shadeId: m.shadeId,
        shadeCodeText: m.shadeCodeText,
        colorLabel: m.colorLabel,
        customerId: m.customerId,
        customerName: m.customerName,
      };
    })
    .filter((lot) => lot.remainingKg > 0.0005)
    .sort((a, b) => {
      const dateCmp = b.movementDate.localeCompare(a.movementDate);
      if (dateCmp !== 0) return dateCmp;
      return a.countLabel.localeCompare(b.countLabel);
    });
}

export function getCountBalance(
  balances: RawStockBalances,
  countLabel: string,
): CountBalance {
  return (
    balances.byCount.find((r) => r.countLabel === countLabel) ?? {
      countLabel,
      ramaUndyedKg: 0,
      narelaUndyedKg: 0,
      narelaDyedKg: 0,
    }
  );
}

type DateRange = { from: Date; to: Date };

function resolveDateRange(
  preset: RawStockTimeRangePreset,
  now = new Date(),
): DateRange | null {
  if (preset === "max") return null;
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (preset === "month") {
    from.setDate(1);
  } else if (preset === "6m") {
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);
  } else if (preset === "1y") {
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
  }
  return { from, to };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function enumerateMonths(
  movements: RawStockMovement[],
  range: DateRange | null,
  now = new Date(),
): string[] {
  let start: Date;
  let end: Date;

  if (range) {
    start = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
    end = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
  } else if (movements.length > 0) {
    const times = movements.map((m) => new Date(m.movementDate).getTime());
    const earliest = new Date(Math.min(...times));
    start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = start;
  }

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function movementMonthKey(m: RawStockMovement): string {
  const d = new Date(m.movementDate);
  return monthKey(d);
}

export function buildRawStockAnalytics(
  movements: RawStockMovement[],
  preset: RawStockTimeRangePreset,
): RawStockAnalytics {
  const range = resolveDateRange(preset);
  const filtered = range
    ? movements.filter((m) => {
        const t = new Date(m.movementDate).getTime();
        return t >= range.from.getTime() && t <= range.to.getTime();
      })
    : movements;

  const summary = {
    purchasedKg: 0,
    sentKg: 0,
    dyedKg: 0,
    receivedKg: 0,
    purchaseSpend: 0,
  };

  for (const m of filtered) {
    switch (m.movementType) {
      case "purchase":
        summary.purchasedKg = roundKg(summary.purchasedKg + m.quantityKg);
        if (m.pricePerKg != null) {
          summary.purchaseSpend += m.quantityKg * m.pricePerKg;
        }
        break;
      case "send_to_narela":
        summary.sentKg = roundKg(summary.sentKg + m.quantityKg);
        break;
      case "mark_dyed":
        summary.dyedKg = roundKg(summary.dyedKg + m.quantityKg);
        break;
      case "receive_from_narela":
        summary.receivedKg = roundKg(summary.receivedKg + m.quantityKg);
        break;
    }
  }
  summary.purchaseSpend = Math.round(summary.purchaseSpend * 100) / 100;

  const months = enumerateMonths(filtered, range);
  const byMonth = new Map<string, RawStockMonthlyPoint>();
  for (const key of months) {
    byMonth.set(key, {
      key,
      label: monthLabel(key),
      purchasedKg: 0,
      sentKg: 0,
      dyedKg: 0,
      receivedKg: 0,
      purchaseSpend: 0,
    });
  }

  for (const m of filtered) {
    const key = movementMonthKey(m);
    let point = byMonth.get(key);
    if (!point) {
      point = {
        key,
        label: monthLabel(key),
        purchasedKg: 0,
        sentKg: 0,
        dyedKg: 0,
        receivedKg: 0,
        purchaseSpend: 0,
      };
      byMonth.set(key, point);
    }
    switch (m.movementType) {
      case "purchase":
        point.purchasedKg = roundKg(point.purchasedKg + m.quantityKg);
        if (m.pricePerKg != null) {
          point.purchaseSpend += m.quantityKg * m.pricePerKg;
        }
        break;
      case "send_to_narela":
        point.sentKg = roundKg(point.sentKg + m.quantityKg);
        break;
      case "mark_dyed":
        point.dyedKg = roundKg(point.dyedKg + m.quantityKg);
        break;
      case "receive_from_narela":
        point.receivedKg = roundKg(point.receivedKg + m.quantityKg);
        break;
    }
  }

  const monthlyTrend = [...byMonth.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((p) => ({
      ...p,
      purchaseSpend: Math.round(p.purchaseSpend * 100) / 100,
    }));

  return { summary, monthlyTrend };
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
    value === "purchase" ||
    value === "send_to_narela" ||
    value === "mark_dyed" ||
    value === "receive_from_narela"
  );
}
