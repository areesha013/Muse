// "Pastel Flowers Sticker Sheet!" -> "pastel-flowers-sticker-sheet" (the web address of a product)
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s || "item";
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "1,500" or "Rs 1500.50" -> 1500.5. Returns null if it is not a number. */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/rs\.?/i, "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}
