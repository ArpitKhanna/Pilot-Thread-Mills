import type {
  FinishedStockMovement,
  FinishedStockMovementType,
  ShadeBalance,
  VelocityTier,
} from "./types";
import { TIER_DEFAULTS } from "./types";
import { classifyVelocityTier } from "./velocity";

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function sortMovements(
  movements: FinishedStockMovement[],
): FinishedStockMovement[] {
  return [...movements].sort((a, b) => {
    const dateCmp = a.movementDate.localeCompare(b.movementDate);
    if (dateCmp !== 0) return dateCmp;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function movementDelta(
  movementType: FinishedStockMovementType,
  quantity: number,
): number {
  switch (movementType) {
    case "opening_balance":
    case "stock_in":
      return quantity;
    case "stock_out":
      return -quantity;
    case "adjustment":
      return quantity;
    default:
      return 0;
  }
}

export function deriveOnHandByShade(
  movements: FinishedStockMovement[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of sortMovements(movements)) {
    const current = map.get(m.shadeId) ?? 0;
    map.set(m.shadeId, roundQty(current + movementDelta(m.movementType, m.quantity)));
  }
  return map;
}

export function sumStockOutInWindow(
  movements: FinishedStockMovement[],
  shadeId: string,
  sinceDate: string,
): number {
  let total = 0;
  for (const m of movements) {
    if (
      m.shadeId === shadeId &&
      m.movementType === "stock_out" &&
      m.movementDate >= sinceDate
    ) {
      total += m.quantity;
    }
  }
  return roundQty(total);
}

function daysAgoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function resolveEffectiveThresholds(
  tier: VelocityTier,
  minStockThreshold: number | null,
  targetStockLevel: number | null,
): { minThreshold: number | null; targetLevel: number | null } {
  if (tier === "slow" || tier === "dead") {
    return { minThreshold: null, targetLevel: null };
  }
  const defaults = TIER_DEFAULTS[tier];
  return {
    minThreshold: minStockThreshold ?? defaults.minThreshold,
    targetLevel: targetStockLevel ?? defaults.targetLevel,
  };
}

export type BuildBalanceInput = {
  shadeId: string;
  shadeCode: string;
  cardColumn: number | null;
  cardRow: number | null;
  colorHex: string | null;
  minStockThreshold: number | null;
  targetStockLevel: number | null;
  onHand: number;
  movements: FinishedStockMovement[];
  velocityTier?: VelocityTier;
};

export function buildShadeBalance(input: BuildBalanceInput): ShadeBalance {
  const since7 = daysAgoDate(7);
  const since30 = daysAgoDate(30);
  const since90 = daysAgoDate(90);

  const velocity7d = sumStockOutInWindow(
    input.movements,
    input.shadeId,
    since7,
  );
  const velocity30d = sumStockOutInWindow(
    input.movements,
    input.shadeId,
    since30,
  );
  const velocity90d = sumStockOutInWindow(
    input.movements,
    input.shadeId,
    since90,
  );

  const velocityTier =
    input.velocityTier ??
    classifyVelocityTier(velocity30d, input.movements, input.shadeId);

  const { minThreshold, targetLevel } = resolveEffectiveThresholds(
    velocityTier,
    input.minStockThreshold,
    input.targetStockLevel,
  );

  const belowThreshold =
    minThreshold !== null && input.onHand <= minThreshold;
  const outOfStock = input.onHand <= 0;

  return {
    shadeId: input.shadeId,
    shadeCode: input.shadeCode,
    cardColumn: input.cardColumn,
    cardRow: input.cardRow,
    colorHex: input.colorHex,
    onHand: input.onHand,
    minStockThreshold: input.minStockThreshold,
    targetStockLevel: input.targetStockLevel,
    velocity7d,
    velocity30d,
    velocity90d,
    velocityTier,
    effectiveMinThreshold: minThreshold,
    effectiveTargetLevel: targetLevel,
    belowThreshold,
    outOfStock,
  };
}

export function buildAllShadeBalances(
  shades: Array<{
    id: string;
    shadeCode: string;
    cardColumn: number | null;
    cardRow: number | null;
    colorHex: string | null;
    minStockThreshold: number | null;
    targetStockLevel: number | null;
  }>,
  movements: FinishedStockMovement[],
): ShadeBalance[] {
  const onHandMap = deriveOnHandByShade(movements);

  const preliminary = shades.map((shade) => {
    const onHand = onHandMap.get(shade.id) ?? 0;
    const velocity30d = sumStockOutInWindow(
      movements,
      shade.id,
      daysAgoDate(30),
    );
    return { shade, onHand, velocity30d };
  });

  const velocities = preliminary
    .map((p) => p.velocity30d)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const fastCutoff =
    velocities.length > 0
      ? velocities[Math.floor(velocities.length * 0.75)] ?? 0
      : Infinity;

  return preliminary.map(({ shade, onHand, velocity30d }) => {
    let tier: VelocityTier = "dead";
    if (velocity30d > 0) {
      tier = velocity30d >= fastCutoff && fastCutoff > 0 ? "fast" : "normal";
    } else if (onHand > 0) {
      tier = "slow";
    }

    return buildShadeBalance({
      shadeId: shade.id,
      shadeCode: shade.shadeCode,
      cardColumn: shade.cardColumn,
      cardRow: shade.cardRow,
      colorHex: shade.colorHex,
      minStockThreshold: shade.minStockThreshold,
      targetStockLevel: shade.targetStockLevel,
      onHand,
      movements,
      velocityTier: tier,
    });
  });
}
