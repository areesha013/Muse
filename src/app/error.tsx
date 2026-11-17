"use client";

import { useEffect } from "react";
import Link from "next/link";

// Shown when something unexpected breaks on a page. Keeps the shop usable instead of a blank screen.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-600">Oops</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-neutral-600">It was not your fault. Please try again. If it keeps happening, message us on WhatsApp.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white hover:bg-neutral-700">
          Try again
        </button>
        <Link href="/" className="rounded-full border border-neutral-900 px-8 py-3 text-sm font-medium hover:bg-neutral-100">
          Go home
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-neutral-500">Error code: {error.digest}</p>}
    </div>
  );
}
