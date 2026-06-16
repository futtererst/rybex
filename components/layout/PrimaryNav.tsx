"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { demoUser, getDemoAccessibleModules } from "@/lib/d5o/demo-user";

export function PrimaryNav() {
  const pathname = usePathname();
  const navItems = getDemoAccessibleModules();

  return (
    <>
      <div className="demo-role-context" aria-label="Current demo role">
        <span>Demo role</span>
        <strong>{demoUser.title}</strong>
      </div>
      <nav className="primary-nav">
        {navItems.map((item) => {
          const active =
            item.href === "/command-center"
              ? pathname === "/" || pathname.startsWith("/command-center")
              : pathname.startsWith(item.href);
          const className = [
            "nav-link",
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
              title={item.canAccess ? item.label : "Limited for the current demo role"}
            >
              {item.label}
              {!item.canAccess ? <small>Limited</small> : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
