import type { FinishedStockMovement, VelocityTier } from "./types";

export function classifyVelocityTier(
  velocity30d: number,
  movements: FinishedStockMovement[],
  shadeId: string,
): VelocityTier {
  if (velocity30d <= 0) {
    const hasAnyOutflow = movements.some(
      (m) => m.shadeId === shadeId && m.movementType === "stock_out",
    );
    return hasAnyOutflow ? "slow" : "dead";
  }
  return "normal";
}

export function computeFastMoverCutoff(velocities30d: number[]): number {
  const positive = velocities30d.filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length === 0) return Infinity;
  const idx = Math.floor(positive.length * 0.75);
  return positive[Math.min(idx, positive.length - 1)] ?? Infinity;
}

export function assignVelocityTiers(
  items: Array<{ shadeId: string; velocity30d: number; onHand: number }>,
): Map<string, VelocityTier> {
  const cutoff = computeFastMoverCutoff(items.map((i) => i.velocity30d));
  const map = new Map<string, VelocityTier>();

  for (const item of items) {
    if (item.velocity30d > 0) {
      map.set(
        item.shadeId,
        item.velocity30d >= cutoff && cutoff > 0 ? "fast" : "normal",
      );
    } else if (item.onHand > 0) {
      map.set(item.shadeId, "slow");
    } else {
      map.set(item.shadeId, "dead");
    }
  }

  return map;
}
