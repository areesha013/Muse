import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Never let Next.js cache database calls made for a specific person or order.
// Without this, a customer could see an old order status after you change it.
const noStore: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

// For Server Components, server actions and route handlers.
// Acts as the logged-in user, so Row Level Security applies.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: noStore },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component: safe to ignore, middleware refreshes the session.
          }
        },
      },
    }
  );
}

// Bypasses Row Level Security. SERVER ONLY, for trusted tasks such as
// guest checkout and order tracking. Never import this in client code.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: noStore } }
  );
}
