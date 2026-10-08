import { NextResponse } from "next/server";
import { summarizeProductionReadiness } from "@/lib/d5o/security/production-readiness";

export function GET() {
  const readiness = summarizeProductionReadiness();

  return NextResponse.json(readiness, {
    status: readiness.ok ? 200 : 503,
    headers: {
      "cache-control": "no-store"
    }
  });
}
