import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { CustomOrderForm } from "@/components/custom-order-form";

export const metadata: Metadata = {
  title: "Custom orders",
  description: "Ask for custom stickers or a handmade crochet piece, made just for you.",
};
export const dynamic = "force-dynamic";

export default async function CustomOrderPage() {
  const viewer = await getViewer();
  let phone = "";
  if (viewer) {
    const { data } = await createClient().from("profiles").select("phone").eq("id", viewer.id).maybeSingle();
    phone = (data?.phone as string | null) ?? "";
  }
  return (
    <PageShell title="Custom orders">
      <p>Have an idea? Custom stickers, a crochet piece in your colors, a gift set for someone special. Tell us what you have in mind and we will reply with a price and timing.</p>
      <div className="pt-4">
        <CustomOrderForm defaults={{ name: viewer?.fullName ?? "", phone, email: viewer?.email ?? "" }} loggedIn={!!viewer} />
      </div>
    </PageShell>
  );
}
