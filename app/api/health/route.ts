import { NextResponse } from "next/server";

export function GET() {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  return NextResponse.json({
    ok: true,
    service: "rybexos",
    status: "alive",
    supabaseOrigin,
    timestamp: new Date().toISOString()
  });
}
