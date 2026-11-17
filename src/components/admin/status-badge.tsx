import { cn } from "@/lib/utils";
import { PAYMENT_STATUS_LABEL, STATUS_LABEL, type OrderStatus, type PaymentStatus } from "@/lib/orders";

const ORDER_STYLE: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  packed: "bg-violet-100 text-violet-900",
  shipped: "bg-indigo-100 text-indigo-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-neutral-200 text-neutral-700",
};

// The words always carry the meaning; the color is only a hint.
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", ORDER_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

const PAY_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-neutral-100 text-neutral-700",
  submitted: "bg-amber-100 text-amber-900",
  verified: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};
const PAY_SHORT: Record<PaymentStatus, string> = {
  pending: "Not paid",
  submitted: "Check payment",
  verified: "Paid",
  rejected: "Rejected",
};

export function PaymentStatusBadge({ status, long }: { status: PaymentStatus; long?: boolean }) {
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", PAY_STYLE[status])}>
      {long ? PAYMENT_STATUS_LABEL[status] : PAY_SHORT[status]}
    </span>
  );
}
