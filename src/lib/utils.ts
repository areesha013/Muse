import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1500 -> "Rs 1,500" */
export function formatPKR(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-PK")}`;
}
