import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "customer" | "admin";
};

// Who is logged in right now? Returns null for visitors.
export async function getViewer(): Promise<Viewer | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
      role: profile?.role === "admin" ? "admin" : "customer",
    };
  } catch {
    return null;
  }
}

// For admin pages and admin actions. Visitors go to the login page.
// Returns the viewer only when they really are an admin (checked in the database).
export async function requireAdmin(nextPath = "/admin"): Promise<Viewer | null> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return viewer.role === "admin" ? viewer : null;
}
