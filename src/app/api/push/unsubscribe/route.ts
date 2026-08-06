import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint =
    body &&
    typeof body === "object" &&
    typeof (body as Record<string, unknown>).endpoint === "string"
      ? (body as Record<string, string>).endpoint.trim()
      : "";

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
