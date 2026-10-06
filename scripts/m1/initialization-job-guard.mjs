export function identifyInitializationJob(data, project, networkIds) {
  const fail = () => { throw new Error('Unqualified initialization job'); };
  if (data.Labels?.['com.supabase.cli.project'] !== project) fail();
  const h = data.HostConfig ?? {};
  if (!networkIds.has(h.NetworkMode)) fail();
  if (h.Privileged || h.PidMode === 'host' || h.IpcMode === 'host' || h.UsernsMode === 'host' || h.CapAdd?.length || h.Devices?.length || h.Binds?.length || h.Mounts?.length || Object.keys(h.PortBindings ?? {}).length || Object.keys(data.Volumes ?? {}).length) fail();
  if (Object.keys(data.NetworkingConfig?.EndpointsConfig ?? {}).some(n => !networkIds.has(n))) fail();
  const env = Object.fromEntries((data.Env ?? []).map(v => { const i=v.indexOf('='); return [v.slice(0,i),v.slice(i+1)]; }));
  const db = `supabase_db_${project}`;
  const urlTargetsDb = value => { try { const u = new URL(value); return u.hostname===db && u.port==='5432' && u.pathname==='/postgres' && ['postgres:','postgresql:'].includes(u.protocol); } catch { return false; } };
  const cmd = data.Cmd ?? [];
  if (data.Entrypoint?.length) fail();
  if (data.Image==='public.ecr.aws/supabase/realtime:v2.112.6' && cmd.length===3 && cmd[0]==='/app/bin/realtime' && cmd[1]==='eval' && /^\{:ok, _\} = Application.ensure_all_started\(:realtime\)\n\{:ok, _\} = Realtime.Tenants.health_check\("[a-zA-Z0-9_-]+"\)$/.test(cmd[2]) && env.DB_HOST===db && env.DB_PORT==='5432' && env.DB_NAME==='postgres') return 'realtime';
  if (data.Image==='public.ecr.aws/supabase/storage-api:v1.62.5' && JSON.stringify(cmd)===JSON.stringify(['node','dist/scripts/migrate-call.js']) && urlTargetsDb(env.DATABASE_URL)) return 'storage';
  if (data.Image==='public.ecr.aws/supabase/gotrue:v2.192.0' && JSON.stringify(cmd)===JSON.stringify(['gotrue','migrate']) && urlTargetsDb(env.GOTRUE_DB_DATABASE_URL)) return 'auth';
  fail();
}
