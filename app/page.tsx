import { redirect } from "next/navigation";

export default function HomePage() {
  // The isolated D5O environment opens directly into the work-centered
  // operating surface. Existing runtime modes retain the legacy entry point.
  const d5oWorkspaceMode = process.env.M1_PROOF_ENABLED === "1" && process.env.RYBEXOS_RUNTIME_MODE === "test";
  redirect(d5oWorkspaceMode ? "/work" : "/command-center");
}
