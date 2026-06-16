"use client";

import Link from "next/link";
import { focusHashTarget } from "@/components/d5o/focus-target";

type HeaderAction = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  context?: string;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  tags?: string[];
};

function HeaderActionLink({ action }: { action: HeaderAction }) {
  const className = `button button-${action.tone ?? "secondary"}`;

  if (action.href.startsWith("#")) {
    return (
      <a className={className} href={action.href} onClick={() => focusHashTarget(action.href)}>
        {action.label}
      </a>
    );
  }

  return (
    <Link className={className} href={action.href}>
      {action.label}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  context,
  primaryAction,
  secondaryActions = [],
  tags = []
}: PageHeaderProps) {
  const actions = ([primaryAction, ...secondaryActions].filter(Boolean) as HeaderAction[]).slice(0, 2);

  return (
    <header className="page-header">
      <div>
        <p className="page-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="header-context-row">
          {context ? <span className="reporting-context">{context}</span> : null}
          {tags.map((tag) => (
            <span className="context-tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      {actions.length > 0 ? (
        <div className="header-actions">
          {actions.map((action) => (
            <HeaderActionLink action={action} key={`${action.href}-${action.label}`} />
          ))}
        </div>
      ) : null}
    </header>
  );
}
