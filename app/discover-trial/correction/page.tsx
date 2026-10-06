import Link from "next/link";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover duplicate correction trial | D5O" };

export default async function DiscoverCorrectionPage() {
  assertDiscoverTrialEnvironment();
  return <main style={{ padding: 32 }}><h1>Select a Work for correction</h1>
    <p>Open the correction task from a Work’s duplicate-review screen.</p>
    <Link href="/discover-trial/review">Return to duplicate review</Link></main>;
}
