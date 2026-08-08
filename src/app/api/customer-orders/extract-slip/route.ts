import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import { extractOrderSlipFromImage } from "@/lib/customer-orders/ocr-extract";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const mimeType = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, or WebP images are allowed" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 10MB or smaller" },
      { status: 400 },
    );
  }

  try {
    const { extraction, raw } = await extractOrderSlipFromImage(
      buffer,
      mimeType,
    );
    return NextResponse.json({ extraction, raw });
  } catch (e) {
    console.error("extract-slip failed:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to extract order from image",
      },
      { status: 500 },
    );
  }
}
