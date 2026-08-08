import type { CustomerOrderLineUnit } from "@/lib/customer-orders/types";

export type FinishedStockMovementType =
  | "opening_balance"
  | "stock_in"
  | "stock_out"
  | "adjustment";

export type VelocityTier = "fast" | "normal" | "slow" | "dead";

export type InventoryShade = {
  id: string;
  priceListItemId: string;
  shadeCode: string;
  colorLabel: string | null;
  colorHex: string | null;
  cardColumn: number | null;
  cardRow: number | null;
  minStockThreshold: number | null;
  targetStockLevel: number | null;
  isActive: boolean;
};

export type FinishedStockMovement = {
  id: string;
  movementType: FinishedStockMovementType;
  priceListItemId: string;
  shadeId: string;
  shadeCode: string;
  unit: CustomerOrderLineUnit;
  quantity: number;
  movementDate: string;
  orderId: string | null;
  orderLineId: string | null;
  dyeingJobId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  itemName?: string | null;
};

export type ShadeBalance = {
  shadeId: string;
  shadeCode: string;
  cardColumn: number | null;
  cardRow: number | null;
  colorHex: string | null;
  onHand: number;
  minStockThreshold: number | null;
  targetStockLevel: number | null;
  velocity7d: number;
  velocity30d: number;
  velocity90d: number;
  velocityTier: VelocityTier;
  effectiveMinThreshold: number | null;
  effectiveTargetLevel: number | null;
  belowThreshold: boolean;
  outOfStock: boolean;
};

export type DyeingSuggestion = {
  shadeId: string;
  shadeCode: string;
  onHand: number;
  minThreshold: number;
  targetLevel: number;
  suggestedQty: number;
  velocity30d: number;
  velocityTier: VelocityTier;
};

export type PackOrderLineInput = {
  lineId: string;
  fulfilledQty: number;
};

export const MOVEMENT_TYPE_LABELS: Record<FinishedStockMovementType, string> = {
  opening_balance: "Opening balance",
  stock_in: "Stock in",
  stock_out: "Stock out",
  adjustment: "Adjustment",
};

export const VELOCITY_TIER_LABELS: Record<VelocityTier, string> = {
  fast: "Fast",
  normal: "Normal",
  slow: "Slow",
  dead: "Dead",
};

export const TIER_DEFAULTS: Record<
  Exclude<VelocityTier, "slow" | "dead">,
  { minThreshold: number; targetLevel: number; autoQueue: boolean }
> = {
  fast: { minThreshold: 5, targetLevel: 10, autoQueue: true },
  normal: { minThreshold: 2, targetLevel: 5, autoQueue: false },
};

export const ELLFA_270_UNIT = "dibbi" as const;
