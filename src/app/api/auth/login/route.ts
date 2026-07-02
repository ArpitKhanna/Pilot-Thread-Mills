import { NextResponse } from "next/server";
import { phoneToAuthEmail } from "@/lib/auth/phone";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone ?? "").trim();
    const pin = String(body.pin ?? "").trim();

    if (!phone || !pin) {
      return NextResponse.json(
        { error: "Phone number and PIN are required" },
        { status: 400 },
      );
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4–6 digits" },
        { status: 400 },
      );
    }

    const email = phoneToAuthEmail(phone);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Invalid phone number or PIN" },
        { status: 401 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active, account_type, auth_method")
      .eq("id", data.user.id)
      .single();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account has been deactivated" },
        { status: 403 },
      );
    }

    if (
      profile.account_type !== "employee" ||
      profile.auth_method !== "pin"
    ) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Use the correct sign-in method for your account" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid phone number format" },
      { status: 400 },
    );
  }
}
