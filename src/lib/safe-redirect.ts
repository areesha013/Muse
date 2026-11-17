// Only allow going to a page on THIS site after login. Blocks things like
// "//evil.com", "https://evil.com" or "/\evil.com" (open-redirect trick).
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
