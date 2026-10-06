import { redirect } from "next/navigation";

export const metadata = { title: "My Work | D5O" };

export default function MyWorkPage() {
  redirect("/work");
}
