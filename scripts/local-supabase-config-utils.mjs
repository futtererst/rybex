const portKeysBySection = {
  api: { port: "api" },
  db: { port: "db", shadow_port: "shadow" },
  "db.pooler": { port: "pooler" },
  studio: { port: "studio" },
  inbucket: { port: "inbucket", smtp_port: "smtp", pop3_port: "pop3" },
  local_smtp: { port: "inbucket", smtp_port: "smtp", pop3_port: "pop3" },
  analytics: { port: "analytics" },
};

export function rewriteSupabaseConfigForProject(config, projectId, ports) {
  if (!projectId || !/^[a-z0-9][a-z0-9_-]*$/i.test(projectId)) {
    throw new Error(`invalid Supabase project id: ${projectId}`);
  }

  const lines = String(config).split(/\r?\n/);
  let section = "";
  const rewritten = lines.map((line) => {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      return line;
    }
    if (/^\s*project_id\s*=/.test(line)) return `project_id = "${projectId}"`;
    const keyMatch = line.match(/^(\s*)([A-Za-z0-9_]+)(\s*=\s*)(\d+)(\s*)$/);
    if (!keyMatch) return line;
    const portName = portKeysBySection[section]?.[keyMatch[2]];
    if (!portName || ports[portName] === undefined) return line;
    return `${keyMatch[1]}${keyMatch[2]}${keyMatch[3]}${ports[portName]}${keyMatch[5]}`;
  });

  return rewritten.join("\n");
}

export function readSupabaseConfigPorts(config) {
  const ports = {};
  let section = "";
  for (const line of String(config).split(/\r?\n/)) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const keyMatch = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(\d+)\s*$/);
    if (!keyMatch) continue;
    const portName = portKeysBySection[section]?.[keyMatch[1]];
    if (portName) ports[portName] = keyMatch[2];
  }
  return ports;
}
