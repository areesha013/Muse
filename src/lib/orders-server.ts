import { createAdminClient } from "@/lib/supabase/server";
import type { OrderView } from "@/lib/orders";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Loads an order for the private /order/<token> page. Returns null if not found.
export async function getOrderByToken(token: string): Promise<OrderView | null> {
  if (!UUID.test(token)) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { data, error } = await createAdminClient().rpc("get_order_by_token", { p_token: token });
    if (error) {
      console.error("[order page]", error.message);
      return null;
    }
    return (data as OrderView) ?? null;
  } catch (e) {
    console.error("[order page] failed:", e);
    return null;
  }
}
