/**
 * One-time bootstrap: creates the first admin employee.
 *
 * Usage:
 *   ADMIN_PHONE=9876543210 ADMIN_PIN=1234 ADMIN_NAME="Owner Name" npm run seed:admin
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 */
import { createClient } from "@supabase/supabase-js";

const AUTH_EMAIL_DOMAIN = "employee.pilotthreadmills.internal";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (phone.startsWith("+") && digits.length >= 10) return `+${digits}`;
  throw new Error("Invalid phone");
}

function phoneToAuthEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized.replace(/\D/g, "")}@${AUTH_EMAIL_DOMAIN}`;
}

async function main() {
  const phone = process.env.ADMIN_PHONE;
  const pin = process.env.ADMIN_PIN;
  const fullName = process.env.ADMIN_NAME ?? "Admin";

  if (!phone || !pin) {
    console.error("Set ADMIN_PHONE and ADMIN_PIN environment variables.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const normalizedPhone = normalizePhone(phone);
  const email = phoneToAuthEmail(phone);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: normalizedPhone },
  });

  if (createError || !created.user) {
    console.error("Failed to create admin:", createError?.message);
    process.exit(1);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: created.user.id,
    phone: normalizedPhone,
    full_name: fullName,
    account_type: "employee",
    auth_method: "pin",
    role: "admin",
    is_active: true,
  });

  if (profileError) {
    console.error("Failed to create profile:", profileError.message);
    await admin.auth.admin.deleteUser(created.user.id);
    process.exit(1);
  }

  console.log("Admin created successfully.");
  console.log(`  Phone: ${normalizedPhone}`);
  console.log(`  Name:  ${fullName}`);
  console.log("Sign in at /login with this phone and PIN.");
}

main();
