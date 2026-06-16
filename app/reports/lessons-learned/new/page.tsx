import Link from "next/link";
import { LessonsLearnedWizard } from "@/components/d5o/optimize/LessonsLearnedWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Lessons Learned Review | RybexOS"
};

export default function NewLessonsLearnedPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Optimize Review</p>
          <h1>New Lessons Learned Review</h1>
          <p>Turn completed work into rate updates, risk library changes, partner posture, and assigned improvement actions.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/reports">Optimize</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="optimize_learning" />
      <LessonsLearnedWizard />
    </div>
  );
}
