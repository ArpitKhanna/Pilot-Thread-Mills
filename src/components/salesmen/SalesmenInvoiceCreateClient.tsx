"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { InvoicePaymentsStep } from "@/components/salesmen/InvoicePaymentsStep";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import {
  createEmptyDraftLine,
  createInitialDraftLines,
  InvoiceLineEntry,
  type DraftLine,
} from "@/components/salesmen/InvoiceLineEntry";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import { calculateSalesmanDiscount, formatINR } from "@/lib/salesmen/mock-data";
import { buildAutoAppliedAdvancePayments } from "@/lib/salesmen/advance-apply";
import { buildAutoAppliedReturnItems } from "@/lib/salesmen/return-apply";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  Salesman,
  SalesmanAdvance,
  SalesmanReturn,
} from "@/lib/salesmen/types";

function mergeSalesmenBalances(
  current: Salesman[],
  fresh: Salesman[],
): Salesman[] {
  const freshById = new Map(fresh.map((s) => [s.id, s]));
  return current.map((s) => freshById.get(s.id) ?? s);
}

type SalesmenInvoiceCreateClientProps = {
  context: AppContext;
  salesmen: Salesman[];
  priceList: PriceListItem[];
  bankAccounts: BankAccount[];
  initialSalesmanId?: string;
  mode?: "create" | "edit";
  initialInvoice?: Invoice;
};

type BuilderStep = 1 | 2;

type DraftReturnLine = DraftLine & {
  standAloneReturnId?: string;
};

function draftReturnLinesFromInvoice(invoice: Invoice): DraftReturnLine[] {
  return (invoice.returnItems ?? []).map((item) => ({
    key: item.id || `ret-${crypto.randomUUID()}`,
    priceListItemId: item.priceListItemId ?? null,
    name: item.name,
    qty: String(item.qty),
    unitPrice: item.unitPrice,
    amount: item.amount,
    standAloneReturnId: item.standAloneReturnId,
  }));
}

function draftLinesFromInvoice(invoice: Invoice): DraftLine[] {
  const filled = invoice.lineItems.map((item) => ({
    key: item.id || `line-${crypto.randomUUID()}`,
    priceListItemId: item.priceListItemId ?? null,
    name: item.name,
    qty: String(item.qty),
    unitPrice: item.unitPrice,
    amount: item.amount,
  }));
  const blanks = createInitialDraftLines(
    Math.max(1, 5 - filled.length),
  ).slice(0, Math.max(1, 5 - filled.length));
  return [...filled, ...blanks];
}

type PaymentFieldErrors = Record<
  string,
  {
    amount?: string;
    chequeNumber?: string;
    depositAccountId?: string;
    depositAccountOther?: string;
  }
>;

function hasDepositDestination(payment: InvoicePaymentEntry): boolean {
  return Boolean(
    payment.depositAccountId?.trim() || payment.depositAccountOther?.trim(),
  );
}

function depositFieldErrors(
  payment: InvoicePaymentEntry,
): PaymentFieldErrors[string] {
  const field: PaymentFieldErrors[string] = {};
  if (payment.depositAccountOther !== undefined) {
    if (!payment.depositAccountOther.trim()) {
      field.depositAccountOther = "Enter a name.";
    }
  } else if (!payment.depositAccountId) {
    field.depositAccountId = "Select a deposit account.";
  }
  return field;
}

