"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getPrimaryNavGroups,
  getPrimaryNavItems,
  getVisibleRoleContext,
  isPrimaryNavItemActive,
  type PrimaryNavItem,
  type PrimaryNavProps
} from "./primary-nav-model";

export type { PrimaryNavProps } from "./primary-nav-model";

export function PrimaryNav({
  productionMode = false,
  currentRole,
  currentRoleLabel,
  currentUserName
}: PrimaryNavProps) {
  const pathname = usePathname();
  const navItems = getPrimaryNavItems(currentRole);
  const { coreItems, otherItems } = getPrimaryNavGroups(navItems, productionMode);
  const { roleLabel, userName } = getVisibleRoleContext({
    productionMode,
    currentRoleLabel,
    currentUserName
  });
  const activeItem = navItems.find((item) => isPrimaryNavItemActive(pathname, item.href));

  function renderLink(item: PrimaryNavItem, contained = false) {
    const active = isPrimaryNavItemActive(pathname, item.href);
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
  }

  return (
    <>
      <div className="desktop-nav-shell">
        <div className="demo-role-context" aria-label="Current role">
          <span>Current role</span>
          <strong>{roleLabel}</strong>
          <small>{userName}</small>
        </div>
        <nav className="primary-nav">
          {coreItems.map((item) => renderLink(item))}
          {otherItems.length > 0 ? <div className="nav-group-label">Other modules</div> : null}
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
            <strong>{roleLabel}</strong>
            <small>{userName}</small>
          </div>
          <nav className="primary-nav">
            {coreItems.map((item) => renderLink(item))}
            {otherItems.length > 0 ? <div className="nav-group-label">Other modules</div> : null}
            {otherItems.map((item) => renderLink(item, true))}
          </nav>
        </div>
      </details>
    </>
  );
}
