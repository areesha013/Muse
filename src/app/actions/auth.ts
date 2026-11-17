"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { normalizePkPhone } from "@/lib/phone";
import { verifyTurnstile } from "@/lib/turnstile";
import { siteUrl } from "@/lib/email";

export type AuthState = { ok: false; message: string; field?: string } | null;

const email = z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254);
const password = z.string().min(8, "Use at least 8 characters.").max(72, "That password is too long.");

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is wrong.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try logging in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Please wait a few minutes and try again.";
  if (m.includes("weak") || m.includes("password")) return "Please choose a stronger password.";
  return "Something went wrong. Please try again.";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsedEmail = email.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { ok: false, message: parsedEmail.error.issues[0].message, field: "email" };
  const pass = String(formData.get("password") ?? "");
  if (!pass) return { ok: false, message: "Please enter your password.", field: "password" };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail.data, password: pass });
  if (error) return { ok: false, message: friendly(error.message) };

  // Where to go: the page they came from, else the admin panel for admins, else their account.
  const next = safeNext(formData.get("next"), "");
  if (next) redirect(next);
  const { data } = await supabase.auth.getUser();
  const { data: profile } = data.user
    ? await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
    : { data: null };
  redirect(profile?.role === "admin" ? "/admin" : "/account");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (formData.get("website")) return { ok: false, message: "Something went wrong. Please try again." }; // bot trap

  const name = String(formData.get("full_name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, message: "Please enter your name.", field: "full_name" };
  const parsedEmail = email.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { ok: false, message: parsedEmail.error.issues[0].message, field: "email" };
  const parsedPass = password.safeParse(formData.get("password"));
  if (!parsedPass.success) return { ok: false, message: parsedPass.error.issues[0].message, field: "password" };
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePkPhone(rawPhone) : null;
  if (rawPhone && !phone) return { ok: false, message: "Please enter a Pakistani mobile number, like 0300 1234567.", field: "phone" };

  const captcha = await verifyTurnstile(formData.get("captcha"));
  if (!captcha.ok) return { ok: false, message: captcha.message };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsedEmail.data,
    password: parsedPass.data,
    options: {
      data: { full_name: name, phone },
      // The "confirm your email" link comes back here and logs the person in.
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/account`,
    },
  });
  if (error) return { ok: false, message: friendly(error.message) };

  // With "Confirm email" turned on in Supabase there is no session yet.
  if (!data.session) {
    redirect("/login?notice=confirm");
  }
  redirect(safeNext(formData.get("next"), "/account"));
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------- Forgot / reset password ----------

export type ResetState = { ok: boolean; message: string; field?: string } | null;

// Always gives the same answer, so nobody can use this form to find out who has an account.
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const same: ResetState = {
    ok: true,
    message: "If there is an account with that email, we have sent a link to choose a new password. It can take a few minutes. Check your spam folder too.",
  };
  if (formData.get("website")) return same; // bot trap

  const parsedEmail = email.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { ok: false, message: parsedEmail.error.issues[0].message, field: "email" };

  const captcha = await verifyTurnstile(formData.get("captcha"));
  if (!captcha.ok) return { ok: false, message: captcha.message };

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds")) {
      return { ok: false, message: "Too many tries. Please wait a few minutes and try again." };
    }
    console.error("[auth] reset email:", error.message);
  }
  return same;
}

// The person arrives here already logged in through the emailed link.
export async function updatePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsedPass = password.safeParse(formData.get("password"));
  if (!parsedPass.success) return { ok: false, message: parsedPass.error.issues[0].message, field: "password" };
  if (formData.get("password") !== formData.get("confirm")) {
    return { ok: false, message: "The two passwords are not the same.", field: "confirm" };
  }

  const supabase = createClient();
  const { data: who } = await supabase.auth.getUser();
  if (!who.user) return { ok: false, message: "This link has expired. Please ask for a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsedPass.data });
  if (error) {
    const m = error.message.toLowerCase();
    if ((error as { code?: string }).code === "same_password" || m.includes("different from the old")) return { ok: false, message: "Please choose a password you have not used before.", field: "password" };
    if (m.includes("reauth")) return { ok: false, message: "For safety, please log out, then use \"Forgot password\" again.", field: "password" };
    return { ok: false, message: friendly(error.message), field: "password" };
  }
  redirect("/account?notice=password");
}
