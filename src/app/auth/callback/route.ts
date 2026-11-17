import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

// The links in Supabase emails (confirm your email, reset your password) land here.
// We swap the one-time code for a login session, then send the person on.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"), "/account");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  try {
    const supabase = createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
      console.warn("[auth/callback] code exchange failed:", error.message);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, origin));
      console.warn("[auth/callback] token check failed:", error.message);
    }
  } catch (e) {
    console.error("[auth/callback]", e instanceof Error ? e.message : e);
  }
  return NextResponse.redirect(new URL("/login?notice=link", origin));
}
