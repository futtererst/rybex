import { NextResponse } from "next/server";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { hostedD5OTargetReady } from "@/lib/d5o/auth/hosted-target";

export const dynamic = "force-dynamic";

const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" }
});

export async function GET() {
  if (!hostedD5OTargetReady()) return reply({ error: "hosted_unavailable" }, 503);
  const client = await createRybexSupabaseServerClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return reply({ error: "unauthenticated" }, 401);
  const result = await client.rpc("d5o_hosted_workspaces_v1");
  if (result.error || !Array.isArray(result.data)) return reply({ error: "workspace_unavailable" }, 503);
  return reply({ workspaces: result.data });
}
