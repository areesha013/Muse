// Turns the many ways people type a Pakistani mobile number into one form: 03XXXXXXXXX.
// Returns null when it isn't a valid mobile number.
export function normalizePkPhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92") && d.length === 12) d = d.slice(2);
  if (/^3\d{9}$/.test(d)) d = `0${d}`;
  return /^03\d{9}$/.test(d) ? d : null;
}

// "1005", "ord-1005", "#ORD 1005" -> "ORD-1005". Returns null if it doesn't look like an order number.
export function normalizeOrderNumber(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = s.match(/^(?:ORD)?(\d{3,9})$/);
  return m ? `ORD-${m[1]}` : null;
}
