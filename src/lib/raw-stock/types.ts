export type RawStockCategory = "hank" | "cone";

export type RawStockMovementType =
  | "opening_balance"
  | "stock_in"
  | "stock_out";

export const HANK_COUNTS = ["3/58", "3/64", "2/20"] as const;

export const CONE_COUNTS = [
  "2/50",
  "2/60",
  "3/60",
  "3/57",
  "3/20",
  "2/20",
  "2/42",
  "3/42",
  "2/30",
  "300/3",
] as const;

export const COUNTS_BY_CATEGORY: Record<
  RawStockCategory,
  readonly string[]
> = {
  hank: HANK_COUNTS,
  cone: CONE_COUNTS,
};

export const CATEGORY_LABELS: Record<RawStockCategory, string> = {
  hank: "Hank",
  cone: "Cone",
};

export type RawStockSupplier = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RawStockMovement = {
  id: string;
  movementType: RawStockMovementType;
  category: RawStockCategory;
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId: string | null;
  supplierName: string | null;
  doNumber: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type CountBalance = {
  category: RawStockCategory;
  countLabel: string;
  narelaKg: number;
};

export type RawStockBalances = {
  byCount: CountBalance[];
  byCategory: {
    hank: CountBalance[];
    cone: CountBalance[];
  };
  totals: {
    hankKg: number;
    coneKg: number;
    narelaKg: number;
  };
};

export type MonthReportRow = {
  category: RawStockCategory;
  countLabel: string;
  openingKg: number;
  stockInKg: number;
  stockOutKg: number;
  closingKg: number;
};

export type MonthReport = {
  monthKey: string;
  label: string;
  rows: MonthReportRow[];
  byCategory: {
    hank: MonthReportRow[];
    cone: MonthReportRow[];
  };
  totals: {
    hank: Omit<MonthReportRow, "category" | "countLabel">;
    cone: Omit<MonthReportRow, "category" | "countLabel">;
    overall: Omit<MonthReportRow, "category" | "countLabel">;
  };
};

export const MOVEMENT_TYPE_LABELS: Record<RawStockMovementType, string> = {
  opening_balance: "Opening balance",
  stock_in: "Stock in",
  stock_out: "Sent to Rama Road",
};

export function isRawStockCategory(value: string): value is RawStockCategory {
  return value === "hank" || value === "cone";
}

export function isValidCountForCategory(
  category: RawStockCategory,
  countLabel: string,
): boolean {
  return COUNTS_BY_CATEGORY[category].includes(countLabel);
}

export function balanceKey(
  category: RawStockCategory,
  countLabel: string,
): string {
  return `${category}::${countLabel}`;
}
