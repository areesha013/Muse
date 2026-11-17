"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProductImage, makeMainImage, uploadProductImage } from "@/app/actions/admin-products";
import { Message } from "@/components/admin/ui";

export type Img = { id: string; url: string; alt: string | null };

const MAX_SIDE = 1600;

// Phone photos are often 4-10 MB. Shrink them in the browser before uploading (WebP keeps transparency).
async function prepare(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const okType = /^image\/(jpeg|png|webp)$/.test(file.type);
    if (scale === 1 && file.size <= 1_500_000 && okType) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.86));
    if (blob && blob.type === "image/webp" && (blob.size < file.size || !okType)) {
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
    }
    return file;
  } catch {
    return file; // the server will say if it is not a usable photo
  }
}

export function ImageManager({ productId, images }: { productId: string; images: Img[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onlyPlaceholder = images.length > 0 && images.every((i) => i.url.startsWith("/"));

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMsg(null);
    let added = 0;
    const problems: string[] = [];
    const list = Array.from(files);
    for (let i = 0; i < list.length; i++) {
      setBusy(`Uploading ${i + 1} of ${list.length}...`);
      const file = await prepare(list[i]);
      const fd = new FormData();
      fd.set("product_id", productId);
      fd.set("file", file);
      const r = await uploadProductImage(fd);
      if (r.ok) added++;
      else problems.push(`${list[i].name}: ${r.message}`);
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    setMsg({ ok: problems.length === 0, text: problems.length ? problems.join(" ") : `${added} ${added === 1 ? "photo" : "photos"} added.` });
    router.refresh();
  }

  function act(fn: () => Promise<{ ok: boolean; message?: string }>) {
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message ?? "" });
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="img-h" className="space-y-4 rounded-2xl border border-neutral-200 p-5">
      <h2 id="img-h" className="font-semibold">Photos</h2>
      <p className="text-sm text-neutral-600">The first photo is the main one. JPG, PNG or WebP. Big photos are shrunk automatically.</p>
      {onlyPlaceholder && <p className="rounded-xl bg-cream px-4 py-3 text-sm">This product shows a placeholder picture. Upload a real photo to replace it.</p>}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => {
            const placeholder = img.url.startsWith("/");
            return (
              <li key={img.id} className="rounded-xl border border-neutral-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? "Product photo"} className="aspect-square w-full rounded-lg bg-neutral-100 object-cover" />
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {i === 0 ? <span className="font-medium">Main photo</span> : !placeholder && (
                    <button type="button" disabled={pending} onClick={() => act(() => makeMainImage(img.id))} className="underline">Make main</button>
                  )}
                  {confirmId === img.id ? (
                    <span className="flex items-center gap-2 text-red-800">
                      Remove?
                      <button type="button" disabled={pending} onClick={() => act(() => deleteProductImage(img.id))} className="font-medium underline">Yes</button>
                      <button type="button" onClick={() => setConfirmId(null)} className="underline">No</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmId(img.id)} className="text-red-700 underline">Remove</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <label htmlFor="img-upload" className="inline-flex h-11 cursor-pointer items-center rounded-full border border-neutral-900 px-6 text-sm font-medium hover:bg-neutral-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
          {busy ?? "Add photos"}
          <input ref={input} id="img-upload" type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple disabled={!!busy} onChange={(e) => onFiles(e.target.files)} className="sr-only" />
        </label>
      </div>
      <Message msg={msg} />
    </section>
  );
}
