import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const cliEntrypoint = resolve(root, "node_modules", "supabase", "dist", "supabase.js");
const args = process.argv.slice(2);
const dockerPipe = "//./pipe/docker_engine";
const intercepted = [];

if (args[0] !== "start") {
  throw new Error("The loopback Docker API adapter is restricted to local Supabase start commands.");
}
if (process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PROJECT_REF) {
  throw new Error("Remote Supabase authority is prohibited by the local-stack adapter.");
}

const server = createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let body = Buffer.concat(chunks);
    const isCreate = request.method === "POST" && /\/containers\/create(?:\?|$)/.test(request.url ?? "");
    if (isCreate) {
      const payload = JSON.parse(body.toString("utf8") || "{}");
      const bindings = payload.HostConfig?.PortBindings ?? {};
      const plan = [];
      for (const [containerPort, mappings] of Object.entries(bindings)) {
        if (!Array.isArray(mappings) || mappings.length === 0) {
          throw new Error(`Published container port ${containerPort} omitted an explicit host mapping.`);
        }
        for (const mapping of mappings) {
          if (!mapping || !String(mapping.HostPort ?? "").trim()) {
            throw new Error(`Published container port ${containerPort} omitted its host port.`);
          }
          if (String(mapping.HostPort) === "55329") throw new Error("Pooler port 55329 must remain unpublished.");
          mapping.HostIp = "127.0.0.1";
          plan.push({ containerPort, hostIp: mapping.HostIp, hostPort: String(mapping.HostPort) });
        }
      }
      intercepted.push({ path: request.url, name: new URL(request.url, "http://docker.local").searchParams.get("name"), bindings: plan });
      body = Buffer.from(JSON.stringify(payload));
    }

    const headers = { ...request.headers, host: "docker", "content-length": String(body.length) };
    delete headers["transfer-encoding"];
    const upstream = httpRequest({
      socketPath: dockerPipe,
      path: request.url,
      method: request.method,
      headers,
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 500, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on("error", (error) => {
      if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
      response.end(`Docker loopback adapter upstream error: ${error.message}`);
    });
    upstream.end(body);
  } catch (error) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to establish local Docker binding adapter.");
  const childEnv = {
    ...process.env,
    DOCKER_HOST: `tcp://127.0.0.1:${address.port}`,
    SUPABASE_ACCESS_TOKEN: undefined,
    SUPABASE_PROJECT_REF: undefined,
  };
  delete childEnv.SUPABASE_ACCESS_TOKEN;
  delete childEnv.SUPABASE_PROJECT_REF;
  const child = spawn(process.execPath, [cliEntrypoint, ...args], {
    cwd: root,
    env: childEnv,
    stdio: ["inherit", "inherit", "inherit"],
    shell: false,
  });
  child.on("exit", (code, signal) => {
    const published = intercepted.flatMap((entry) => entry.bindings);
    const invalid = published.some((entry) => entry.hostIp !== "127.0.0.1" || entry.hostPort === "55329");
    process.stderr.write(`[loopback-docker-adapter] creates=${intercepted.length}; published=${published.length}; explicitLoopback=${!invalid}\n`);
    const exitCode = code ?? (signal ? 1 : 0);
    server.close(() => process.exit(exitCode));
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  });
  child.on("error", (error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    server.close(() => process.exit(1));
  });
});

server.on("clientError", (error, socket) => {
  socket.end(`HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n${error.message}`);
});
