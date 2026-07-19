import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  createCustomerOrder,
  listCustomerOrders,
} from "@/lib/customer-orders/queries";
import { getSalesman } from "@/lib/salesmen/queries";

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "customer";
}

async function allocateCustomerId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  name: string,
): Promise<string> {
  const base = `sm-${slugifyName(name)}`;
  if (!(await getSalesman(supabase, base))) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!(await getSalesman(supabase, candidate))) return candidate;
  }
  return `sm-${crypto.randomUUID().slice(0, 8)}`;
}

export async function GET() {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  try {
    const orders = await listCustomerOrders(supabase);
    return NextResponse.json({ orders });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list orders" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let customerId = String(body.customerId ?? "").trim();
  const createCustomer = body.createCustomer as
    | { name?: string; phone?: string; alternatePhone?: string }
    | undefined;

  if (!customerId && createCustomer?.name) {
    const name = String(createCustomer.name).trim();
    const id = await allocateCustomerId(supabase, name);
    const { error: insertError } = await supabase.from("salesmen").insert({
      id,
      name,
      phone: String(createCustomer.phone ?? "").trim(),
      alternate_phone: createCustomer.alternatePhone
        ? String(createCustomer.alternatePhone).trim()
        : "",
      entity_type: "customer",
      category: "Customer",
      is_active: true,
      pending_balance: 0,
      last_invoice_at: null,
      discount_rules: [],
    });
    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }
    customerId = id;
  }

  if (!customerId) {
    return NextResponse.json(
      { error: "Customer is required" },
      { status: 400 },
    );
  }

  const { data: customer, error: customerError } = await supabase
    .from("salesmen")
    .select("id, entity_type, is_active")
    .eq("id", customerId)
    .maybeSingle();
  if (customerError) {
    return NextResponse.json({ error: customerError.message }, { status: 500 });
  }
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  if (customer.entity_type !== "customer") {
    return NextResponse.json(
      { error: "Selected party is not a customer" },
      { status: 400 },
    );
  }

  try {
    const order = await createCustomerOrder(supabase, {
      customerId,
      orderDate: body.orderDate ? String(body.orderDate) : undefined,
      notes: body.notes != null ? String(body.notes) : null,
      createdBy: profile.id,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create order" },
      { status: 500 },
    );
  }
}
