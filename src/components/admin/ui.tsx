import { cn } from "@/lib/utils";

export const inputCls =
  "mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-500 disabled:bg-neutral-100";
export const btnPrimary =
  "h-11 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300";
export const btnOutline =
  "h-11 rounded-full border border-neutral-900 px-6 text-sm font-medium transition-colors hover:bg-neutral-100 disabled:opacity-50";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {hint && <span className="font-normal text-neutral-600"> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function Message({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg || !msg.text) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={cn("rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800")}>
      {msg.text}
    </p>
  );
}

export function Check({ id, label, checked, onChange, hint }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-neutral-400" />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-neutral-600">{hint}</span>}
      </span>
    </label>
  );
}
