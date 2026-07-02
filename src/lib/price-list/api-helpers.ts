import { NextResponse } from "next/server";
import type { ItemType, Profile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES: ItemType[] = ["dibbi", "box", "cone", "zip", "elastic"];

export async function getAuthedProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile?.is_active) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, profile, user };
}

export function validateItemPayload(body: Record<string, unknown>) {
  const item_name = String(body.item_name ?? "").trim();
  const item_type = body.item_type as ItemType;
  const count_label = body.count_label ? String(body.count_label) : null;
  const salesmen_price = Number(body.salesmen_price);
  const customer_price = Number(body.customer_price);

  if (!item_name) {
    return { error: "Item name is required" };
  }
  if (!VALID_TYPES.includes(item_type)) {
    return { error: "Invalid item type" };
  }
  if (Number.isNaN(salesmen_price) || salesmen_price < 0) {
    return { error: "Invalid salesmen price" };
  }
  if (Number.isNaN(customer_price) || customer_price < 0) {
    return { error: "Invalid customer price" };
  }

  return {
    data: { item_name, item_type, count_label, salesmen_price, customer_price },
  };
}

export function itemStatusForRole(role: Profile["role"], isEdit = false) {
  if (role === "admin") return "approved" as const;
  if (role === "accountant") return "pending_approval" as const;
  return isEdit ? "pending_approval" as const : "pending_approval" as const;
}
