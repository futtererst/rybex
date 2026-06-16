import { NextResponse } from "next/server";
import { commitWorkflowTransaction } from "@/app/actions/workflow-transactions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await commitWorkflowTransaction(body);
    const status = result.success
      ? 200
      : result.message.toLowerCase().includes("permission required")
        ? 403
        : result.message.toLowerCase().includes("auth")
          ? 401
          : 400;

    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        mode: "local",
        message: error instanceof Error ? error.message : "Workflow transaction failed."
      },
      { status: 500 }
    );
  }
}
