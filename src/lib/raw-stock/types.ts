export type RawStockMovementType =
  | "opening_balance"
  | "purchase"
  | "send_to_narela"
  | "mark_dyed"
  | "receive_from_narela";

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
  countLabel: string;
  quantityKg: number;
  movementDate: string;
  supplierId: string | null;
  supplierName: string | null;
  pricePerKg: number | null;
  shadeId: string | null;
  shadeCodeText: string | null;
  colorLabel: string | null;
  customerId: string | null;
  customerName: string | null;
  relatedMovementId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type CountBalance = {
  countLabel: string;
  ramaUndyedKg: number;
  narelaUndyedKg: number;
  narelaDyedKg: number;
};

export type DyedLot = {
  movementId: string;
  countLabel: string;
  originalKg: number;
  remainingKg: number;
  movementDate: string;
  shadeId: string | null;
  shadeCodeText: string | null;
  colorLabel: string | null;
  customerId: string | null;
  customerName: string | null;
};

export type RawStockBalances = {
  byCount: CountBalance[];
  totals: {
    ramaUndyedKg: number;
    narelaUndyedKg: number;
    narelaDyedKg: number;
  };
  dyedLots: DyedLot[];
};

export type RawStockTimeRangePreset = "month" | "6m" | "1y" | "max";

export type RawStockMonthlyPoint = {
  key: string;
  label: string;
  purchasedKg: number;
  sentKg: number;
  dyedKg: number;
  receivedKg: number;
  purchaseSpend: number;
};

export type RawStockAnalytics = {
  summary: {
    purchasedKg: number;
    sentKg: number;
    dyedKg: number;
    receivedKg: number;
    purchaseSpend: number;
  };
  monthlyTrend: RawStockMonthlyPoint[];
};

export type RawStockShadeOption = {
  id: string;
  shadeCode: string;
  colorLabel: string | null;
  countLabel: string | null;
  priceListItemId: string;
  itemName: string;
};

export type RawStockCustomerOption = {
  id: string;
  name: string;
};

export const MOVEMENT_TYPE_LABELS: Record<RawStockMovementType, string> = {
  opening_balance: "Opening balance",
  purchase: "Purchase",
  send_to_narela: "Sent to Narela",
  mark_dyed: "Marked dyed",
  receive_from_narela: "Received from Narela",
};
