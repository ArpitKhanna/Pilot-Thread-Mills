import { NextResponse } from "next/server";
import {
  isAuthError,
  requireOrderCustomersAccess,
} from "@/lib/customer-orders/access";
import {
  createSignedUrl,
  CUSTOMER_ORDER_FILES_BUCKET,
  findOrCreateShade,
  listShadesForItem,
} from "@/lib/customer-orders/queries";

export async function GET(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const url = new URL(request.url);
  const priceListItemId = url.searchParams.get("priceListItemId");
  if (!priceListItemId) {
    return NextResponse.json(
      { error: "priceListItemId is required" },
      { status: 400 },
    );
  }

  try {
    const shades = await listShadesForItem(supabase, priceListItemId);
    const withUrls = await Promise.all(
      shades.map(async (shade) => ({
        ...shade,
        patchUrl: shade.patchStoragePath
          ? await createSignedUrl(supabase, shade.patchStoragePath)
          : null,
      })),
    );
    return NextResponse.json({ shades: withUrls });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list shades" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOrderCustomersAccess();
  if (isAuthError(auth)) return auth.error;
  const { supabase } = auth;

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const priceListItemId = String(form.get("priceListItemId") ?? "").trim();
      const shadeCode = String(form.get("shadeCode") ?? "").trim();
      const colorLabel = form.get("colorLabel");
      const colorHex = form.get("colorHex");
      const file = form.get("patch");

      if (!priceListItemId || !shadeCode) {
        return NextResponse.json(
          { error: "priceListItemId and shadeCode are required" },
          { status: 400 },
        );
      }

      let patchStoragePath: string | null = null;
      if (file instanceof File && file.size > 0) {
        if (!file.type.startsWith("image/")) {
          return NextResponse.json(
            { error: "Patch must be an image" },
            { status: 400 },
          );
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        patchStoragePath = `shades/${priceListItemId}/${crypto.randomUUID()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from(CUSTOMER_ORDER_FILES_BUCKET)
          .upload(patchStoragePath, buffer, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) {
          return NextResponse.json(
            { error: uploadError.message },
            { status: 500 },
          );
        }
      }

      const shade = await findOrCreateShade(supabase, {
        priceListItemId,
        shadeCode,
        colorLabel:
          colorLabel != null && String(colorLabel).trim()
            ? String(colorLabel).trim()
            : null,
        colorHex:
          colorHex != null && String(colorHex).trim()
            ? String(colorHex).trim()
            : null,
        patchStoragePath: patchStoragePath ?? undefined,
      });

      return NextResponse.json(
        {
          shade: {
            ...shade,
            patchUrl: shade.patchStoragePath
              ? await createSignedUrl(supabase, shade.patchStoragePath)
              : null,
          },
        },
        { status: 201 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const priceListItemId = String(body.priceListItemId ?? "").trim();
    const shadeCode = String(body.shadeCode ?? "").trim();
    if (!priceListItemId || !shadeCode) {
      return NextResponse.json(
        { error: "priceListItemId and shadeCode are required" },
        { status: 400 },
      );
    }

    const shade = await findOrCreateShade(supabase, {
      priceListItemId,
      shadeCode,
      colorLabel:
        body.colorLabel != null ? String(body.colorLabel) : undefined,
      colorHex: body.colorHex != null ? String(body.colorHex) : undefined,
      patchStoragePath:
        body.patchStoragePath != null
          ? String(body.patchStoragePath)
          : undefined,
    });

    return NextResponse.json({ shade }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save shade" },
      { status: 500 },
    );
  }
}
