import { OperatingActionCard } from "./OperatingActionCard";
import type {
  OperatingActionItem as OperatingActionItemType,
  RybexProject
} from "@/lib/d5o/types";

type OperatingActionItemProps = {
  action: OperatingActionItemType;
  project?: RybexProject;
};

export function OperatingActionItem({ action, project }: OperatingActionItemProps) {
  return <OperatingActionCard action={action} projectName={project?.name ?? "Project not found"} />;
}
