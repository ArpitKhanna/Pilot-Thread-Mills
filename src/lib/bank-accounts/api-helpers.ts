import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";

export async function requireBankAccountsAccess() {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return { error: auth.error };

  const { supabase, profile, user } = auth as Exclude<
    typeof auth,
    { error: NextResponse }
  >;

  if (!["admin", "accountant"].includes(profile.role ?? "")) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, profile, user };
}

export function validateBankAccountPayload(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const bankName = String(body.bankName ?? body.bank_name ?? "").trim();
  const accountNumber = String(
    body.accountNumber ?? body.account_number ?? "",
  )
    .replace(/\s+/g, "")
    .trim();
  const isActive =
    body.isActive === undefined && body.is_active === undefined
      ? true
      : Boolean(body.isActive ?? body.is_active);

  if (!name) {
    return { error: "Account holder name is required" };
  }
  if (!bankName) {
    return { error: "Bank name is required" };
  }

  return {
    data: {
      name,
      bank_name: bankName,
      account_number: accountNumber,
      is_active: isActive,
    },
  };
}