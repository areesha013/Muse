"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { login, signup, type AuthState } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const input = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, setState] = useState<AuthState>(null);
  const [pending, startTransition] = useTransition();
  const isSignup = mode === "signup";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      // On success the server redirects, so we only get a result back when something is wrong.
      const result = await (isSignup ? signup : login)(null, data);
      setState(result);
    });
  }

  const field = (name: string) => cn(input, state?.field === name ? "border-red-600" : "border-neutral-300");
  const bad = (name: string) => (state?.field === name ? { "aria-invalid": true as const, "aria-describedby": "auth-error" } : {});

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state && (
        <p id="auth-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}
        </p>
      )}
      {isSignup && (
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium">Full name</label>
          <input id="full_name" name="full_name" autoComplete="name" required className={field("full_name")} {...bad("full_name")} />
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field("email")} {...bad("email")} />
      </div>
      {isSignup && (
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            Mobile number <span className="font-normal text-neutral-600">(optional)</span>
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" className={field("phone")} {...bad("phone")} />
        </div>
      )}
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={isSignup ? 8 : undefined}
          className={field("password")}
          {...bad("password")}
        />
        {isSignup && <p className="mt-1 text-xs text-neutral-600">At least 8 characters.</p>}
      </div>
      {isSignup && <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full bg-neutral-900 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {pending ? "Please wait..." : isSignup ? "Create account" : "Log in"}
      </button>
      <p className="text-center text-sm text-neutral-600">
        {isSignup ? (
          <>Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="underline">Log in</Link></>
        ) : (
          <>New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="underline">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
