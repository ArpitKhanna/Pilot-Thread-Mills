import { NextResponse } from "next/server";
import type { PriceListItem } from "@/lib/auth/types";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  mapOcrPayloadToSuggestions,
  runVisionOcr,
} from "@/lib/customer-orders/ocr";
import {
  CUSTOMER_ORDER_FILES_BUCKET,
  getCustomerOrder,
} from "@/lib/customer-orders/queries";

export async function POST(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OCR is not configured. Set OPENAI_API_KEY to enable Suggest from image.",
      },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const attachmentId = String(body.attachmentId ?? "").trim();
  const orderId = String(body.orderId ?? "").trim();
  if (!attachmentId || !orderId) {
    return NextResponse.json(
      { error: "orderId and attachmentId are required" },
      { status: 400 },
    );
  }

  const order = await getCustomerOrder(supabase, orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const attachment = order.attachments.find((a) => a.id === attachmentId);
  if (!attachment) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 },
    );
  }
  if (attachment.kind !== "order_slip") {
    return NextResponse.json(
      { error: "OCR only runs on order slip images" },
      { status: 400 },
    );
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(CUSTOMER_ORDER_FILES_BUCKET)
    .download(attachment.storagePath);
  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: downloadError?.message ?? "Failed to download image" },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const mimeType =
    attachment.contentType || fileData.type || "image/jpeg";

  const { data: priceList, error: priceError } = await supabase
    .from("price_list_items")
    .select("id, item_name")
    .eq("status", "approved");
  if (priceError) {
    return NextResponse.json({ error: priceError.message }, { status: 500 });
  }

  try {
    const raw = await runVisionOcr({
      imageBase64: buffer.toString("base64"),
      mimeType,
      apiKey,
    });

    await supabase
      .from("customer_order_attachments")
      .update({ ocr_raw_json: raw })
      .eq("id", attachmentId);

    const suggestion = mapOcrPayloadToSuggestions(
      raw,
      (priceList ?? []) as Pick<PriceListItem, "id" | "item_name">[],
    );

    return NextResponse.json({ suggestion });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OCR failed" },
      { status: 500 },
    );
  }
}
