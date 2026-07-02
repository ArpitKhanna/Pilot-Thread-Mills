import { NextResponse } from "next/server";
import {
  getAuthedProfile,
  itemStatusForRole,
  validateItemPayload,
} from "@/lib/price-list/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth as Exclude<
    typeof auth,
    { error: NextResponse }
  >;

  const body = await request.json();
  const validated = validateItemPayload(body);
  if ("error" in validated && validated.error) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const isAdmin = profile.role === "admin";
  const status = itemStatusForRole(profile.role, true);

  const updatePayload = {
    ...validated.data,
    status,
    ...(isAdmin && status === "approved"
      ? {
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        }
      : {
          approved_by: null,
          approved_at: null,
        }),
  };

  const { data: item, error } = await supabase
    .from("price_list_items")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile } = auth as Exclude<
    typeof auth,
    { error: NextResponse }
  >;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("price_list_items")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
