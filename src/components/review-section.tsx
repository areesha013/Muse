"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star, X, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteMyReview, deleteReviewPhoto, submitReview, uploadReviewPhoto } from "@/app/actions/reviews";
import { shrinkImage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";

type Own = { id: string; rating: number; title: string | null; status: "pending" | "approved" | "hidden" };
type State = { kind: "loading" } | { kind: "visitor" } | { kind: "ready"; own: Own | null };

const STATUS_TEXT: Record<Own["status"], string> = {
  pending: "Your review is waiting for approval. We will publish it soon.",
  approved: "Your review is published. Thank you!",
  hidden: "Your review is not shown on the shop.",
};

// Shown under the product's reviews. The product page itself stays fast and cached:
// who is logged in is looked up in the browser.
export function ReviewSection({ productId, slug }: { productId: string; slug: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return live && setState({ kind: "visitor" });
        const { data } = await supabase.from("reviews").select("id, rating, title, status").eq("product_id", productId).eq("user_id", u.user.id).maybeSingle();
        if (live) setState({ kind: "ready", own: (data as Own | null) ?? null });
      } catch {
        if (live) setState({ kind: "visitor" });
      }
    })();
    return () => { live = false; };
  }, [productId]);

  if (state.kind === "loading") return <div className="mt-8 h-24" aria-hidden />;

  if (state.kind === "visitor") {
    return (
      <div className="mt-8 rounded-xl border border-neutral-200 p-5 text-sm">
        <p className="font-medium">Bought this? Tell others what you think.</p>
        <p className="mt-1 text-neutral-700">
          <Link href={`/login?next=${encodeURIComponent(`/product/${slug}#reviews-heading`)}`} className="underline">Log in</Link> or{" "}
          <Link href="/signup" className="underline">create an account</Link> to write a review.
        </p>
      </div>
    );
  }

  if (state.own) {
    return <OwnReview own={state.own} onRemoved={() => setState({ kind: "ready", own: null })} />;
  }
  return <ReviewForm productId={productId} onDone={(own) => setState({ kind: "ready", own })} />;
}

function OwnReview({ own, onRemoved }: { own: Own; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="mt-8 rounded-xl border border-neutral-200 p-5 text-sm" role="status">
      <p className="font-medium">Your review ({own.rating} of 5 stars)</p>
      <p className="mt-1 text-neutral-700">{STATUS_TEXT[own.status]}</p>
      {err && <p role="alert" className="mt-2 text-red-700">{err}</p>}
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="mt-3 text-sm underline">Remove my review</button>
      ) : (
        <p className="mt-3 flex flex-wrap items-center gap-3">
          Remove it for good?
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await deleteMyReview(own.id);
              setBusy(false);
              if (r.ok) onRemoved();
              else setErr(r.message);
            }}
            className="rounded-full border border-red-700 px-4 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Yes, remove
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="underline">Keep it</button>
        </p>
      )}
    </div>
  );
}

function ReviewForm({ productId, onDone }: { productId: string; onDone: (o: Own) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    setUploading(true);
    const problems: string[] = [];
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (next.length >= 3) { problems.push("You can add up to 3 photos."); break; }
      const small = await shrinkImage(f);
      const fd = new FormData();
      fd.set("file", small);
      const r = await uploadReviewPhoto(fd);
      if (r.ok) next.push(r.url);
      else problems.push(r.message);
    }
    setPhotos(next);
    setUploading(false);
    if (input.current) input.current.value = "";
    if (problems.length) setErr(problems[0]);
  }

  async function removePhoto(url: string) {
    setPhotos((p) => p.filter((x) => x !== url));
    await deleteReviewPhoto(url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (rating === 0) return setErr("Please choose a star rating.");
    setSending(true);
    const r = await submitReview({ productId, rating, title, body, photos });
    setSending(false);
    if (r.ok) onDone({ id: r.id, rating, title: title || null, status: "pending" });
    else setErr(r.message);
  }

  const shown = hover || rating;
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl border border-neutral-200 p-5" aria-labelledby="write-review">
      <h3 id="write-review" className="font-semibold">Write a review</h3>

      <fieldset>
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="rounded p-1"
            >
              <Star size={28} aria-hidden className={cn(n <= shown ? "fill-accent-ink text-accent-ink" : "text-neutral-400")} />
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="rv-title" className="block text-sm font-medium">Title <span className="font-normal text-neutral-600">(optional)</span></label>
        <input id="rv-title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
      </div>
      <div>
        <label htmlFor="rv-body" className="block text-sm font-medium">Your review</label>
        <textarea id="rv-body" rows={4} value={body} maxLength={1500} onChange={(e) => setBody(e.target.value)} placeholder="What did you like? How does it look in real life?" className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <p className="text-sm font-medium">Photos <span className="font-normal text-neutral-600">(optional, up to 3)</span></p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {photos.map((u) => (
            <div key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Your review photo" width={72} height={72} className="h-[72px] w-[72px] rounded-lg object-cover" />
              <button type="button" onClick={() => removePhoto(u)} aria-label="Remove this photo" className="absolute -right-2 -top-2 rounded-full bg-neutral-900 p-1 text-white">
                <X size={12} aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="flex h-[72px] w-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-400 text-xs text-neutral-700 hover:bg-neutral-50">
              <ImagePlus size={20} aria-hidden />
              {uploading ? "..." : "Add"}
              <input id="rv-photos" ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(e) => onFiles(e.target.files)} className="sr-only" />
            </label>
          )}
        </div>
      </div>

      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>}
      <button type="submit" disabled={sending || uploading} className="h-11 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-700 disabled:bg-neutral-300">
        {sending ? "Sending..." : "Send review"}
      </button>
      <p className="text-xs text-neutral-600">We read every review before it appears.</p>
    </form>
  );
}
