import { formatPKR } from "@/lib/utils";
import type { OrderView } from "@/lib/orders";

export function OrderSummary({ order }: { order: OrderView }) {
  return (
    <div>
      <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {order.items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex justify-between gap-4 py-3 text-sm">
            <div>
              <p className="font-medium">{item.name}</p>
              {item.variant_name && <p className="text-neutral-600">{item.variant_name}</p>}
              <p className="text-neutral-600">Qty {item.quantity}</p>
            </div>
            <p className="font-medium">{formatPKR(item.unit_price * item.quantity)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">Subtotal</dt>
          <dd>{formatPKR(order.subtotal)}</dd>
        </div>
        {order.discount_amount > 0 && (
          <div className="flex justify-between text-green-800">
            <dt>Discount{order.discount_code ? ` (${order.discount_code})` : ""}</dt>
            <dd>-{formatPKR(order.discount_amount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-neutral-600">Shipping</dt>
          <dd>{order.shipping_fee > 0 ? formatPKR(order.shipping_fee) : "Free"}</dd>
        </div>
        <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatPKR(order.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
