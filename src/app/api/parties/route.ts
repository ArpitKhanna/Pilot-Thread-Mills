import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import type { SalesmanEntityType } from "@/lib/salesmen/types";

type PartyRow = {
  id: string;
  name: string;
  phone: string | null;
  entity_type: SalesmanEntityType;
  area: string | null;
  is_active: boolean;
};

async function hasModuleAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string | null,
  moduleId: string,
) {
  if (role === "admin") return true;
  const { data } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", role ?? "picker")
    .eq("module_id", moduleId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET() {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth;

  const [canSalesmen, canCustomers] = await Promise.all([
    hasModuleAccess(supabase, profile.role, "entity-salesmen"),
    hasModuleAccess(supabase, profile.role, "entity-customers"),
  ]);

  if (!canSalesmen && !canCustomers) {
    return NextResponse.json({ parties: [] });
  }

  const allowedTypes: SalesmanEntityType[] = [];
  if (canSalesmen) allowedTypes.push("salesman");
  if (canCustomers) allowedTypes.push("customer");

  const { data, error } = await supabase
    .from("salesmen")
    .select("id, name, phone, entity_type, area, is_active")
    .in("entity_type", allowedTypes)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const parties = ((data ?? []) as PartyRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone ?? "",
    entityType: row.entity_type,
    area: row.area ?? "",
    isActive: row.is_active,
  }));

  return NextResponse.json({ parties });
}
