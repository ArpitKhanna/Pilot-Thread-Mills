import type { BankAccount } from "./types";

export type DbBankAccountRow = {
  id: string;
  name: string;
  bank_name: string;
  account_number: string;
  is_active: boolean;
  created_at?: string;
};

export function mapBankAccountRow(row: DbBankAccountRow): BankAccount {
  return {
    id: row.id,
    name: row.name,
    bankName: row.bank_name,
    accountNumber: row.account_number,
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