"use server";

import { redirect } from "next/navigation";
import { safeInternalRedirectPath } from "@/lib/d5o/auth/redirects";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeInternalRedirectPath(formData.get("next"));

  if (!email || !password) {
    redirect(`/auth/sign-in?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createRybexSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/sign-in?error=invalid&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
