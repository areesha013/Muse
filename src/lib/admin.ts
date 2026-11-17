import { createClient } from "@/lib/supabase/server";
import { getViewer, type Viewer } from "@/lib/auth";
import { parseDbError } from "@/lib/orders";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; message: string };

// Every admin server action starts with this. It runs the check again on the
// server, because the browser can call an action directly without opening the page.
// All reads and writes then go through the logged-in user, so the database's
// Row Level Security is a second lock: a non-admin is refused there too.
export async function getAdminContext(): Promise<{ supabase: ReturnType<typeof createClient>; viewer: Viewer } | null> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return null;
  return { supabase: createClient(), viewer };
}

export const NOT_ADMIN: ActionResult = { ok: false, message: "You need to be logged in as an admin to do this." };

// Database errors look like "BAD_TRANSITION:An order that is ...". The part after the colon is written for people.
export function dbMessage(error: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again."): string {
  const { code, detail } = parseDbError(error?.message);
  if (code !== "UNKNOWN" && detail) return detail;
  const m = (error?.message ?? "").toLowerCase();
  if (m.includes("row-level security") || m.includes("permission denied")) return "You do not have permission to do this.";
  if (m.includes("duplicate key") && m.includes("slug")) return "That web address (slug) is already used by another item. Change it.";
  if (m.includes("duplicate key") && m.includes("sku")) return "That SKU is already used by another variant.";
  if (m.includes("duplicate key")) return "That already exists.";
  if (m.includes("check constraint") && m.includes("stock")) return "Stock cannot be below zero.";
  if (error?.message) console.error("[admin]", error.message);
  return fallback;
}
