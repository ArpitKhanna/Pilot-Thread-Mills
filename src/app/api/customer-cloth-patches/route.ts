import { NextResponse } from "next/server";
import {
  isAuthError,
  requireEntityOrOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  assignShadeToClothPatch,
  createClothPatch,
  deleteClothPatch,
  listClothPatchesForCustomer,
} from "@/lib/customer-orders/cloth-patches";
import { CUSTOMER_ORDER_FILES_BUCKET } from "@/lib/customer-orders/queries";

export async function GET(request: Request) {
  const auth = await requireEntityOrOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const customerId = new URL(request.url).searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json(
      { error: "customerId is required" },
      { status: 400 },
    );
  }

  try {
    const patches = await listClothPatchesForCustomer(supabase, customerId);
    return NextResponse.json({ patches });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list patches" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireEntityOrOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase, profile } = auth;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const customerId = String(form.get("customerId") ?? "").trim();
    const file = form.get("file");
    if (!customerId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "customerId and file are required" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `cloth-patches/${customerId}/${crypto.randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(CUSTOMER_ORDER_FILES_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    try {
      const patch = await createClothPatch(supabase, {
        customerId,
        storagePath,
        fileName: file.name,
        contentType: file.type || null,
        priceListItemId: form.get("priceListItemId")
          ? String(form.get("priceListItemId"))
          : null,
        notes: form.get("notes") ? String(form.get("notes")) : null,
        createdBy: profile.id,
      });
      return NextResponse.json({ patch }, { status: 201 });
    } catch (e) {
      await supabase.storage
        .from(CUSTOMER_ORDER_FILES_BUCKET)
        .remove([storagePath]);
      console.error(e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to save patch" },
        { status: 500 },
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action ?? "assign");
  if (action === "assign") {
    const patchId = String(body.patchId ?? "").trim();
    const shadeCode = String(body.shadeCode ?? "").trim();
    if (!patchId || !shadeCode) {
      return NextResponse.json(
        { error: "patchId and shadeCode are required" },
        { status: 400 },
      );
    }
    try {
      const patch = await assignShadeToClothPatch(supabase, {
        patchId,
        shadeCode,
        priceListItemId: body.priceListItemId
          ? String(body.priceListItemId)
          : null,
        notes: body.notes != null ? String(body.notes) : undefined,
      });
      return NextResponse.json({ patch });
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to assign shade" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const auth = await requireEntityOrOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const patchId = new URL(request.url).searchParams.get("id");
  if (!patchId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await deleteClothPatch(supabase, patchId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete patch" },
      { status: 400 },
    );
  }
}
