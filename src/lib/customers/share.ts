import { OpenLocationCode } from "open-location-code";
import type { Salesman } from "@/lib/salesmen/types";

const openLocationCode = new OpenLocationCode();

const PLUS_CODE_PATTERN =
  /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i;

export function isValidMapCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function formatCustomerAddressLines(customer: {
  addressArea: string;
}): string[] {
  const area = customer.addressArea.trim();
  return area ? [area] : [];
}

/** Full-length plus code for display (e.g. 7JVW52HG+2Q). Returns null if encoding fails. */
export function formatPlusCode(lat: number, lng: number): string | null {
  if (!isValidMapCoordinate(lat, lng)) return null;
  try {
    return openLocationCode.encode(lat, lng);
  } catch {
    return null;
  }
}

function extractPlusCode(text: string): string | null {
  const match = text.match(PLUS_CODE_PATTERN);
  return match ? match[0].toUpperCase() : null;
}

function parsePlusCodeInput(text: string): { lat: number; lng: number } | null {
  const code = extractPlusCode(text);
  if (!code) return null;
  try {
    const decoded = openLocationCode.decode(code);
    if (
      !Number.isFinite(decoded.latitudeCenter) ||
      !Number.isFinite(decoded.longitudeCenter)
    ) {
      return null;
    }
    return { lat: decoded.latitudeCenter, lng: decoded.longitudeCenter };
  } catch {
    return null;
  }
}

export function buildGoogleMapsUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  addressLines?: string[];
}): string | null {
  if (
    opts.lat != null &&
    opts.lng != null &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng)
  ) {
    return `https://www.google.com/maps?q=${opts.lat},${opts.lng}`;
  }
  const query = (opts.addressLines ?? []).join(", ").trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function isGoogleMapsUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^(https?:\/\/)?((maps\.app\.)?goo\.gl\/|(www\.)?google\.com\/maps|maps\.google\.com|g\.co\/)/i.test(
    trimmed,
  );
}

function normalizeMapPinText(raw: string): string {
  const trimmed = raw.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function parseCoordinatePair(
  latRaw: string,
  lngRaw: string,
): { lat: number; lng: number } | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function extractCoordinatesFromText(text: string): {
  lat: number;
  lng: number;
} | null {
  const placeMatch = text.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
  );
  if (placeMatch) {
    const parsed = parseCoordinatePair(placeMatch[1], placeMatch[2]);
    if (parsed) return parsed;
  }

  const queryParamMatch = text.match(
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)[,%2C\s]+(-?\d+(?:\.\d+)?)/i,
  );
  if (queryParamMatch) {
    const parsed = parseCoordinatePair(queryParamMatch[1], queryParamMatch[2]);
    if (parsed) return parsed;
  }

  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const parsed = parseCoordinatePair(atMatch[1], atMatch[2]);
    if (parsed) return parsed;
  }

  return null;
}

/** Parse plus code, "lat,lng", or common Google Maps URL forms into coordinates. */
export function parseMapPinInput(raw: string): {
  lat: number;
  lng: number;
} | null {
  const text = normalizeMapPinText(raw);
  if (!text) return null;

  const fromUrl = extractCoordinatesFromText(text);
  if (fromUrl) return fromUrl;

  const pair = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (pair) {
    const parsed = parseCoordinatePair(pair[1], pair[2]);
    if (parsed) return parsed;
  }

  const fromPlusCode = parsePlusCodeInput(text);
  if (fromPlusCode) return fromPlusCode;

  return null;
}

/** Follow Google Maps short-link redirects and extract coordinates. */
export async function resolveGoogleMapsUrl(
  url: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = url.trim();
  if (!isGoogleMapsUrl(trimmed)) return null;

  const direct = parseMapPinInput(trimmed);
  if (direct) return direct;

  try {
    const response = await fetch(trimmed, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PilotThreadMills/1.0; +https://pilot-thread-mills.vercel.app)",
      },
    });
    return parseMapPinInput(response.url);
  } catch {
    return null;
  }
}

export function buildCustomerWhatsAppShareUrl(
  customer: Pick<
    Salesman,
    | "name"
    | "phone"
    | "alternatePhone"
    | "addressArea"
    | "mapLat"
    | "mapLng"
  >,
  opts?: { toPhone?: string },
): string {
  const addressLines = formatCustomerAddressLines(customer);
  const hasPin =
    customer.mapLat != null &&
    customer.mapLng != null &&
    Number.isFinite(customer.mapLat) &&
    Number.isFinite(customer.mapLng);
  const pinUrl = hasPin
    ? buildGoogleMapsUrl({
        lat: customer.mapLat,
        lng: customer.mapLng,
      })
    : null;
  const plusCode =
    hasPin && customer.mapLat != null && customer.mapLng != null
      ? formatPlusCode(customer.mapLat, customer.mapLng)
      : null;

  const lines = [
    `Shop Name: ${customer.name.trim() || "—"}`,
    `Phone Number: ${customer.phone.trim() || "—"}`,
    `Alternate Phone Number: ${customer.alternatePhone.trim() || "—"}`,
  ];

  if (addressLines.length > 0) {
    lines.push(`Area: ${addressLines.join(", ")}`);
  } else {
    lines.push("Area: —");
  }

  lines.push(`Location: ${pinUrl ?? "—"}`);
  if (plusCode) {
    lines.push(`Plus code: ${plusCode}`);
  }

  const text = lines.join("\n");
  const target = (opts?.toPhone ?? "").replace(/\D/g, "");
  if (target) {
    return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  }
  // Open WhatsApp without a fixed recipient so staff can choose who to send to
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
