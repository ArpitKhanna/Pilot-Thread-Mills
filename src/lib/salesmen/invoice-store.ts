import type { Invoice } from "./types";

const STORAGE_KEY = "ptm-salesmen-created-invoices";

function readCreated(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Invoice[];
  } catch {
    return [];
  }
}

function writeCreated(invoices: Invoice[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

export function getCreatedInvoices(): Invoice[] {
  return readCreated();
}

/** Persist a newly generated invoice (client-side until backend exists) */
export function addInvoice(invoice: Invoice): Invoice {
  const created = readCreated().filter((i) => i.id !== invoice.id);
  writeCreated([invoice, ...created]);
  return invoice;
}
