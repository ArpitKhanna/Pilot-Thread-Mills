import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  addOrderAttachment,
  CUSTOMER_ORDER_FILES_BUCKET,
  deleteOrderAttachment,
  getCustomerOrder,
} from "@/lib/customer-orders/queries";
import type { CustomerOrderAttachmentKind } from "@/lib/customer-orders/types";

type RouteContext = { params: Promise<{ id: string }> };

const KINDS: CustomerOrderAttachmentKind[] = ["order_slip", "cloth_patch"];

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  const order = await getCustomerOrder(supabase, id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "order_slip");
  const kind = kindRaw as CustomerOrderAttachmentKind;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only images or PDF are allowed" },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const storagePath = `${id}/${kind}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(CUSTOMER_ORDER_FILES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error(uploadError);
    return NextResponse.json(
      { error: uploadError.message || "Upload failed" },
      { status: 500 },
    );
  }

  try {
    const attachment = await addOrderAttachment(supabase, {
      orderId: id,
      kind,
      storagePath,
      fileName: file.name,
      contentType: file.type,
      sortOrder: order.attachments.length,
    });
    const refreshed = await getCustomerOrder(supabase, id);
    return NextResponse.json(
      { attachment, order: refreshed },
      { status: 201 },
    );
  } catch (e) {
    await supabase.storage.from(CUSTOMER_ORDER_FILES_BUCKET).remove([storagePath]);
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save attachment" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;
  const { id } = await context.params;

  const url = new URL(request.url);
  const attachmentId = url.searchParams.get("attachmentId");
  if (!attachmentId) {
    return NextResponse.json(
      { error: "attachmentId is required" },
      { status: 400 },
    );
  }

  const order = await getCustomerOrder(supabase, id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!order.attachments.some((a) => a.id === attachmentId)) {
    return NextResponse.json(
      { error: "Attachment not found on this order" },
      { status: 404 },
    );
  }

  try {
    await deleteOrderAttachment(supabase, attachmentId);
    const refreshed = await getCustomerOrder(supabase, id);
    return NextResponse.json({ order: refreshed });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete attachment" },
      { status: 500 },
    );
  }
}
