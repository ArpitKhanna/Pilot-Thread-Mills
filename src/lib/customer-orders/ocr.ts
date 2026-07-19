import type { PriceListItem } from "@/lib/auth/types";
import type {
  CustomerOrderLineUnit,
  OcrSuggestResult,
  OcrSuggestedColumn,
} from "./types";

type PriceListMatch = Pick<PriceListItem, "id" | "item_name">;

function normalizeHint(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Map common handwritten / spoken product aliases to catalog names */
const HINT_ALIASES: Record<string, string[]> = {
  "per poly": ["pen poly", "needle poly", "per poly"],
  "pen poly": ["pen poly"],
  "needle poly": ["needle poly"],
  elfa: ["ellfa", "elfa"],
  ellfa: ["ellfa", "elfa"],
  eufa: ["ellfa", "elfa"],
};

export function matchPriceListItem(
  itemHint: string,
  priceList: PriceListMatch[],
): PriceListMatch | null {
  const hint = normalizeHint(itemHint);
  if (!hint) return null;

  const aliasTargets = HINT_ALIASES[hint] ?? [hint];

  let best: { item: PriceListMatch; score: number } | null = null;

  for (const item of priceList) {
    const name = normalizeHint(item.item_name);
    for (const target of aliasTargets) {
      let score = 0;
      if (name === target) score = 100;
      else if (name.includes(target)) score = 80;
      else if (target.includes(name) && name.length >= 4) score = 60;
      else {
        const tokens = target.split(" ").filter(Boolean);
        const hit = tokens.filter((t) => name.includes(t)).length;
        if (hit > 0) score = (hit / tokens.length) * 50;
      }
      if (!best || score > best.score) {
        best = { item, score };
      }
    }
  }

  if (!best || best.score < 40) return null;
  return best.item;
}

function parseUnit(raw: unknown): CustomerOrderLineUnit {
  const value = String(raw ?? "box").toLowerCase();
  if (value === "dibbi" || value === "cone" || value === "unit") return value;
  return "box";
}

type RawOcrPayload = {
  columns?: Array<{
    itemHint?: string;
    item_hint?: string;
    lines?: Array<{
      shadeCode?: string;
      shade_code?: string;
      qty?: number | string;
      unit?: string;
    }>;
  }>;
};

export function mapOcrPayloadToSuggestions(
  raw: unknown,
  priceList: PriceListMatch[],
): OcrSuggestResult {
  const payload = (raw ?? {}) as RawOcrPayload;
  const columns: OcrSuggestedColumn[] = [];

  for (const col of payload.columns ?? []) {
    const itemHint = String(col.itemHint ?? col.item_hint ?? "").trim();
    if (!itemHint) continue;
    const matched = matchPriceListItem(itemHint, priceList);
    const lines = (col.lines ?? [])
      .map((line) => {
        const shadeCode = String(line.shadeCode ?? line.shade_code ?? "").trim();
        const qty = Number(line.qty ?? 1);
        if (!shadeCode) return null;
        return {
          shadeCode,
          qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
          unit: parseUnit(line.unit),
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    columns.push({
      itemHint,
      priceListItemId: matched?.id ?? null,
      itemName: matched?.item_name ?? null,
      lines,
    });
  }

  return { columns, raw };
}

const OCR_SYSTEM_PROMPT = `You extract textile thread order slips from photos of handwritten notebooks or WhatsApp images.
The page usually has columns separated by a vertical line. Each column has a product/brand heading (e.g. "Per Poly", "ELFA", "Ellfa") and a vertical list of shade codes under it.
Shade codes look like "Y-3167", "511", "1109". Quantity may appear as "380 - 2 Box" meaning shade 380 qty 2 boxes. If qty is missing, use 1 and unit "box".
Return ONLY valid JSON with this shape:
{
  "columns": [
    {
      "itemHint": "string from the column header",
      "lines": [
        { "shadeCode": "string", "qty": number, "unit": "box" }
      ]
    }
  ]
}
Do not invent shades that are not visible. Prefer reading ambiguous digits carefully.`;

export async function runVisionOcr(params: {
  imageBase64: string;
  mimeType: string;
  apiKey: string;
}): Promise<unknown> {
  const { imageBase64, mimeType, apiKey } = params;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL || "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the order columns and shade lines from this image.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR provider error: ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OCR returned empty content");

  return JSON.parse(content) as unknown;
}
