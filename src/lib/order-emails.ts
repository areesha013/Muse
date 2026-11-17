// Emails about orders. Every function is safe to call: without a Resend key they do nothing,
// and a failed email never breaks the order. See src/lib/email.ts.
import { isEmail, notifyOwner, rs, sendEmail, siteUrl } from "@/lib/email";
import { siteConfig } from "@/config/site";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/orders";

const first = (name: string) => (name || "there").trim().split(/\s+/)[0];
const orderLink = (token: string) => `${siteUrl()}/order/${token}`;

export async function emailOrderPlaced(o: { orderId: string; orderNumber: string; total: number; token: string; method: PaymentMethod; name: string; phone: string; email: string | null }) {
  await notifyOwner(
    `New order ${o.orderNumber} (${rs(o.total)})`,
    `${o.name} (${o.phone}) placed ${o.orderNumber} for ${rs(o.total)}.\nPayment: ${PAYMENT_METHOD_LABEL[o.method]}\n\nOpen it: ${siteUrl()}/admin/orders/${o.orderId}`
  );
  if (!isEmail(o.email)) return;
  const needsPayment = o.method !== "cod";
  await sendEmail({
    to: o.email,
    subject: `Your ${siteConfig.name} order ${o.orderNumber}`,
    text:
      `Hi ${first(o.name)},\n\nThank you for your order ${o.orderNumber} (${rs(o.total)}).\n\n` +
      (needsPayment
        ? `To start preparing it, please pay and upload your payment proof here:\n${orderLink(o.token)}\n\n`
        : `You chose cash on delivery. Keep ${rs(o.total)} ready when it arrives.\n\n`) +
      `Follow your order any time:\n${orderLink(o.token)}\n\nKeep this link private. Anyone with it can see your order.`,
  });
}

export async function emailPaymentProof(o: { orderId: string; orderNumber: string; method: PaymentMethod; name: string }) {
  await notifyOwner(
    `Payment to check: ${o.orderNumber}`,
    `${o.name} sent payment details for ${o.orderNumber} (${PAYMENT_METHOD_LABEL[o.method]}).\n\nCheck it: ${siteUrl()}/admin/orders/${o.orderId}`
  );
}

type Update = { kind: "status"; status: string; note?: string | null } | { kind: "payment_rejected"; note?: string | null } | { kind: "payment_verified" };

const STATUS_LINE: Record<string, string> = {
  confirmed: "Your order is confirmed. We will start preparing it.",
  packed: "Your order is packed and will be handed to the courier soon.",
  shipped: "Your order is on its way.",
  delivered: "Your order was delivered. We hope you love it! If you have a minute, a review on the product page helps a lot.",
  cancelled: "Your order was cancelled.",
};

export async function emailOrderUpdate(o: { orderNumber: string; token: string; name: string; email: string | null }, u: Update) {
  if (!isEmail(o.email)) return;
  let subject: string;
  let body: string;
  if (u.kind === "payment_rejected") {
    subject = `We could not verify your payment (${o.orderNumber})`;
    body = `We could not verify your payment for ${o.orderNumber}.${u.note ? `\n\n${u.note}` : ""}\n\nPlease check and send your payment details again here:\n${orderLink(o.token)}`;
  } else if (u.kind === "payment_verified") {
    subject = `Payment received (${o.orderNumber})`;
    body = `We received your payment for ${o.orderNumber}. Your order is confirmed and we will start preparing it.\n\nFollow it here:\n${orderLink(o.token)}`;
  } else {
    if (!STATUS_LINE[u.status]) return;
    subject = `Your order ${o.orderNumber}: ${u.status === "cancelled" ? "cancelled" : u.status}`;
    body = `${STATUS_LINE[u.status]}${u.note ? `\n\nNote from us: ${u.note}` : ""}\n\nFollow it here:\n${orderLink(o.token)}`;
  }
  await sendEmail({ to: o.email, subject, text: `Hi ${first(o.name)},\n\n${body}` });
}
