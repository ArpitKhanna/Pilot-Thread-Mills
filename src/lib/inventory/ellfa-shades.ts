export const ELLFA_270_ITEM_NAME = "Ellfa 270 Mtr.";

export const NAMED_SHADE_CODES = [
  "BLACK",
  "WHITE",
  "CREAM",
  "HALFWHITE",
] as const;

export const SHADES_PER_COLUMN = 24;
export const NAMED_SHADES_COLUMN = 40;
export const NUMERIC_SHADE_MAX = 936;

export function cardLayoutForNumericShade(shadeNum: number): {
  cardColumn: number;
  cardRow: number;
} {
  if (shadeNum < 1 || shadeNum > NUMERIC_SHADE_MAX) {
    throw new Error(`Shade number must be 1–${NUMERIC_SHADE_MAX}`);
  }
  return {
    cardColumn: Math.floor((shadeNum - 1) / SHADES_PER_COLUMN) + 1,
    cardRow: ((shadeNum - 1) % SHADES_PER_COLUMN) + 1,
  };
}

export function isNamedShadeCode(code: string): boolean {
  return (NAMED_SHADE_CODES as readonly string[]).includes(
    code.trim().toUpperCase().replace(/\s+/g, ""),
  );
}
