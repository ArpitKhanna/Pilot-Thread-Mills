import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CustomerOrderLineUnit } from "@/lib/customer-orders/types";

const UNITS: CustomerOrderLineUnit[] = ["box", "dibbi", "cone", "unit"];

export type ExtractedOrderLine = {
  itemName: string | null;
  shadeCode: string;
  qty: number;
  unit: CustomerOrderLineUnit;
};

export type ExtractedOrderSlip = {
  customerName: string | null;
  customerPhone: string | null;
  orderDate: string | null;
  notes: string | null;
  isUrgent: boolean;
  lines: ExtractedOrderLine[];
};

function normalizeUnit(raw: unknown): CustomerOrderLineUnit {
  const value = String(raw ?? "box")
    .trim()
    .toLowerCase();
  if (UNITS.includes(value as CustomerOrderLineUnit)) {
    return value as CustomerOrderLineUnit;
  }
  if (value.includes("dibbi") || value.includes("dibi")) return "dibbi";
  if (value.includes("cone")) return "cone";
  if (value.includes("unit") || value.includes("pcs") || value.includes("pc")) {
    return "unit";
  }
  return "box";
}

function normalizeLine(raw: unknown): ExtractedOrderLine | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const shadeCode = String(row.shadeCode ?? row.shade ?? "").trim();
  if (!shadeCode) return null;
  const qtyRaw = Number(row.qty ?? row.quantity ?? 1);
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
  const itemNameRaw = String(row.itemName ?? row.item ?? "").trim();
  return {
    itemName: itemNameRaw || null,
    shadeCode,
    qty,
    unit: normalizeUnit(row.unit),
  };
}

function parseExtractionPayload(text: string): ExtractedOrderSlip {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Could not parse extraction response");
    }
    parsed = JSON.parse(match[0]) as unknown;
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid extraction response");
  }

  const row = parsed as Record<string, unknown>;
  const rawLines = Array.isArray(row.lines) ? row.lines : [];
  const lines = rawLines
    .map(normalizeLine)
    .filter((line): line is ExtractedOrderLine => line !== null);

  const customerName = String(row.customerName ?? row.customer ?? "").trim();
  const customerPhone = String(row.customerPhone ?? row.phone ?? "").trim();
  const orderDate = String(row.orderDate ?? row.date ?? "").trim();
  const notes = String(row.notes ?? "").trim();

  return {
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    orderDate: orderDate || null,
    notes: notes || null,
    isUrgent: Boolean(row.isUrgent),
    lines,
  };
}

export async function extractOrderSlipFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ extraction: ExtractedOrderSlip; raw: unknown }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const prompt = `You are reading a handwritten or printed order slip from an Indian textile/thread mill.

Extract order details into JSON with this exact shape:
{
  "customerName": string | null,
  "customerPhone": string | null,
  "orderDate": "YYYY-MM-DD" | null,
  "notes": string | null,
  "isUrgent": boolean,
  "lines": [{ "itemName": string | null, "shadeCode": string, "qty": number, "unit": "box"|"dibbi"|"cone"|"unit" }]
}

Rules:
- customerName: shop or customer name if visible
- customerPhone: phone number if visible (digits only, no country code prefix unless printed)
- orderDate: ISO date YYYY-MM-DD if visible, else null
- notes: any extra instructions not captured in line items
- isUrgent: true only if explicitly marked urgent/rush
- lines: each row on the slip with shadeCode (required), qty (number), unit (box|dibbi|cone|unit), itemName if listed
- Common units: box, dibbi (small pack), cone, unit/pcs
- Ignore blank rows; combine duplicate shade codes if repeated
- If unreadable, return best guess with empty lines array only if nothing is legible`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: buffer.toString("base64"),
      },
    },
  ]);

  const text = result.response.text();
  const extraction = parseExtractionPayload(text);

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    raw = { text, extraction };
  }

  return { extraction, raw };
}
