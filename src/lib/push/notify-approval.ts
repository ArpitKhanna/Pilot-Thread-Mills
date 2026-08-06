import { formatINR } from "@/lib/salesmen/mock-data";
import { sendApprovalPush } from "./send";

function queueApprovalPush(input: Parameters<typeof sendApprovalPush>[0]) {
  void sendApprovalPush(input).catch((error) => {
    console.error("Approval push notification failed:", error);
  });
}

export function notifyInvoiceApprovalPending(input: {
  invoiceId: string;
  invoiceNumber: string;
  salesmanName: string;
  totalAmount: number;
  createdByUserId: string;
}) {
  queueApprovalPush({
    kind: "invoice",
    entityId: input.invoiceId,
    excludeUserId: input.createdByUserId,
    title: "Invoice needs approval",
    body: `${input.invoiceNumber} · ${input.salesmanName} · ${formatINR(input.totalAmount)}`,
  });
}

export function notifyAdvanceApprovalPending(input: {
  advanceId: string;
  salesmanName: string;
  amount: number;
  createdByUserId: string;
}) {
  queueApprovalPush({
    kind: "advance",
    entityId: input.advanceId,
    excludeUserId: input.createdByUserId,
    title: "Advance needs approval",
    body: `${input.salesmanName} · ${formatINR(input.amount)}`,
  });
}

export function notifyReturnApprovalPending(input: {
  returnId: string;
  salesmanName: string;
  totalAmount: number;
  createdByUserId: string;
}) {
  queueApprovalPush({
    kind: "return",
    entityId: input.returnId,
    excludeUserId: input.createdByUserId,
    title: "Return needs approval",
    body: `${input.salesmanName} · ${formatINR(input.totalAmount)}`,
  });
}

export function notifyPriceListApprovalPending(input: {
  itemId: string;
  itemName: string;
  submittedByName: string;
  createdByUserId: string;
}) {
  queueApprovalPush({
    kind: "price_list",
    entityId: input.itemId,
    excludeUserId: input.createdByUserId,
    title: "Price list needs approval",
    body: `${input.itemName} · submitted by ${input.submittedByName}`,
  });
}
