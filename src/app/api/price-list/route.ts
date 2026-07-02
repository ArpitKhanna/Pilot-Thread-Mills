import { NextResponse } from "next/server";
import {
  getAuthedProfile,
  itemStatusForRole,
  validateItemPayload,
} from "@/lib/price-list/api-helpers";

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile, user } = auth as Exclude<
    typeof auth,
    { error: NextResponse }
  >;

  if (!["admin", "accountant"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const validated = validateItemPayload(body);
  if ("error" in validated && validated.error) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const status = itemStatusForRole(profile.role);
  const now = new Date().toISOString();

  const { data: item, error } = await supabase
    .from("price_list_items")
    .insert({
      ...validated.data,
      status,
      created_by: user.id,
      ...(status === "approved"
        ? {
            approved_by: user.id,
            approved_at: now,
          }
        : {}),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item });
}
