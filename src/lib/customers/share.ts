import type { Salesman } from "@/lib/salesmen/types";

export function formatCustomerAddressLines(customer: {
  addressBuilding: string;
  addressArea: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
}): string[] {
  const lines: string[] = [];
  const building = customer.addressBuilding.trim();
  const area = customer.addressArea.trim();
  if (building || area) {
    lines.push([building, area].filter(Boolean).join(", "));
  }
  const cityLine = [
    customer.addressCity.trim(),
    customer.addressState.trim(),
    customer.addressPincode.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
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

/** Parse "lat,lng" or common Google Maps URL forms into coordinates. */
export function parseMapPinInput(raw: string): {
  lat: number;
  lng: number;
} | null {
  const text = raw.trim();
  if (!text) return null;

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
    | "addressBuilding"
    | "addressArea"
    | "addressCity"
    | "addressState"
    | "addressPincode"
    | "mapLat"
    | "mapLng"
  >,
  opts?: { toPhone?: string },
): string {
  const addressLines = formatCustomerAddressLines(customer);
  const mapsUrl = buildGoogleMapsUrl({
    lat: customer.mapLat,
    lng: customer.mapLng,
    addressLines,
  });

  const lines = [
    `*${customer.name.trim() || "Customer"}*`,
  ];
  if (customer.contactName.trim()) {
    lines.push(`Contact: ${customer.contactName.trim()}`);
  }
  if (customer.phone.trim()) {
    lines.push(`Phone: ${customer.phone.trim()}`);
  }
  if (customer.alternatePhone.trim()) {
    lines.push(`Alt phone: ${customer.alternatePhone.trim()}`);
  }
  if (addressLines.length > 0) {
    lines.push("", "Address:", ...addressLines);
  }
  if (mapsUrl) {
    lines.push("", `Map: ${mapsUrl}`);
  }

  const text = lines.join("\n");
  const target = (opts?.toPhone ?? customer.phone).replace(/\D/g, "");
  if (target) {
    return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
