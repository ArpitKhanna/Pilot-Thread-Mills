const AUTH_EMAIL_DOMAIN = "employee.pilotthreadmills.internal";

/** Normalize phone to E.164-style digits with leading + */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  if (phone.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  throw new Error("Enter a valid 10-digit mobile number");
}

/** Map phone to Supabase Auth email (no SMS/OTP required) */
export function phoneToAuthEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, "");
  return `${digits}@${AUTH_EMAIL_DOMAIN}`;
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith("+91") && normalized.length === 13) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
  }
  return normalized;
}
