import { redirect } from "next/navigation";

export const metadata = { title: "Start Work | D5O" };

export default function StartWorkPage() {
  redirect("/work");
}
