import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAllShadeBalances, resolveEffectiveThresholds } from "./balance";
import {
  getEllfa270ItemId,
  hasOpenDyeingForShade,
  hasOpenPendingForShade,
  listMovementsForItem,
  listShadesForItem,
} from "./queries";
import type { DyeingSuggestion, VelocityTier } from "./types";
import { TIER_DEFAULTS } from "./types";

export type ShadeReplenishmentInput = {
  shadeId: string;
  shadeCode: string;
  onHand: number;
  minStockThreshold: number | null;
  targetStockLevel: number | null;
  velocityTier?: VelocityTier;
};

export async function checkReplenishmentForShades(
  supabase: SupabaseClient,
  priceListItemId: string,
  shades: ShadeReplenishmentInput[],
  createdBy: string,
): Promise<number> {
  let created = 0;

  for (const shade of shades) {
    const tier = shade.velocityTier ?? "normal";
    if (tier === "slow" || tier === "dead") continue;

    const { minThreshold, targetLevel } = resolveEffectiveThresholds(
      tier,
      shade.minStockThreshold,
      shade.targetStockLevel,
    );
    if (minThreshold === null || targetLevel === null) continue;
    if (shade.onHand > minThreshold) continue;

    const hasOpen =
      (await hasOpenDyeingForShade(supabase, priceListItemId, shade.shadeId)) ||
      (await hasOpenPendingForShade(supabase, priceListItemId, shade.shadeId));
    if (hasOpen) continue;

    const qty = Math.max(targetLevel - shade.onHand, 1);
    const defaults = TIER_DEFAULTS[tier === "fast" ? "fast" : "normal"];

    if (defaults.autoQueue) {
      const { error } = await supabase.from("dyeing_jobs").insert({
        customer_id: null,
        pending_item_id: null,
        price_list_item_id: priceListItemId,
        shade_id: shade.shadeId,
        shade_code: shade.shadeCode,
        qty,
        unit: "dibbi",
        status: "queued",
        is_urgent: true,
        notes: `Auto-queued: below min threshold (${minThreshold} dibbis)`,
        created_by: createdBy,
      });
      if (error) throw error;
      created += 1;
    }
  }

  return created;
}

export async function checkReplenishmentForItem(
  supabase: SupabaseClient,
  priceListItemId: string,
  createdBy: string,
): Promise<number> {
  const [shades, movements] = await Promise.all([
    listShadesForItem(supabase, priceListItemId),
    listMovementsForItem(supabase, priceListItemId),
  ]);

  const balances = buildAllShadeBalances(
    shades.map((s) => ({
      id: s.id,
      shadeCode: s.shadeCode,
      cardColumn: s.cardColumn,
      cardRow: s.cardRow,
      colorHex: s.colorHex,
      minStockThreshold: s.minStockThreshold,
      targetStockLevel: s.targetStockLevel,
    })),
    movements,
  );

  const belowThreshold = balances.filter((b) => b.belowThreshold);
  return checkReplenishmentForShades(
    supabase,
    priceListItemId,
    belowThreshold.map((b) => ({
      shadeId: b.shadeId,
      shadeCode: b.shadeCode,
      onHand: b.onHand,
      minStockThreshold: b.minStockThreshold,
      targetStockLevel: b.targetStockLevel,
      velocityTier: b.velocityTier,
    })),
    createdBy,
  );
}

export async function listDyeingSuggestions(
  supabase: SupabaseClient,
  priceListItemId: string,
): Promise<DyeingSuggestion[]> {
  const [shades, movements] = await Promise.all([
    listShadesForItem(supabase, priceListItemId),
    listMovementsForItem(supabase, priceListItemId),
  ]);

  const balances = buildAllShadeBalances(
    shades.map((s) => ({
      id: s.id,
      shadeCode: s.shadeCode,
      cardColumn: s.cardColumn,
      cardRow: s.cardRow,
      colorHex: s.colorHex,
      minStockThreshold: s.minStockThreshold,
      targetStockLevel: s.targetStockLevel,
    })),
    movements,
  );

  const suggestions: DyeingSuggestion[] = [];

  for (const balance of balances) {
    if (balance.velocityTier !== "normal") continue;
    if (!balance.belowThreshold) continue;
    if (
      balance.effectiveMinThreshold === null ||
      balance.effectiveTargetLevel === null
    ) {
      continue;
    }

    const hasOpen =
      (await hasOpenDyeingForShade(
        supabase,
        priceListItemId,
        balance.shadeId,
      )) ||
      (await hasOpenPendingForShade(
        supabase,
        priceListItemId,
        balance.shadeId,
      ));
    if (hasOpen) continue;

    suggestions.push({
      shadeId: balance.shadeId,
      shadeCode: balance.shadeCode,
      onHand: balance.onHand,
      minThreshold: balance.effectiveMinThreshold,
      targetLevel: balance.effectiveTargetLevel,
      suggestedQty: Math.max(
        balance.effectiveTargetLevel - balance.onHand,
        1,
      ),
      velocity30d: balance.velocity30d,
      velocityTier: balance.velocityTier,
    });
  }

  return suggestions.sort((a, b) => a.onHand - b.onHand);
}

export async function approveDyeingSuggestions(
  supabase: SupabaseClient,
  priceListItemId: string,
  shadeIds: string[],
  createdBy: string,
): Promise<number> {
  const suggestions = await listDyeingSuggestions(supabase, priceListItemId);
  const toCreate = suggestions.filter((s) => shadeIds.includes(s.shadeId));
  let created = 0;

  for (const suggestion of toCreate) {
    const { error } = await supabase.from("dyeing_jobs").insert({
      customer_id: null,
      pending_item_id: null,
      price_list_item_id: priceListItemId,
      shade_id: suggestion.shadeId,
      shade_code: suggestion.shadeCode,
      qty: suggestion.suggestedQty,
      unit: "dibbi",
      status: "queued",
      is_urgent: false,
      notes: `Replenishment: below threshold (${suggestion.minThreshold} dibbis)`,
      created_by: createdBy,
    });
    if (error) throw error;
    created += 1;
  }

  return created;
}

export async function runEllfa270ReplenishmentCheck(
  supabase: SupabaseClient,
  createdBy: string,
): Promise<number> {
  const itemId = await getEllfa270ItemId(supabase);
  return checkReplenishmentForItem(supabase, itemId, createdBy);
}
