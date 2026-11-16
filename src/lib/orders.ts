// Types and small helpers shared by checkout, order and tracking pages.

export type OrderStatus = "pending_payment" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod = "cod" | "jazzcash" | "easypaisa" | "bank_transfer";
export type PaymentStatus = "pending" | "submitted" | "verified" | "rejected";

export type OrderView = {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  tracking_note: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_note: string | null;
  has_payment_proof: boolean;
  city: string;
  first_name: string;
  items: { name: string; variant_name: string | null; unit_price: number; quantity: number }[];
  subtotal: number;
  discount_amount: number;
  discount_code: string | null;
  shipping_fee: number;
  total: number;
  // Only on the private order-page link (not on tracking):
  name?: string;
  phone?: string;
  email?: string | null;
  address?: string;
  notes?: string | null;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Waiting for payment",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  bank_transfer: "Bank transfer",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Not paid yet",
  submitted: "Payment submitted, we are checking it",
  verified: "Payment confirmed",
  rejected: "Payment could not be verified",
};

export type PaymentSettings = Record<
  PaymentMethod,
  { enabled?: boolean; account_title?: string; number?: string; bank_name?: string; account_number?: string; iban?: string }
>;

// The database raises errors like "ITEM_OUT_OF_STOCK:Crochet Bear". Split them.
export function parseDbError(message: string | undefined): { code: string; detail: string } {
  const m = (message ?? "").match(/^([A-Z_]+):([\s\S]*)$/);
  return m ? { code: m[1], detail: m[2].trim() } : { code: "UNKNOWN", detail: "" };
}

export function friendlyError(code: string, detail: string): string {
  switch (code) {
    case "ITEM_OUT_OF_STOCK":
      return `Sorry, "${detail}" just sold out or doesn't have enough stock. Please update your cart.`;
    case "ITEM_UNAVAILABLE":
      return `"${detail}" is no longer available. Please remove it from your cart.`;
    case "ITEM_CHOOSE_OPTION":
      return `Please choose an option for "${detail}".`;
    case "ITEM_BAD_QUANTITY":
      return `Please check the quantity of "${detail}".`;
    case "EMPTY_CART":
      return "Your cart is empty.";
    case "TOO_MANY_ITEMS":
    case "INVALID_NAME":
    case "INVALID_PHONE":
    case "INVALID_CITY":
    case "INVALID_ADDRESS":
    case "INVALID_EMAIL":
    case "DISCOUNT_INVALID":
    case "TOO_MANY_ORDERS":
    case "PAYMENT_METHOD_DISABLED":
    case "ORDER_NOT_FOUND":
    case "NO_PAYMENT_NEEDED":
    case "ORDER_CLOSED":
    case "PAYMENT_LOCKED":
      return detail || "Something went wrong. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Which form field a database error belongs to (to show it next to the field).
export const ERROR_FIELD: Record<string, "name" | "phone" | "city" | "address" | "email"> = {
  INVALID_NAME: "name",
  INVALID_PHONE: "phone",
  INVALID_CITY: "city",
  INVALID_ADDRESS: "address",
  INVALID_EMAIL: "email",
};

// Checks the first bytes of a file so a renamed .exe can't pass as a photo.
export function sniffImageType(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "webp";
  return null;
}

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
