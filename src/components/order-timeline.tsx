import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentMethod } from "@/lib/orders";

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "pending_payment", label: "Waiting for payment" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export function OrderTimeline({ status, method }: { status: OrderStatus; method: PaymentMethod }) {
  if (status === "cancelled") {
    return (
      <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
        This order was cancelled. If you didn&apos;t expect this, please message us on WhatsApp.
      </p>
    );
  }

  const steps = method === "cod" ? STEPS.filter((s) => s.key !== "pending_payment") : STEPS;
  const current = steps.findIndex((s) => s.key === status);

  return (
    <ol className="flex items-start" aria-label="Order progress">
      {steps.map((step, i) => {
        const done = i < current || status === "delivered";
        const active = i === current && status !== "delivered";
        return (
          <li key={step.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn("absolute left-[-50%] top-4 h-0.5 w-full", i <= current || status === "delivered" ? "bg-neutral-900" : "bg-neutral-200")}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done && "border-neutral-900 bg-neutral-900 text-white",
                active && "border-accent-ink bg-accent-soft text-accent-ink",
                !done && !active && "border-neutral-300 bg-white text-neutral-500"
              )}
            >
              {done ? <Check size={16} aria-hidden /> : i + 1}
            </span>
            <span className={cn("mt-2 text-xs sm:text-sm", active ? "font-semibold text-neutral-900" : "text-neutral-600")}>
              {step.label}
              {done && <span className="sr-only"> (done)</span>}
              {active && <span className="sr-only"> (current step)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
