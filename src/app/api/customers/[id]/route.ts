import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import { getSalesman } from "@/lib/salesmen/queries";
import {
  CUSTOMER_TIERS,
  deriveCustomerTier,
  MARKET_DAYS,
  type CustomerPriceRule,
  type CustomerTierRubric,
  type TierRubricScore,
} from "@/lib/salesmen/types";

type RouteContext = { params: Promise<{ id: string }> };

async function hasEntityCustomersAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .eq("module_id", "entity-customers")
    .maybeSingle();
  return Boolean(data);
}

function parseRubricScore(value: unknown): TierRubricScore | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return { error: "Tier rubric scores must be integers from 1 to 5" };
  }
  return n as TierRubricScore;
}

function parseTierRubric(
  raw: unknown,
): CustomerTierRubric | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Tier rubric must be an object" };
  }
  const row = raw as Record<string, unknown>;
  const orderFrequency = parseRubricScore(row.orderFrequency);
  if (orderFrequency && typeof orderFrequency === "object" && "error" in orderFrequency) {
    return orderFrequency;
  }
  const orderAmount = parseRubricScore(row.orderAmount);
  if (orderAmount && typeof orderAmount === "object" && "error" in orderAmount) {
    return orderAmount;
  }
  const paymentAmount = parseRubricScore(row.paymentAmount);
  if (paymentAmount && typeof paymentAmount === "object" && "error" in paymentAmount) {
    return paymentAmount;
  }
  const paymentSpeed = parseRubricScore(row.paymentSpeed);
  if (paymentSpeed && typeof paymentSpeed === "object" && "error" in paymentSpeed) {
    return paymentSpeed;
  }
  return {
    orderFrequency: orderFrequency as TierRubricScore | null,
    orderAmount: orderAmount as TierRubricScore | null,
    paymentAmount: paymentAmount as TierRubricScore | null,
    paymentSpeed: paymentSpeed as TierRubricScore | null,
  };
}

function parsePriceRules(
  raw: unknown,
): CustomerPriceRule[] | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "Price rules must be an array" };
  }
  const rules: CustomerPriceRule[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return { error: "Invalid price rule" };
    }
    const row = entry as Record<string, unknown>;
    const itemName = String(row.itemName ?? "").trim();
    const adjustmentPerUnit = Number(row.adjustmentPerUnit);
    if (!itemName) {
      return { error: "Each price rule needs an item name" };
    }
    if (!Number.isFinite(adjustmentPerUnit) || adjustmentPerUnit === 0) {
      return {
        error: "Each price rule needs a non-zero adjustment amount",
      };
    }
    const rounded = Math.round(adjustmentPerUnit * 100) / 100;
    const abs = Math.abs(rounded);
    rules.push({
      id: String(row.id ?? crypto.randomUUID()),
      itemName,
      priceListItemId: row.priceListItemId
        ? String(row.priceListItemId)
        : undefined,
      adjustmentPerUnit: rounded,
      description:
        String(row.description ?? "").trim() ||
        (rounded > 0
          ? `₹${abs} upcharge per ${itemName}`
          : `₹${abs} discount per ${itemName}`),
    });
  }
  return rules;
}

