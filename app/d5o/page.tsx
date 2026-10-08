import { redirect } from "next/navigation";

export const metadata = { title: "D5O Work" };

export default function DiscontinuedD5OReviewRoute() {
  redirect("/work");
}
