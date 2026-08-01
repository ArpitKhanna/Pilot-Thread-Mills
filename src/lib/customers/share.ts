import { decode as decodePlusCode, encode as encodePlusCode } from "open-location-code";
import type { Salesman } from "@/lib/salesmen/types";

const PLUS_CODE_PATTERN =
  /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i;

export function formatCustomerAddressLines(customer: {
  addressArea: string;
}): string[] {
  const area = customer.addressArea.trim();
  return area ? [area] : [];
}

/** Full-length plus code for display (e.g. 7JVW52HG+2Q). */
export function formatPlusCode(lat: number, lng: number): string {
  return encodePlusCode(lat, lng);
}

function extractPlusCode(text: string): string | null {
  const match = text.match(PLUS_CODE_PATTERN);
  return match ? match[0].toUpperCase() : null;
}

function parsePlusCodeInput(text: string): { lat: number; lng: number } | null {
  const code = extractPlusCode(text);
  if (!code) return null;
  try {
    const decoded = decodePlusCode(code);
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

/** Parse plus code, "lat,lng", or common Google Maps URL forms into coordinates. */
export function parseMapPinInput(raw: string): {
  lat: number;
  lng: number;
} | null {
  const text = raw.trim();
  if (!text) return null;

  const fromPlusCode = parsePlusCodeInput(text);
  if (fromPlusCode) return fromPlusCode;

  const pair = text.match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }

  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }

  const qMatch = text.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (qMatch) {
    const lat = Number(qMatch[1]);
    const lng = Number(qMatch[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }

  const llMatch = text.match(
    /[?&](?:ll|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  );
  if (llMatch) {
    const lat = Number(llMatch[1]);
    const lng = Number(llMatch[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }

  return null;
}

export function buildCustomerWhatsAppShareUrl(
  customer: Pick<
    Salesman,
    | "name"
    | "contactName"
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
    `Customer Name: ${customer.contactName.trim() || "—"}`,
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
