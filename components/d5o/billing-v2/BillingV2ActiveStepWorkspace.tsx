import type { ReactNode } from "react";

type BillingV2ActiveStepWorkspaceProps = {
  children: ReactNode;
};

export function BillingV2ActiveStepWorkspace({ children }: BillingV2ActiveStepWorkspaceProps) {
  return (
    <section className="guided-current-step billing-current-step-card panel" aria-label="Current billing step" data-qa="billing-v2-active-step">
      {children}
    </section>
  );
}
