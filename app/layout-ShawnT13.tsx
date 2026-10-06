import type { Metadata } from "next";
import Link from "next/link";
import { NotificationBell } from "@/components/d5o/notifications";
import { WorkflowCompletionProvider } from "@/components/d5o/workflow-completion/WorkflowCompletionProvider";
import { PrimaryNav } from "@/components/layout/PrimaryNav";
import { deriveOperatingNotifications } from "@/lib/d5o/notifications";
import "./globals.css";

export const metadata: Metadata = {
  title: "RybexOS Command Center",
  description: "D5O operating system foundation for Rybex Infrastructure Group"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const notificationSummary = deriveOperatingNotifications();

  return (
    <html lang="en">
      <body>
        <WorkflowCompletionProvider>
          <div className="app-shell">
            <aside className="sidebar" aria-label="Primary navigation">
              <Link className="brand" href="/command-center">
                <span className="brand-mark">R</span>
                <span>
                  <strong>RybexOS</strong>
                  <small>Operating control</small>
                </span>
              </Link>
              <NotificationBell notifications={notificationSummary.commandCenterNotifications} />
              <PrimaryNav />
            </aside>
            <main className="main-content">{children}</main>
          </div>
        </WorkflowCompletionProvider>
      </body>
    </html>
  );
}
