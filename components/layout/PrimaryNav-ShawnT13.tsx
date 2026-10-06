"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { demoUser, getDemoAccessibleModules } from "@/lib/d5o/demo-user";
import { canAccessModule, type CanonicalWorkspaceRole, type RybexModuleId } from "@/lib/d5o/rbac";
import { primaryNavItems } from "@/lib/d5o/modules";

export function PrimaryNav({
  productionMode = false,
  currentRole,
  currentRoleLabel,
  currentUserName
}: {
  productionMode?: boolean;
  currentRole?: CanonicalWorkspaceRole;
  currentRoleLabel?: string;
  currentUserName?: string;
}) {
  const pathname = usePathname();
  const navItems = currentRole
    ? primaryNavItems.map((item) => {
        const moduleId = item.href.replace("/", "") || "command-center";
        const normalizedModuleId = moduleId === "command-center" ? "command-center" : moduleId;
        return {
          ...item,
          canAccess: canAccessModule(currentRole, normalizedModuleId as RybexModuleId)
        };
      })
    : getDemoAccessibleModules();
  const visibleRoleLabel = currentRoleLabel ?? demoUser.title;
  const visibleUserName = currentUserName ?? demoUser.name;
  const coreHrefs = new Set([
    "/command-center",
    "/field-execution",
    "/rfis-submittals",
    "/changes",
    "/billing",
    "/closeout"
  ]);
  const coreItems = navItems.filter((item) => coreHrefs.has(item.href));
  const otherItems = productionMode ? [] : navItems.filter((item) => !coreHrefs.has(item.href));
  const activeItem = navItems.find((item) =>
    item.href === "/command-center"
      ? pathname === "/" || pathname.startsWith("/command-center")
      : pathname.startsWith(item.href)
  );

  const renderLink = (item: (typeof navItems)[number], contained = false) => {
    const active =
      item.href === "/command-center"
        ? pathname === "/" || pathname.startsWith("/command-center")
        : pathname.startsWith(item.href);
    const className = [
      "nav-link",
      contained ? "nav-link-contained" : "",
      active ? "nav-link-active" : "",
      item.canAccess ? "" : "nav-link-limited"
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Link
        aria-label={item.canAccess ? item.label : `${item.label} - admin or alternate role access`}
        className={className}
        href={item.href}
        key={item.href}
        title={item.canAccess ? item.label : "Limited for the current role"}
      >
        {item.label}
        {!item.canAccess ? <small>Limited</small> : null}
      </Link>
    );
  };

  return (
    <>
      <div className="desktop-nav-shell">
        <div className="demo-role-context" aria-label="Current role">
          <span>Current role</span>
          <strong>{visibleRoleLabel}</strong>
          <small>{visibleUserName}</small>
        </div>
        <nav className="primary-nav">
          {coreItems.map((item) => renderLink(item))}
          <div className="nav-group-label">Other modules</div>
          {otherItems.map((item) => renderLink(item, true))}
        </nav>
      </div>
      <details className="mobile-nav-menu" data-qa="mobile-nav-menu">
        <summary>
          <span>Menu</span>
          <strong>{activeItem?.label ?? "Command Center"}</strong>
        </summary>
        <div className="mobile-nav-panel">
          <div className="demo-role-context" aria-label="Current role">
            <span>Current role</span>
            <strong>{visibleRoleLabel}</strong>
            <small>{visibleUserName}</small>
          </div>
          <nav className="primary-nav">
            {coreItems.map((item) => renderLink(item))}
            <div className="nav-group-label">Other modules</div>
            {otherItems.map((item) => renderLink(item, true))}
          </nav>
        </div>
      </details>
    </>
  );
}
