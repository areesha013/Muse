"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset, updatePassword, type ResetState } from "@/app/actions/auth";
import { Turnstile } from "@/components/turnstile";
import { cn } from "@/lib/utils";

const input = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm";
const button =
  "h-12 w-full rounded-full bg-neutral-900 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300";

export function ForgotPasswordForm() {
  const [state, setState] = useState<ResetState>(null);
  const [pending, startTransition] = useTransition();
  const [captcha, setCaptcha] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("captcha", captcha);
    startTransition(async () => {
      setState(await requestPasswordReset(null, data));
      setCaptchaReset((n) => n + 1);
    });
  }

  if (state?.ok) {
    return (
      <div role="status" className="rounded-2xl bg-accent-soft p-6 text-sm">
        <p>{state.message}</p>
        <p className="mt-4"><Link href="/login" className="underline">Back to log in</Link></p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state && (
        <p id="reset-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="email" required
          className={cn(input, state?.field === "email" ? "border-red-600" : "border-neutral-300")}
          {...(state?.field === "email" ? { "aria-invalid": true as const, "aria-describedby": "reset-error" } : {})}
        />
      </div>
      <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <button type="submit" disabled={pending} className={button}>{pending ? "Please wait..." : "Send me a link"}</button>
      <p className="text-center text-sm text-neutral-600"><Link href="/login" className="underline">Back to log in</Link></p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, setState] = useState<ResetState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      // On success the server sends the person to My account.
      setState(await updatePassword(null, data));
    });
  }

  const field = (name: string) => cn(input, state?.field === name ? "border-red-600" : "border-neutral-300");
  const bad = (name: string) => (state?.field === name ? { "aria-invalid": true as const, "aria-describedby": "reset-error" } : {});

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state && !state.ok && (
        <p id="reset-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}{" "}
          {state.message.includes("expired") && <Link href="/forgot-password" className="underline">Ask for a new link</Link>}
        </p>
      )}
      <div>
        <label htmlFor="password" className="block text-sm font-medium">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={field("password")} {...bad("password")} />
        <p className="mt-1 text-xs text-neutral-600">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium">Type it again</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={field("confirm")} {...bad("confirm")} />
      </div>
      <button type="submit" disabled={pending} className={button}>{pending ? "Please wait..." : "Save new password"}</button>
    </form>
  );
}
