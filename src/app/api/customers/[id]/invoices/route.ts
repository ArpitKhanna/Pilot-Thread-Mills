import { NextResponse } from "next/server";
import { createDirectCustomerInvoice } from "@/lib/customers/create-invoice";
import { requireEntityOrOrderCustomersAccess } from "@/lib/customer-orders/access";
import { validateInvoicePayload } from "@/lib/salesmen/invoice-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireEntityOrOrderCustomersAccess();
  if ("error" in auth) return auth.error;

  const { id: customerId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  body.salesmanId = customerId;

  const validated = validateInvoicePayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const invoice = await createDirectCustomerInvoice(
      auth.supabase,
      auth.profile,
      customerId,
      validated.data,
    );
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create invoice";
    const status = message === "Customer not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
