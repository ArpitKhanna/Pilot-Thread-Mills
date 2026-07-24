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
  const ifscCode = String(body.ifscCode ?? body.ifsc_code ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
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
  if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
    return {
      error: "IFSC must be 11 characters (e.g. HDFC0001234)",
    };
  }

  return {
    data: {
      name,
      bank_name: bankName,
      account_number: accountNumber,
      ifsc_code: ifscCode,
      is_active: isActive,
    },
  };
}
