import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/price-list/api-helpers";
import {
  isGoogleMapsUrl,
  parseMapPinInput,
  resolveGoogleMapsUrl,
} from "@/lib/customers/share";

export async function POST(request: Request) {
  const auth = await getAuthedProfile();
  if ("error" in auth && auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url =
    body && typeof body === "object" && "url" in body
      ? String(body.url ?? "").trim()
      : "";
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }
  if (!isGoogleMapsUrl(url)) {
    return NextResponse.json(
      { error: "Only Google Maps links are supported" },
      { status: 400 },
    );
  }

  const direct = parseMapPinInput(url);
  if (direct) {
    return NextResponse.json(direct);
  }

  const resolved = await resolveGoogleMapsUrl(url);
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "Could not read coordinates from that link. Try copying the plus code instead.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json(resolved);
}