function mapPaymentApiErrorToFields(
  message: string,
  payments: InvoicePaymentEntry[],
): PaymentFieldErrors | null {
  const lower = message.toLowerCase();
  const next: PaymentFieldErrors = {};

  if (lower.includes("sender name")) {
    // Sender name is optional — ignore stale API messages.
    return {};
  }

  for (const payment of payments) {
    const field: PaymentFieldErrors[string] = {};
    if (lower.includes("amount") && !(payment.amount > 0)) {
      field.amount = "Enter an amount greater than zero.";
    }
    if (
      payment.method === "cheque" &&
      lower.includes("cheque") &&
      !payment.chequeNumber?.trim()
    ) {
      field.chequeNumber = "Cheque number is required.";
    }
    if (
      (payment.method === "cheque" ||
        payment.method === "upi" ||
        payment.method === "imps") &&
      lower.includes("deposit account") &&
      !hasDepositDestination(payment)
    ) {
      Object.assign(field, depositFieldErrors(payment));
    }
    if (Object.keys(field).length > 0) {
      next[payment.id] = field;
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

export function SalesmenInvoiceCreateClient({
  context,
  salesmen,
  priceList,
  bankAccounts,
  initialSalesmanId,
  mode = "create",
  initialInvoice,
}: SalesmenInvoiceCreateClientProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(initialInvoice);

  const [draftId] = useState(
    () => initialInvoice?.id ?? `inv-draft-${Date.now()}`,
  );
  const [draftNumber] = useState(
    () => initialInvoice?.number ?? `INV-SM-${Date.now()}`,
  );
  const [issuedAt] = useState(
    () => initialInvoice?.issuedAt ?? new Date().toISOString(),
  );

  const [step, setStep] = useState<BuilderStep>(1);
  const [salesmanId, setSalesmanId] = useState(
    () => initialInvoice?.salesmanId ?? "",
  );
  const [salesmenList, setSalesmenList] = useState(salesmen);
  const [salesmanQuery, setSalesmanQuery] = useState("");
  const [salesmanOpen, setSalesmanOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initialInvoice
      ? draftLinesFromInvoice(initialInvoice)
      : createInitialDraftLines(5),
  );
  const [returnOpen, setReturnOpen] = useState(
    () => Boolean(initialInvoice?.returnItems?.length),
  );
  const [returnLines, setReturnLines] = useState<DraftReturnLine[]>(() =>
    initialInvoice ? draftReturnLinesFromInvoice(initialInvoice) : [],
  );
  const [additionalDiscount, setAdditionalDiscount] = useState("");
  const [additionalAmount, setAdditionalAmount] = useState(() =>
    initialInvoice?.additionalAmount
      ? String(initialInvoice.additionalAmount)
      : "",
  );
  const [additionalAmountReason, setAdditionalAmountReason] = useState(
    () => initialInvoice?.additionalAmountReason ?? "",
  );
  const [payments, setPayments] = useState<InvoicePaymentEntry[]>(
    () => initialInvoice?.paymentEntries ?? [],
  );
  const [openAdvances, setOpenAdvances] = useState<SalesmanAdvance[]>([]);
  const [openReturns, setOpenReturns] = useState<SalesmanReturn[]>([]);
  const [advancesReady, setAdvancesReady] = useState(false);
  const [returnsReady, setReturnsReady] = useState(false);
  const [dismissedAdvanceIds, setDismissedAdvanceIds] = useState<string[]>([]);
  const [dismissedReturnIds, setDismissedReturnIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paymentFieldErrors, setPaymentFieldErrors] = useState<
    Record<
      string,
      {
        amount?: string;
        chequeNumber?: string;
        depositAccountId?: string;
        depositAccountOther?: string;
      }
    >
  >({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydratedDiscount, setHydratedDiscount] = useState(!isEdit);

  const refreshSalesmenBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/salesmen");
      const data = (await res.json()) as { salesmen?: Salesman[] };
      if (!data.salesmen) return;
      setSalesmenList((prev) => mergeSalesmenBalances(prev, data.salesmen!));
    } catch {
      // Keep SSR snapshot on failure.
    }
  }, []);

  useEffect(() => {
    setSalesmenList(salesmen);
    void refreshSalesmenBalances();
  }, [salesmen, refreshSalesmenBalances]);

  useEffect(() => {
    if (!salesmanOpen || isEdit) return;
    void refreshSalesmenBalances();
  }, [salesmanOpen, isEdit, refreshSalesmenBalances]);

  useEffect(() => {
    const id = initialInvoice?.salesmanId ?? initialSalesmanId;
    if (!id) return;
    const match = salesmen.find((s) => s.id === id);
    if (!match) return;
    setSalesmanId(match.id);
    setSalesmanQuery(match.name);
  }, [initialSalesmanId, initialInvoice?.salesmanId, salesmen]);

  useEffect(() => {
    if (!salesmanId) {
      setOpenAdvances([]);
      setOpenReturns([]);
      setAdvancesReady(true);
      setReturnsReady(true);
      return;
    }
    let cancelled = false;
    setAdvancesReady(false);
    setReturnsReady(false);
    setDismissedAdvanceIds([]);
    setDismissedReturnIds([]);
    void (async () => {
      try {
        const [salesmanRes, advRes, retRes] = await Promise.all([
          fetch(`/api/salesmen/${salesmanId}`),
          fetch(`/api/salesmen/${salesmanId}/advances`),
          fetch(`/api/salesmen/${salesmanId}/returns`),
        ]);
        const salesmanData = (await salesmanRes.json()) as {
          salesman?: Salesman;
        };
        const advData = (await advRes.json()) as {
          advances?: SalesmanAdvance[];
        };
        const retData = (await retRes.json()) as {
          returns?: SalesmanReturn[];
        };
        if (cancelled) return;
        if (salesmanData.salesman) {
          setSalesmenList((prev) => {
            const idx = prev.findIndex((s) => s.id === salesmanId);
            if (idx === -1) return [...prev, salesmanData.salesman!];
            const next = [...prev];
            next[idx] = salesmanData.salesman!;
            return next;
          });
        }
        setOpenAdvances(
          (advData.advances ?? []).filter(
            (a) =>
              a.status === "active" &&
              a.verificationStatus === "verified",
          ),
        );
        setOpenReturns(
          (retData.returns ?? []).filter(
            (r) =>
              r.status === "active" &&
              r.verificationStatus === "verified",
          ),
        );
      } catch {
        if (!cancelled) {
          setOpenAdvances([]);
          setOpenReturns([]);
        }
      } finally {
        if (!cancelled) {
          setAdvancesReady(true);
          setReturnsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [salesmanId]);

  // After salesman + lines known in edit mode, split stored discount into rule vs additional
  useEffect(() => {
    if (!isEdit || !initialInvoice || hydratedDiscount) return;
    const salesman = salesmenList.find((s) => s.id === salesmanId);
    if (!salesmanId) return;
    const rule = calculateSalesmanDiscount(
      lines
        .filter((l) => l.priceListItemId && Number(l.qty) > 0)
        .map((l) => ({
          priceListItemId: l.priceListItemId,
          name: l.name,
          qty: Number(l.qty),
        })),
      priceList,
      salesman?.discountRules,
    );
    const stored = initialInvoice.discountAmount ?? 0;
    const additional = Math.max(0, Math.round((stored - rule) * 100) / 100);
    setAdditionalDiscount(additional > 0 ? String(additional) : "");
    setHydratedDiscount(true);
  }, [
    isEdit,
    initialInvoice,
    hydratedDiscount,
    salesmanId,
    salesmenList,
    lines,
    priceList,
  ]);

  const salesman = salesmenList.find((s) => s.id === salesmanId) ?? null;

  const filteredSalesmen = useMemo(() => {
    const q = salesmanQuery.trim().toLowerCase();
    if (!q || (salesman && salesman.name.toLowerCase() === q)) {
      return salesmenList;
    }
    return salesmenList.filter((s) => s.name.toLowerCase().includes(q));
  }, [salesmenList, salesmanQuery, salesman]);

  const filledLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          l.priceListItemId &&
          l.name.trim() &&
          Number(l.qty) > 0 &&
          l.unitPrice > 0,
      ),
    [lines],
  );

  const subtotal = useMemo(
    () => filledLines.reduce((sum, l) => sum + l.amount, 0),
    [filledLines],
  );

  const filledReturns = useMemo(
    () =>
      returnLines.filter(
        (l) =>
          l.name.trim() &&
          Number(l.qty) > 0 &&
          l.unitPrice > 0 &&
          (l.priceListItemId || l.standAloneReturnId),
      ),
    [returnLines],
  );

  const returnAmount = useMemo(
    () => filledReturns.reduce((sum, l) => sum + l.amount, 0),
    [filledReturns],
  );

  const ruleDiscount = useMemo(
    () =>
      calculateSalesmanDiscount(
        filledLines.map((l) => ({
          priceListItemId: l.priceListItemId,
          name: l.name,
          qty: Number(l.qty),
        })),
        priceList,
        salesman?.discountRules,
      ),
    [filledLines, priceList, salesman?.discountRules],
  );

  const additionalNum = Number(additionalDiscount);
  const additionalDiscountAmount =
    Number.isFinite(additionalNum) && additionalNum > 0 ? additionalNum : 0;

  const additionalAmountNum = Number(additionalAmount);
  const additionalAmountValue =
    Number.isFinite(additionalAmountNum) && additionalAmountNum > 0
      ? additionalAmountNum
      : 0;

  const discountAmount = ruleDiscount + additionalDiscountAmount;
  const invoiceTotal = Math.max(
    0,
    subtotal - returnAmount - discountAmount + additionalAmountValue,
  );

  const amountPaid = useMemo(
    () =>
      payments
        .filter((p) => p.status !== "cancelled")
        .reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments],
  );

  // Net carried balance (negative = credit). pendingBalance already nets open advances/returns.
  const previousBalance =
    (salesman?.pendingBalance ?? 0) -
    (isEdit && initialInvoice
      ? Math.round(
          (initialInvoice.totalAmount - initialInvoice.amountPaid) * 100,
        ) / 100
      : 0);

  const advancesForApply = useMemo(() => {
    return openAdvances
      .filter((a) => !dismissedAdvanceIds.includes(a.id))
      .map((advance) => {
        const appliedOnThisInvoice = (initialInvoice?.paymentEntries ?? [])
          .filter(
            (p) =>
              p.advanceId === advance.id && p.status !== "cancelled",
          )
          .reduce((s, p) => s + (p.amount || 0), 0);
        return {
          ...advance,
          remainingAmount:
            Math.round(
              (advance.remainingAmount + appliedOnThisInvoice) * 100,
            ) / 100,
        };
      })
      .filter((a) => a.remainingAmount > 0);
  }, [openAdvances, initialInvoice, dismissedAdvanceIds]);

  const returnsForApply = useMemo(() => {
    return openReturns
      .filter((r) => !dismissedReturnIds.includes(r.id))
      .map((ret) => {
        const appliedOnThisInvoice = (initialInvoice?.returnItems ?? [])
          .filter((l) => l.standAloneReturnId === ret.id)
          .reduce((s, l) => s + (l.amount || 0), 0);
        return {
          ...ret,
          remainingAmount:
            Math.round(
              (ret.remainingAmount + appliedOnThisInvoice) * 100,
            ) / 100,
        };
      })
      .filter((r) => r.remainingAmount > 0);
  }, [openReturns, initialInvoice, dismissedReturnIds]);

  // Keep advance applications synced when totals / salesman / credit pool change
  useEffect(() => {
    if (!advancesReady || !salesmanId) return;
    setPayments((prev) => {
      const next = buildAutoAppliedAdvancePayments(
        advancesForApply,
        previousBalance,
        invoiceTotal,
        prev,
      );
      // Preserve user-reduced advance amounts (never force higher than what they set)
      return next.map((p) => {
        if (!p.advanceId) return p;
        const existing = prev.find((x) => x.advanceId === p.advanceId);
        if (existing && existing.amount < p.amount) {
          return { ...p, amount: existing.amount };
        }
        return p;
      });
    });
  }, [
    advancesReady,
    salesmanId,
    invoiceTotal,
    previousBalance,
    advancesForApply,
  ]);

  // Auto-apply open stand-alone returns as return lines
  useEffect(() => {
    if (!returnsReady || !salesmanId) return;
    setReturnLines((prev) => {
      const existingItems: InvoiceLineItem[] = prev.map((l) => ({
        id: l.key,
        name: l.name,
        qty: Number(l.qty) || 0,
        unitPrice: l.unitPrice,
        amount: l.amount,
        priceListItemId: l.priceListItemId ?? undefined,
        standAloneReturnId: l.standAloneReturnId,
      }));
      const next = buildAutoAppliedReturnItems(returnsForApply, existingItems);
      const mapped: DraftReturnLine[] = next.map((item) => {
        const existing = prev.find(
          (p) =>
            (item.standAloneReturnId &&
              p.standAloneReturnId === item.standAloneReturnId &&
              p.name === item.name) ||
            (!item.standAloneReturnId && p.key === item.id),
        );
        const amount =
          existing && existing.amount < item.amount
            ? existing.amount
            : item.amount;
        const qty =
          existing && Number(existing.qty) > 0 && existing.amount < item.amount
            ? existing.qty
            : String(item.qty);
        return {
          key: item.id,
          priceListItemId: item.priceListItemId ?? null,
          name: item.name,
          qty,
          unitPrice: item.unitPrice,
          amount,
          standAloneReturnId: item.standAloneReturnId,
        };
      });
      if (mapped.length > 0) setReturnOpen(true);
      return mapped;
    });
  }, [returnsReady, salesmanId, returnsForApply]);

  function handlePaymentsChange(next: InvoicePaymentEntry[]) {
    const removedAdvanceIds = payments
      .filter((p) => p.advanceId)
      .map((p) => p.advanceId!)
      .filter((id) => !next.some((p) => p.advanceId === id));
    if (removedAdvanceIds.length > 0) {
      setDismissedAdvanceIds((prev) => [
        ...new Set([...prev, ...removedAdvanceIds]),
      ]);
    }
    setPayments(next);
  }

  const liveInvoice: Invoice = useMemo(() => {
    const lineItems: InvoiceLineItem[] = filledLines.map((l) => ({
      id: l.key,
      name: l.name,
      qty: Number(l.qty),
      unitPrice: l.unitPrice,
      amount: l.amount,
      priceListItemId: l.priceListItemId ?? undefined,
    }));

    const returnItems: InvoiceLineItem[] | undefined =
      filledReturns.length > 0
        ? filledReturns.map((l) => ({
            id: l.key,
            name: l.name,
            qty: Number(l.qty),
            unitPrice: l.unitPrice,
            amount: l.amount,
            priceListItemId: l.priceListItemId ?? undefined,
            standAloneReturnId: l.standAloneReturnId,
          }))
        : undefined;

    return {
      id: draftId,
      number: draftNumber,
      salesmanId: salesman?.id ?? "",
      issuedAt,
      itemCount: lineItems.length,
      totalAmount: invoiceTotal,
      amountPaid,
      lineItems,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      additionalAmount:
        additionalAmountValue > 0 ? additionalAmountValue : undefined,
      additionalAmountReason:
        additionalAmountValue > 0 && additionalAmountReason.trim()
          ? additionalAmountReason.trim()
          : undefined,
      returnItems,
      paymentEntries: payments.length > 0 ? payments : undefined,
      verificationStatus:
        initialInvoice?.verificationStatus ?? "pending_verification",
      createdBy: initialInvoice?.createdBy ?? null,
      createdByName: initialInvoice?.createdByName ?? null,
      verifiedBy: initialInvoice?.verifiedBy ?? null,
      verifiedByName: initialInvoice?.verifiedByName ?? null,
      verifiedAt: initialInvoice?.verifiedAt ?? null,
      verificationNote: initialInvoice?.verificationNote ?? null,
    };
  }, [
    draftId,
    draftNumber,
    issuedAt,
    filledLines,
    filledReturns,
    salesman?.id,
    invoiceTotal,
    amountPaid,
    discountAmount,
    additionalAmountValue,
    additionalAmountReason,
    payments,
    initialInvoice,
  ]);

  const previewSalesman: Salesman = salesman ?? {
    id: "preview-placeholder",
    name: "Select a salesman",
    phone: "",
    alternatePhone: "",
    entityType: "salesman",
    isActive: true,
    openingBalance: 0,
    pendingBalance: 0,
    lastInvoiceAt: null,
    discountRules: [],
    marketDay: "",
    area: "",
    isDefaulter: false,
    tier: "",
    balanceThreshold: null,
    addressBuilding: "",
    addressArea: "",
    addressCity: "",
    addressState: "",
    addressPincode: "",
    mapLat: null,
    mapLng: null,
    tierRubric: {
      orderFrequency: null,
      orderAmount: null,
      paymentAmount: null,
      paymentSpeed: null,
    },
    priceRules: [],
  };

  function selectSalesman(s: Salesman) {
    setSalesmanId(s.id);
    setSalesmanQuery(s.name);
    setSalesmanOpen(false);
    setError(null);
  }

  function updateReturnLine(key: string, patch: Partial<DraftReturnLine>) {
    setReturnLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const merged = { ...line, ...patch };
        const qtyNum = Number(merged.qty);
        const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
        merged.amount = Math.round(qty * merged.unitPrice * 100) / 100;
        return merged;
      }),
    );
  }

  function removeReturnLine(key: string) {
    setReturnLines((prev) => {
      const target = prev.find((l) => l.key === key);
      if (target?.standAloneReturnId) {
        setDismissedReturnIds((ids) => [
          ...new Set([...ids, target.standAloneReturnId!]),
        ]);
      }
      const next = prev.filter((l) => l.key !== key);
      if (next.length === 0) setReturnOpen(false);
      return next;
    });
  }

  function clearAllReturns() {
    const linked = returnLines
      .map((l) => l.standAloneReturnId)
      .filter((id): id is string => Boolean(id));
    if (linked.length > 0) {
      setDismissedReturnIds((prev) => [...new Set([...prev, ...linked])]);
    }
    setReturnOpen(false);
    setReturnLines([]);
  }

  function addManualReturnLine() {
    setReturnOpen(true);
    setReturnLines((prev) => [
      ...prev,
      {
        ...createEmptyDraftLine(),
        key: `ret-${crypto.randomUUID()}`,
      },
    ]);
  }

  function validateStep1(): boolean {
    if (!salesman) {
      setError("Select a salesman first.");
      return false;
    }
    if (filledLines.length === 0 && !(additionalAmountValue > 0)) {
      setError("Add at least one line item, or enter an additional amount.");
      return false;
    }
    if (additionalAmountValue > 0 && !additionalAmountReason.trim()) {
      setError("Enter a reason for the additional amount.");
      return false;
    }
    setError(null);
    return true;
  }

  function goToPayments() {
    if (!validateStep1()) return;
    setStep(2);
  }

  function validatePayments(): boolean {
    const next: typeof paymentFieldErrors = {};
    for (const payment of payments) {
      const field: (typeof next)[string] = {};
      if (!(payment.amount > 0)) {
        field.amount = "Enter an amount greater than zero.";
      }
      if (payment.method === "cheque") {
        if (!payment.chequeNumber?.trim()) {
          field.chequeNumber = "Cheque number is required.";
        }
        Object.assign(field, depositFieldErrors(payment));
      }
      if (payment.method === "upi" || payment.method === "imps") {
        Object.assign(field, depositFieldErrors(payment));
      }
      if (Object.keys(field).length > 0) {
        next[payment.id] = field;
      }
    }
    setPaymentFieldErrors(next);
    setError(null);
    return Object.keys(next).length === 0;
  }

  function handleGenerateClick() {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validatePayments()) {
      setStep(2);
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmSave() {
    if (!salesman || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        salesmanId: salesman.id,
        number: draftNumber,
        issuedAt: isEdit ? issuedAt : new Date().toISOString(),
        lineItems: liveInvoice.lineItems,
        returnItems: liveInvoice.returnItems ?? [],
        discountAmount: liveInvoice.discountAmount ?? 0,
        additionalAmount: liveInvoice.additionalAmount ?? 0,
        additionalAmountReason: liveInvoice.additionalAmountReason ?? "",
        paymentEntries: liveInvoice.paymentEntries ?? [],
        totalAmount: liveInvoice.totalAmount,
        amountPaid: liveInvoice.amountPaid,
        notes: liveInvoice.notes ?? null,
      };

      const res = await fetch(
        isEdit
          ? `/api/salesmen-invoices/${draftId}`
          : "/api/salesmen-invoices",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not save invoice.");
      }

      setConfirmOpen(false);
      // Hard navigation so detail header balance / invoices reload from server.
      window.location.assign(
        `/entities/salesmen/${salesman.id}?tab=invoices`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save invoice.";
      setConfirmOpen(false);
      setStep(2);
      setSaving(false);

      const fieldErrors = mapPaymentApiErrorToFields(message, payments);
      if (fieldErrors) {
        setPaymentFieldErrors(fieldErrors);
        setError(null);
      } else {
        setPaymentFieldErrors({});
        setError(message);
      }
    }
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Orders" },
          { label: "Salesmen" },
        ]}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden print:hidden">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              {isEdit ? "Edit Invoice" : "Create New Invoice"}
            </h1>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-2">
          <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:px-8">
            <div className="mx-auto max-w-2xl space-y-6">
              <StepTabs
                step={step}
                onStepChange={(next) => {
                  if (next === 2) {
                    goToPayments();
                    return;
                  }
                  setError(null);
                  setStep(1);
                }}
              />

              {step === 1 && (
                <>
                  <section className="space-y-4">
                    <h2 className="text-sm font-medium">Invoice Details</h2>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block min-w-0 sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Salesman
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            role="combobox"
                            aria-expanded={salesmanOpen}
                            aria-autocomplete="list"
                            value={salesmanQuery}
                            placeholder="Search salesman…"
                            autoComplete="off"
                            disabled={isEdit}
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-70"
                            onFocus={() => {
                              if (!isEdit) setSalesmanOpen(true);
                            }}
                            onChange={(e) => {
                              if (isEdit) return;
                              setSalesmanQuery(e.target.value);
                              setSalesmanId("");
                              setSalesmanOpen(true);
                            }}
                            onBlur={() => {
                              window.setTimeout(
                                () => setSalesmanOpen(false),
                                150,
                              );
                            }}
                            onKeyDown={(e) => {
                              if (isEdit) return;
                              if (e.key === "Escape") setSalesmanOpen(false);
                              if (e.key === "Enter" && filteredSalesmen[0]) {
                                e.preventDefault();
                                selectSalesman(filteredSalesmen[0]);
                              }
                            }}
                          />
                          {!isEdit &&
                            salesmanOpen &&
                            filteredSalesmen.length > 0 && (
                            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-md">
                              {filteredSalesmen.map((s) => (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sidebar"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      selectSalesman(s);
                                    }}
                                  >
                                    <span>{s.name}</span>
                                    <span className="tabular-nums text-muted">
                                      {formatINR(s.pendingBalance)}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </label>

                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Last balance
                        </span>
                        <p className="py-2.5 text-sm tabular-nums text-foreground">
                          {salesman ? formatINR(previousBalance) : "—"}
                        </p>
                      </div>
                    </div>

                  </section>

                  <section className="space-y-3">
                    <h2 className="text-base font-medium">Items</h2>
                    <InvoiceLineEntry
                      priceList={priceList}
                      lines={lines}
                      onChange={setLines}
                      disabled={!salesman}
                    />
                    {!salesman && (
                      <p className="text-xs text-muted">
                        Select a salesman to start entering items.
                      </p>
                    )}
                    {salesman && priceList.length === 0 && (
                      <p className="text-xs text-muted">
                        No approved price list items available.
                      </p>
                    )}

                    {!returnOpen || returnLines.length === 0 ? (
                      <button
                        type="button"
                        disabled={!salesman}
                        onClick={addManualReturnLine}
                        className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
                      >
                        + Add return
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-dashed border-border bg-sidebar/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Returns</p>
                          <button
                            type="button"
                            onClick={clearAllReturns}
                            className="text-xs text-muted hover:text-foreground"
                          >
                            Remove all
                          </button>
                        </div>
                        {returnLines.map((line) => (
                          <div key={line.key} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              {line.standAloneReturnId ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-800 uppercase">
                                  Applied return
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted uppercase tracking-wide">
                                  Manual
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeReturnLine(line.key)}
                                className="text-xs text-muted hover:text-foreground"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2">
                              <ItemNameCombobox
                                items={priceList}
                                value={line.name}
                                disabled={!salesman || Boolean(line.standAloneReturnId)}
                                placeholder="Returning item…"
                                onChange={(name) =>
                                  updateReturnLine(line.key, {
                                    name,
                                    priceListItemId: null,
                                    unitPrice: 0,
                                  })
                                }
                                onSelect={(item) =>
                                  updateReturnLine(line.key, {
                                    name: item.item_name,
                                    priceListItemId: item.id,
                                    unitPrice: item.salesmen_price,
                                  })
                                }
                                onTabToQty={() => undefined}
                              />
                              <input
                                type="number"
                                min={0}
                                step="any"
                                inputMode="decimal"
                                disabled={!salesman}
                                value={line.qty}
                                placeholder="Qty"
                                className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
                                onChange={(e) =>
                                  updateReturnLine(line.key, {
                                    qty: e.target.value,
                                  })
                                }
                              />
                              <span className="text-right text-sm tabular-nums text-[#c45c26]">
                                {line.amount > 0
                                  ? `−${formatINR(line.amount)}`
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          disabled={!salesman}
                          onClick={addManualReturnLine}
                          className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
                        >
                          + Add another return item
                        </button>
                      </div>
                    )}

                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Rule discount
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2.5">
                        <p className="text-sm tabular-nums text-foreground">
                          {salesman ? formatINR(ruleDiscount) : "—"}
                        </p>
                        {salesman && salesman.discountRules.length > 0 ? (
                          <p className="text-xs text-muted">
                            {salesman.discountRules
                              .map((rule) => rule.description)
                              .join(" · ")}
                          </p>
                        ) : salesman ? (
                          <p className="text-xs text-muted">
                            No discount rules on this salesman
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Additional discount
                      </span>
                      <div className="flex overflow-hidden rounded-lg border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20">
                        <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                          ₹
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={additionalDiscount}
                          placeholder="0"
                          disabled={!salesman}
                          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                          onChange={(e) =>
                            setAdditionalDiscount(e.target.value)
                          }
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Additional amount
                      </span>
                      <div className="flex overflow-hidden rounded-lg border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20">
                        <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                          ₹
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={additionalAmount}
                          placeholder="0"
                          disabled={!salesman}
                          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                          onChange={(e) => setAdditionalAmount(e.target.value)}
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Reason for additional amount
                      </span>
                      <input
                        type="text"
                        value={additionalAmountReason}
                        placeholder={
                          additionalAmountValue > 0
                            ? "e.g. Transport, loading charges"
                            : "Enter an additional amount first"
                        }
                        disabled={!salesman || !(additionalAmountValue > 0)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
                        onChange={(e) =>
                          setAdditionalAmountReason(e.target.value)
                        }
                      />
                    </label>
                  </section>

                  {error && (
                    <p className="text-sm text-[#c45c26]" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end pb-4">
                    <button
                      type="button"
                      onClick={goToPayments}
                      className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
                    >
                      Continue to payments
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <section>
                    <h2 className="text-base font-medium">Payments</h2>
                  </section>

                  <InvoicePaymentsStep
                    payments={payments}
                    onChange={(next) => {
                      handlePaymentsChange(next);
                      setPaymentFieldErrors({});
                      setError(null);
                    }}
                    invoiceTotal={invoiceTotal}
                    previousBalance={salesman ? previousBalance : 0}
                    bankAccounts={bankAccounts}
                    disabled={!salesman}
                    fieldErrors={paymentFieldErrors}
                  />

                  {error && (
                    <p className="text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setPaymentFieldErrors({});
                        setStep(1);
                      }}
                      className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-sidebar"
                    >
                      Back to items
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateClick}
                      className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
                    >
                      {isEdit ? "Save Changes" : "Generate Invoice"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="hidden min-h-0 overflow-y-auto bg-[#f0efeb] px-4 py-5 sm:px-6 lg:block lg:px-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Preview</h2>
              <span className="text-xs text-muted">Updates as you type</span>
            </div>
            <InvoicePreview
              invoice={liveInvoice}
              salesman={previewSalesman}
              hideToolbar
              previousBalance={salesman ? previousBalance : undefined}
            />
          </div>
        </div>
      </main>

      <div className="hidden print:block">
        <InvoicePreview
          invoice={liveInvoice}
          salesman={previewSalesman}
          forPrint
          previousBalance={salesman ? previousBalance : undefined}
        />
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
        title={isEdit ? "Save these changes?" : "Generate this invoice?"}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-sidebar disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={confirmSave}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : isEdit
                  ? "Yes, save changes"
                  : "Yes, generate"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          {isEdit ? "Update" : "Create"} invoice{" "}
          <span className="font-medium text-foreground">
            {liveInvoice.number}
          </span>{" "}
          for{" "}
          <span className="font-medium text-foreground">
            {salesman?.name}
          </span>
          ?
        </p>
        <dl className="mt-4 space-y-1.5 text-sm">
          {previousBalance !== 0 && (
            <div className="flex justify-between gap-4 text-muted">
              <dt>Prev. balance</dt>
              <dd className="tabular-nums text-foreground">
                {formatINR(previousBalance)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 text-muted">
            <dt>This invoice</dt>
            <dd className="tabular-nums text-foreground">
              {formatINR(Math.max(0, subtotal - returnAmount))}
            </dd>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between gap-4 text-muted">
              <dt>Discount</dt>
              <dd className="tabular-nums text-foreground">
                −{formatINR(discountAmount)}
              </dd>
            </div>
          )}
          {additionalAmountValue > 0 && (
            <div className="flex justify-between gap-4 text-muted">
              <dt>
                Additional amount
                {additionalAmountReason.trim() ? (
                  <span className="block text-xs text-muted/80">
                    {additionalAmountReason.trim()}
                  </span>
                ) : null}
              </dt>
              <dd className="tabular-nums text-foreground">
                +{formatINR(additionalAmountValue)}
              </dd>
            </div>
          )}
          <div className="my-2 border-t border-border" />
          <div className="flex justify-between gap-4 text-muted">
            <dt>Invoice total</dt>
            <dd className="tabular-nums text-foreground">
              {formatINR(previousBalance + invoiceTotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-muted">
            <dt>Paid</dt>
            <dd className="tabular-nums text-foreground">
              {formatINR(amountPaid)}
            </dd>
          </div>
          <div className="my-2 border-t border-border" />
          <div className="flex justify-between gap-4 font-medium text-foreground">
            <dt>Closing</dt>
            <dd
              className={`tabular-nums ${
                previousBalance + invoiceTotal - amountPaid > 0
                  ? "text-[#c45c26]"
                  : previousBalance + invoiceTotal - amountPaid < 0
                    ? "text-credit"
                    : ""
              }`}
            >
              {formatINR(previousBalance + invoiceTotal - amountPaid)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          {isEdit
            ? context.profile.role === "admin"
              ? "Changes will replace the current invoice details."
              : "Saving will resubmit this invoice for admin verification."
            : context.profile.role === "admin"
              ? `This will add the invoice to ${salesman?.name}'s invoice list.`
              : `This invoice will be sent for admin verification before it updates ${salesman?.name}'s balance.`}
        </p>
      </Modal>
    </>
  );
}

function StepTabs({
  step,
  onStepChange,
}: {
  step: BuilderStep;
  onStepChange: (step: BuilderStep) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
      <button
        type="button"
        onClick={() => onStepChange(1)}
        className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none ${
          step === 1
            ? "bg-sidebar font-medium"
            : "text-muted hover:text-foreground"
        }`}
      >
        1 · Items
      </button>
      <button
        type="button"
        onClick={() => onStepChange(2)}
        className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none ${
          step === 2
            ? "bg-sidebar font-medium"
            : "text-muted hover:text-foreground"
        }`}
      >
        2 · Payments
      </button>
    </div>
  );
}
