import { createClient } from "@supabase/supabase-js";

// Cookie-free client for public pages (home, shop, product).
// Because it doesn't read cookies, Next.js can cache these pages and refresh
// them every 60 seconds, which keeps the site fast.
// Returns null when the Supabase keys are missing, so the site still starts.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 60 } }),
    },
  });
}
