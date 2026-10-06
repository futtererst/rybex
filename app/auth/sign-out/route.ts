import { redirect } from "next/navigation";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";

export async function GET() {
  const supabase = await createRybexSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
