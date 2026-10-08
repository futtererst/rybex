import rybexDefinition from "@/config/template-packs/d5o-prototype-lifecycle-rybex-v2.json";
import rotorkDefinition from "@/config/template-packs/d5o-prototype-lifecycle-rotork-v2.json";

export type LifecycleWorkspace = "rybex" | "rotork";

export type ConfiguredTransition = {
  right: string;
  label: string;
  role: string;
  outcome: string;
  from: string;
  to: string | null;
  requirements: { op: string; key?: string; right?: string; outcome?: string }[];
  type?: string;
};

export type LifecycleProfile = {
  name: string;
  version: string;
  workType: string;
  initialState: string;
  completeState: string;
  states: string[];
  transitions: ConfiguredTransition[];
};

function makeProfile(definition: typeof rybexDefinition | typeof rotorkDefinition): LifecycleProfile {
  const transitions = definition.transitions as ConfiguredTransition[];
  const states = [definition.workType.lifecycle.initialState];
  for (const transition of transitions) {
    if (!states.includes(transition.from)) states.push(transition.from);
    if (transition.to && !states.includes(transition.to)) states.push(transition.to);
  }
  return {
    name: definition.packName,
    version: definition.version,
    workType: definition.workType.label,
    initialState: definition.workType.lifecycle.initialState,
    completeState: definition.workType.lifecycle.completeState,
    states,
    transitions
  };
}

export const lifecycleProfiles: Record<LifecycleWorkspace, LifecycleProfile> = {
  rybex: makeProfile(rybexDefinition),
  rotork: makeProfile(rotorkDefinition)
};

export function transitionsAt(workspace: LifecycleWorkspace, state: string): ConfiguredTransition[] {
  return lifecycleProfiles[workspace].transitions.filter((transition) => transition.from === state);
}

export function stateFor(workspace: LifecycleWorkspace, stage: string, progress = 0): string {
  const profile = lifecycleProfiles[workspace];
  const aliases: Record<string, string> = workspace === "rotork" ? { "Rollout authorized": "Rollout tranche", "Lifecycle service": "Closed" } : {};
  const candidate = aliases[stage] ?? stage;
  if (profile.states.includes(candidate)) return candidate;
  const normalized = candidate.toLowerCase();
  const fuzzy = profile.states.find((state) => normalized.includes(state.toLowerCase()) || state.toLowerCase().includes(normalized));
  if (fuzzy) return fuzzy;
  const fallback = Math.min(profile.states.length - 1, Math.max(0, Math.round(progress / 20) - 1));
  return profile.states[fallback];
}

export function configuredTransitionsFor(workspace: LifecycleWorkspace, stage: string, progress = 0): ConfiguredTransition[] {
  return transitionsAt(workspace, stateFor(workspace, stage, progress));
}

export function requirementLabel(requirement: ConfiguredTransition["requirements"][number]): string {
  switch (requirement.op) {
    case "fact_equals": return `${requirement.key?.replaceAll("_", " ")} = required`;
    case "evidence_valid": return `${requirement.key?.replaceAll("-", " ")} evidence is valid`;
    case "decision_recorded_prior": return `${requirement.right?.replaceAll("-", " ")} decision: ${requirement.outcome?.replaceAll("-", " ")}`;
    case "exception_satisfies": return `${requirement.key?.replaceAll("_", " ")} passes or has an authorized exception`;
    case "state_equals": return `Work is at ${requirement.key}`;
    default: return requirement.op.replaceAll("_", " ");
  }
}

export function roleLabel(workspace: LifecycleWorkspace, role: string): string {
  const definitions = workspace === "rybex" ? rybexDefinition.roles : rotorkDefinition.roles;
  return definitions.find((item) => item.key === role)?.label ?? role.replaceAll("_", " ");
}
