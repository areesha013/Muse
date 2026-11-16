import { MessageCircle } from "lucide-react";
import { siteConfig } from "@/config/site";

export function WhatsAppButton() {
  const text = encodeURIComponent(`Hi ${siteConfig.name}! I have a question.`);
  return (
    <a
      href={`https://wa.me/${siteConfig.whatsappNumber}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#1fa855] text-white shadow-lg transition-transform hover:scale-105"
    >
      <MessageCircle size={24} aria-hidden />
    </a>
  );
}
