import { NextResponse } from "next/server";
import type { ClientPushSubscription } from "@/lib/push/types";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

function parseSubscription(body: unknown): ClientPushSubscription | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const endpoint = typeof row.endpoint === "string" ? row.endpoint.trim() : "";
  const keys =
    row.keys && typeof row.keys === "object"
      ? (row.keys as Record<string, unknown>)
      : null;
  const p256dh =
    keys && typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = keys && typeof keys.auth === "string" ? keys.auth.trim() : "";

  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase, profile, user } = auth;

  const { data: access } = await supabase
    .from("role_module_access")
    .select("module_id")
    .eq("role", profile.role ?? "picker")
    .eq("module_id", "approvals")
    .maybeSingle();

  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subscription = parseSubscription(body);
  if (!subscription) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");
  const now = new Date().toISOString();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      updated_at: now,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
