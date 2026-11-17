"use client";

import { useEffect, useRef } from "react";

// Shows the Cloudflare Turnstile check. Renders nothing when no site key is set.
// onToken gets the token when the check passes, and "" when it expires or fails.
// Change `resetSignal` (e.g. add 1) after a failed submit: each token works only once.

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile script blocked"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Turnstile({ onToken, resetSignal = 0 }: { onToken: (token: string) => void; resetSignal?: number }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          appearance: "interaction-only", // invisible unless Cloudflare needs the person to click
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(""),
          "error-callback": () => cb.current(""),
        });
      })
      .catch(() => cb.current("")); // blocked by an ad blocker: the server will explain
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (widget.current && window.turnstile) {
      cb.current("");
      window.turnstile.reset(widget.current);
    }
  }, [resetSignal]);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-0" data-testid="turnstile" />;
}
