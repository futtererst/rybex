import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 0);

if (!port) {
  console.error("Scanner service requires a port argument.");
  process.exit(1);
}

const server = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/scan") {
    response.writeHead(404).end();
    return;
  }

  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const infected = body.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      status: infected ? "infected" : "clean",
      scanner: "foundation-0f-local-scanner",
      scannedAt: new Date().toISOString()
    }));
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`FOUNDATION_0F_SCANNER_READY ${port}\n`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
