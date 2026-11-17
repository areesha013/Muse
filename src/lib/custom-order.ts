export const CUSTOM_TYPES = [
  "Custom stickers",
  "Crochet keychain",
  "Crochet plushie",
  "Crochet flowers or bouquet",
  "Crochet wearable (hat, bag...)",
  "Gift set or bundle",
  "Something else",
] as const;

export type CustomStatus = "new" | "quoted" | "accepted" | "in_progress" | "completed" | "declined";

export const CUSTOM_STATUSES: CustomStatus[] = ["new", "quoted", "accepted", "in_progress", "completed", "declined"];

// What the customer sees / what you see in the admin panel.
export const CUSTOM_STATUS_LABEL: Record<CustomStatus, string> = {
  new: "Received",
  quoted: "Quote sent",
  accepted: "Accepted",
  in_progress: "Being made",
  completed: "Done",
  declined: "Not possible",
};

export const MAX_REFERENCE_IMAGES = 3;

/** Today's date in Pakistan as yyyy-mm-dd. */
export function todayInPakistan(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);
}