function parseOptionalCoord(
  value: unknown,
  label: string,
): number | null | { error: string } {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return { error: `${label} must be a valid number` };
  }
  return n;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntityCustomersAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSalesman(supabase, id);
  if (!existing || existing.entityType !== "customer") {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? existing.name).trim();
  if (!name) {
    return NextResponse.json(
      { error: "Shop name is required" },
      { status: 400 },
    );
  }

  const phone = String(body.phone ?? existing.phone).trim();
  if (!phone) {
    return NextResponse.json(
      { error: "Phone number is required" },
      { status: 400 },
    );
  }

  const alternatePhone =
    body.alternatePhone !== undefined
      ? String(body.alternatePhone ?? "").trim()
      : existing.alternatePhone;

  const contactName =
    body.contactName !== undefined
      ? String(body.contactName ?? "").trim()
      : existing.contactName;

  const addressBuilding =
    body.addressBuilding !== undefined
      ? String(body.addressBuilding ?? "").trim()
      : existing.addressBuilding;

  const addressArea =
    body.addressArea !== undefined
      ? String(body.addressArea ?? "").trim()
      : body.area !== undefined
        ? String(body.area ?? "").trim()
        : existing.addressArea || existing.area;

  const addressCity =
    body.addressCity !== undefined
      ? String(body.addressCity ?? "").trim()
      : existing.addressCity;

  const addressState =
    body.addressState !== undefined
      ? String(body.addressState ?? "").trim()
      : existing.addressState;

  const addressPincode =
    body.addressPincode !== undefined
      ? String(body.addressPincode ?? "").trim()
      : existing.addressPincode;

  let marketDay = existing.marketDay;
  if (body.marketDay !== undefined) {
    const marketDayRaw = String(body.marketDay ?? "").trim().toLowerCase();
    if (
      marketDayRaw &&
      !(MARKET_DAYS as readonly string[]).includes(marketDayRaw)
    ) {
      return NextResponse.json(
        { error: "Invalid market day" },
        { status: 400 },
      );
    }
    marketDay = marketDayRaw as typeof marketDay;
  }

  let mapLat = existing.mapLat;
  let mapLng = existing.mapLng;
  if (body.mapLat !== undefined || body.mapLng !== undefined) {
    const latParsed = parseOptionalCoord(
      body.mapLat !== undefined ? body.mapLat : existing.mapLat,
      "Latitude",
    );
    if (latParsed && typeof latParsed === "object" && "error" in latParsed) {
      return NextResponse.json({ error: latParsed.error }, { status: 400 });
    }
    const lngParsed = parseOptionalCoord(
      body.mapLng !== undefined ? body.mapLng : existing.mapLng,
      "Longitude",
    );
    if (lngParsed && typeof lngParsed === "object" && "error" in lngParsed) {
      return NextResponse.json({ error: lngParsed.error }, { status: 400 });
    }
    mapLat = latParsed as number | null;
    mapLng = lngParsed as number | null;
    if ((mapLat == null) !== (mapLng == null)) {
      return NextResponse.json(
        { error: "Both latitude and longitude are required for a map pin" },
        { status: 400 },
      );
    }
    if (mapLat != null && (mapLat < -90 || mapLat > 90)) {
      return NextResponse.json(
        { error: "Latitude must be between -90 and 90" },
        { status: 400 },
      );
    }
    if (mapLng != null && (mapLng < -180 || mapLng > 180)) {
      return NextResponse.json(
        { error: "Longitude must be between -180 and 180" },
        { status: 400 },
      );
    }
  }

  const updates: Record<string, unknown> = {
    name,
    phone,
    alternate_phone: alternatePhone,
    entity_type: "customer",
    category: "Customer",
    market_day: marketDay,
    area: addressArea,
    contact_name: contactName,
    address_building: addressBuilding,
    address_area: addressArea,
    address_city: addressCity,
    address_state: addressState,
    address_pincode: addressPincode,
    map_lat: mapLat,
    map_lng: mapLng,
  };

  if (typeof body.isActive === "boolean") {
    updates.is_active = body.isActive;
  }

  if (typeof body.isDefaulter === "boolean") {
    updates.is_defaulter = body.isDefaulter;
  }

  if (body.tierRubric !== undefined) {
    const parsed = parseTierRubric(body.tierRubric);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    updates.tier_rubric = parsed;
    updates.tier = deriveCustomerTier(parsed);
  } else if (body.tier !== undefined) {
    const tierRaw = String(body.tier ?? "").trim().toUpperCase();
    if (
      tierRaw &&
      !(CUSTOMER_TIERS as readonly string[]).includes(tierRaw)
    ) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    updates.tier = tierRaw;
  }

  if (body.priceRules !== undefined) {
    const parsed = parsePriceRules(body.priceRules);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    updates.price_rules = parsed;
  }

  if (body.balanceThreshold !== undefined) {
    if (
      body.balanceThreshold === null ||
      String(body.balanceThreshold).trim() === ""
    ) {
      updates.balance_threshold = null;
    } else {
      const threshold = Number(body.balanceThreshold);
      if (!Number.isFinite(threshold) || threshold < 0) {
        return NextResponse.json(
          { error: "Balance threshold must be a valid non-negative amount" },
          { status: 400 },
        );
      }
      updates.balance_threshold = Math.round(threshold * 100) / 100;
    }
  }

  if (body.pendingBalance !== undefined) {
    const pendingBalance = Number(body.pendingBalance);
    if (!Number.isFinite(pendingBalance) || pendingBalance < 0) {
      return NextResponse.json(
        { error: "Last balance must be a valid non-negative amount" },
        { status: 400 },
      );
    }
    updates.pending_balance = Math.round(pendingBalance * 100) / 100;
  }

  const { error: updateError } = await supabase
    .from("salesmen")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return NextResponse.json(
      { error: updateError.message || "Failed to save customer" },
      { status: 500 },
    );
  }

  const customer = await getSalesman(supabase, id);
  return NextResponse.json({ customer });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  if (!(await hasEntityCustomersAccess(supabase, profile.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await getSalesman(supabase, id);
  if (!existing || existing.entityType !== "customer") {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const [
    { count: orderCount, error: orderCountError },
    { count: invoiceCount, error: invoiceCountError },
  ] = await Promise.all([
    supabase
      .from("customer_orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id),
    supabase
      .from("salesmen_invoices")
      .select("id", { count: "exact", head: true })
      .eq("salesman_id", id),
  ]);

  if (orderCountError || invoiceCountError) {
    console.error(orderCountError ?? invoiceCountError);
    return NextResponse.json(
      { error: "Failed to check customer records" },
      { status: 500 },
    );
  }

  if ((orderCount ?? 0) > 0 || (invoiceCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This customer has orders or invoices and cannot be deleted. Mark them inactive instead.",
      },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase
    .from("salesmen")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error(deleteError);
    return NextResponse.json(
      { error: deleteError.message || "Failed to delete customer" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
