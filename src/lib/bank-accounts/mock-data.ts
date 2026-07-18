import type { BankAccount } from "./types";

export const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "ba-hdfc-current",
    name: "HDFC Current",
    bankName: "HDFC Bank",
    accountNumber: "50200012345678",
    isActive: true,
  },
  {
    id: "ba-sbi-current",
    name: "SBI Current",
    bankName: "State Bank of India",
    accountNumber: "30123456789",
    isActive: true,
  },
  {
    id: "ba-icici-savings",
    name: "ICICI Ops",
    bankName: "ICICI Bank",
    accountNumber: "000501234567",
    isActive: true,
  },
];

export function getActiveBankAccounts(): BankAccount[] {
  return MOCK_BANK_ACCOUNTS.filter((a) => a.isActive);
}

export function getBankAccountById(id: string): BankAccount | undefined {
  return MOCK_BANK_ACCOUNTS.find((a) => a.id === id);
}

export function formatBankAccountLabel(account: BankAccount): string {
  const last4 = account.accountNumber.slice(-4);
  return `${account.name} (••••${last4})`;
}
