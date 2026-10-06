import { redirect } from "next/navigation";

export const metadata = { title: "Portfolio | D5O" };

export default function PortfolioPage() {
  redirect("/work");
}
