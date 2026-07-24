import type { BankAccount } from "./types";

export type DbBankAccountRow = {
  id: string;
  name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string | null;
  is_active: boolean;
  created_at?: string;
};

export function mapBankAccountRow(row: DbBankAccountRow): BankAccount {
  return {
    id: row.id,
    name: row.name,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    ifscCode: row.ifsc_code ?? "",
    isActive: row.is_active,
  };
}

export function formatBankAccountLabel(account: BankAccount): string {
  const digits = account.accountNumber.replace(/\s+/g, "");
  if (!digits) {
    return `${account.name} · ${account.bankName}`;
  }
  const last4 = digits.slice(-4);
  return `${account.name} · ${account.bankName} (••••${last4})`;
}

export function buildBankAccountWhatsAppShareUrl(account: BankAccount): string {
  const accountNo = account.accountNumber.replace(/\s+/g, "").trim();
  const ifsc = account.ifscCode.replace(/\s+/g, "").trim().toUpperCase();
  const text = [
    "Bank Account Details",
    `Name: ${account.name.trim() || "—"}`,
    `Bank: ${account.bankName.trim() || "—"}`,
    `Account No.: ${accountNo || "—"}`,
    `IFSC: ${ifsc || "—"}`,
  ].join("\n");

  // WhatsApp Web — no fixed recipient so staff can pick who to send to
  return `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
