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
  const pinUrl =
    customer.mapLat != null &&
    customer.mapLng != null &&
    Number.isFinite(customer.mapLat) &&
    Number.isFinite(customer.mapLng)
      ? `https://www.google.com/maps?q=${customer.mapLat},${customer.mapLng}`
      : null;

  const lines = [
    `Shop Name: ${customer.name.trim() || "—"}`,
    `Customer Name: ${customer.contactName.trim() || "—"}`,
    `Phone Number: ${customer.phone.trim() || "—"}`,
    `Alternate Phone Number: ${customer.alternatePhone.trim() || "—"}`,
  ];

  if (addressLines.length > 0) {
    lines.push(`Address: ${addressLines.join(", ")}`);
  } else {
    lines.push("Address: —");
  }

  lines.push(`Google Pin: ${pinUrl ?? "—"}`);

  const text = lines.join("\n");
  const target = (opts?.toPhone ?? "").replace(/\D/g, "");
  if (target) {
    return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
  }
  // Open WhatsApp without a fixed recipient so staff can choose who to send to
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
