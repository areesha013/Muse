"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, MessageCircle, X } from "lucide-react";
import { submitCustomRequest } from "@/app/actions/custom-orders";
import { CUSTOM_TYPES, MAX_REFERENCE_IMAGES } from "@/lib/custom-order";
import { shrinkImage } from "@/lib/shrink-image";
import { Turnstile } from "@/components/turnstile";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const inputClass = "mt-1 h-11 w-full rounded-lg border bg-white px-3 text-sm placeholder:text-neutral-500";

function Field({ id, label, error, optional, children }: { id: string; label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label} {optional && <span className="font-normal text-neutral-600">(optional)</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function CustomOrderForm({ defaults, loggedIn }: { defaults: { name: string; phone: string; email: string }; loggedIn: boolean }) {
  const [v, setV] = useState({ name: defaults.name, phone: defaults.phone, email: defaults.email, type: "", description: "", budget: "", deadline: "", website: "" });
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const picker = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const err = (f: string) => (error?.field === f ? error.message : undefined);
  const cls = (f: string) => cn(inputClass, err(f) ? "border-red-600" : "border-neutral-300");
  const aria = (f: string) => ({ "aria-invalid": err(f) ? true : undefined, "aria-describedby": err(f) ? `${f}-error` : undefined });

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_REFERENCE_IMAGES - files.length;
    const added = Array.from(list).slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFiles([...files, ...added]);
    if (picker.current) picker.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const fd = new FormData();
    fd.set("name", v.name);
    fd.set("phone", v.phone);
    fd.set("email", v.email);
    fd.set("product_type", v.type);
    fd.set("description", v.description);
    fd.set("budget", v.budget);
    fd.set("deadline", v.deadline);
    fd.set("website", v.website);
    fd.set("captcha", captcha);
    for (const f of files) fd.append("images", await shrinkImage(f.file));
    try {
      const r = await submitCustomRequest(fd);
      if (r.ok) setDone(true);
      else {
        setError({ message: r.message, field: r.field });
        setCaptchaReset((n) => n + 1); // each security-check token works only once
      }
    } catch {
      setError({ message: "Something went wrong. Please try again, or message us on WhatsApp." });
      setCaptchaReset((n) => n + 1);
    }
    setSending(false);
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl bg-accent-soft p-8 text-center">
        <CheckCircle2 size={36} aria-hidden className="mx-auto text-green-700" />
        <h2 className="mt-3 text-xl font-semibold">Thank you! We got your request.</h2>
        <p className="mt-2 text-neutral-700">We will look at it and reply with a price and timing, usually within 2 days. We will contact you on {v.phone}.</p>
        {loggedIn && <p className="mt-2 text-sm text-neutral-700">You can follow it in <a href="/account" className="underline">My account</a>.</p>}
        <a
          href={`https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(`Hi! I just sent a custom request on the website (${v.type}).`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700"
        >
          <MessageCircle size={18} aria-hidden /> Say hi on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Custom order request">
      <div className="hidden" aria-hidden>
        <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} name="website" /></label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Your name" error={err("name")}>
          <input id="name" name="name" autoComplete="name" required value={v.name} onChange={set("name")} className={cls("name")} {...aria("name")} />
        </Field>
        <Field id="phone" label="Mobile number" error={err("phone")}>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" required value={v.phone} onChange={set("phone")} className={cls("phone")} {...aria("phone")} />
        </Field>
      </div>
      <Field id="email" label="Email" optional error={err("email")}>
        <input id="email" name="email" type="email" autoComplete="email" value={v.email} onChange={set("email")} className={cls("email")} {...aria("email")} />
      </Field>
      <Field id="product_type" label="What would you like made?" error={err("product_type")}>
        <select id="product_type" name="product_type" required value={v.type} onChange={set("type")} className={cls("product_type")} {...aria("product_type")}>
          <option value="">Choose one...</option>
          {CUSTOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field id="description" label="Tell us about your idea" error={err("description")}>
        <textarea
          id="description" name="description" rows={5} required maxLength={2000} value={v.description} onChange={set("description")}
          placeholder="Colors, size, names or words on it, how many, who it is for..."
          className={cn(cls("description"), "h-auto py-2")} {...aria("description")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="budget" label="Budget (Rs)" optional error={err("budget")}>
          <input id="budget" name="budget" inputMode="numeric" placeholder="2500" value={v.budget} onChange={set("budget")} className={cls("budget")} {...aria("budget")} />
        </Field>
        <Field id="deadline" label="Needed by" optional error={err("deadline")}>
          <input id="deadline" name="deadline" type="date" value={v.deadline} onChange={set("deadline")} className={cls("deadline")} {...aria("deadline")} />
        </Field>
      </div>

      <div>
        <p className="text-sm font-medium">Reference pictures <span className="font-normal text-neutral-600">(optional, up to {MAX_REFERENCE_IMAGES})</span></p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {files.map((f, i) => (
            <div key={f.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={`Picture ${i + 1}`} width={80} height={80} className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" onClick={() => { URL.revokeObjectURL(f.url); setFiles(files.filter((_, j) => j !== i)); }} aria-label={`Remove picture ${i + 1}`} className="absolute -right-2 -top-2 rounded-full bg-neutral-900 p-1 text-white">
                <X size={12} aria-hidden />
              </button>
            </div>
          ))}
          {files.length < MAX_REFERENCE_IMAGES && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-400 text-xs text-neutral-700 hover:bg-neutral-50">
              <ImagePlus size={20} aria-hidden /> Add
              <input id="images" ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => addFiles(e.target.files)} className="sr-only" />
            </label>
          )}
        </div>
        {err("images") && <p role="alert" className="mt-1 text-sm text-red-700">{err("images")}</p>}
      </div>

      <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />
      {error && !error.field && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</p>}
      <button type="submit" disabled={sending} className="h-12 w-full rounded-full bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-700 disabled:bg-neutral-300 sm:w-auto sm:px-10">
        {sending ? "Sending..." : "Send request"}
      </button>
      <p className="text-xs text-neutral-600">This is not an order yet. We reply with a price first, and you decide.</p>
    </form>
  );
}
