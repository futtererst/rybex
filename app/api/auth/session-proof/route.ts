import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";

export async function GET() {
  const context = await getRequestContext();

  if (!context.authenticated) {
    return NextResponse.json(
      {
        success: false,
        status: context.status,
        message: context.message
      },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      success: true,
      status: context.status,
      user: {
        id: context.user?.id,
        email: context.user?.email
      },
      workspace: {
        id: context.workspace?.id,
        slug: context.workspace?.slug
      },
      membership: {
        id: context.membership?.id,
        status: context.membership?.status
      },
      role: context.role,
      permissions: context.permissions
    },
    { headers: { "cache-control": "no-store" } }
  );
}
