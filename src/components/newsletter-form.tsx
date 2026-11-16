"use client";

import { useState, useTransition } from "react";
import { subscribeNewsletter, type NewsletterState } from "@/app/actions/newsletter";

export function NewsletterForm() {
  const [state, setState] = useState<NewsletterState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await subscribeNewsletter(null, data);
      setState(result);
      if (result?.ok) form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email"
          className="h-11 flex-1 rounded-full border border-neutral-300 bg-white px-5 text-sm placeholder:text-neutral-500"
        />
        {/* Spam trap: hidden from people */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Joining..." : "Subscribe"}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-3 min-h-5 text-sm ${state?.ok ? "text-green-800" : "text-red-700"}`}
      >
        {state?.message}
      </p>
    </form>
  );
}
