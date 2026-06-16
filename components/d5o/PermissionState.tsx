import type { UserRole } from "@/lib/d5o/types";

type PermissionStateProps = {
  role: UserRole;
  moduleLabel: string;
  message?: string;
};

export function PermissionState({ role, moduleLabel, message }: PermissionStateProps) {
  return (
    <section className="state-panel state-permission">
      <p className="eyebrow">Role Limited</p>
      <h3>{moduleLabel} access is controlled</h3>
      <p>
        {message ??
          `The demo role ${role.replaceAll("_", " ")} does not have full access to this operating area.`}
      </p>
    </section>
  );
}
