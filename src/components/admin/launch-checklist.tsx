import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { LaunchItem } from "@/lib/launch-check";

export function LaunchChecklist({ items }: { items: LaunchItem[] }) {
  const open = items.filter((i) => !i.done);
  if (open.length === 0) return null;
  const mustDo = open.filter((i) => i.required).length;

  return (
    <section aria-labelledby="launch-h" className="rounded-2xl border border-neutral-900 bg-accent-soft p-5">
      <h2 id="launch-h" className="font-semibold">Before you open the shop</h2>
      <p className="mt-1 text-sm text-neutral-700">
        {mustDo > 0 ? `${mustDo} thing${mustDo === 1 ? "" : "s"} to do. ` : "Required items are done. "}
        The rest are recommended.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-2">
            {i.done ? (
              <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0 text-green-700" />
            ) : (
              <Circle size={18} aria-hidden className="mt-0.5 shrink-0 text-neutral-500" />
            )}
            <span>
              <span className={i.done ? "text-neutral-600 line-through" : "font-medium"}>
                {i.href && !i.done ? <Link href={i.href} className="underline">{i.label}</Link> : i.label}
              </span>
              <span className="sr-only">{i.done ? " (done)" : i.required ? " (required)" : " (recommended)"}</span>
              {!i.done && <span className="block text-neutral-700">{i.hint}{!i.required && " (recommended)"}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
