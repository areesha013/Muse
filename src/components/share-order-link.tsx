"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/copy-button";

// Guests have no account, so this page link is how they come back to their order.
export function ShareOrderLink() {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  if (!url) return null;

  return (
    <div className="rounded-xl bg-cream p-4 text-sm">
      <p className="font-medium">Save this page</p>
      <p className="mt-1 text-neutral-700">
        This link is your order page. Keep it to check progress or send payment details later.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={url} label="Copy link" />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`My order: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:border-neutral-900"
        >
          <MessageCircle size={14} aria-hidden /> Send to WhatsApp
        </a>
      </div>
    </div>
  );
}
