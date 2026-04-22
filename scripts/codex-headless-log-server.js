const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.CODEX_HEADLESS_LOG_PORT || 18766);
const projectRoot = process.env.CODEX_HEADLESS_PROJECT_ROOT || process.cwd();
const telemetryDir = path.join(projectRoot, ".codex-headless", "telemetry");
const eventsPath = path.join(telemetryDir, "server-events.ndjson");
const latestPath = path.join(telemetryDir, "latest-event.json");

fs.mkdirSync(telemetryDir, { recursive: true });

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function appendEvent(event) {
  const enriched = {
    received_at: new Date().toISOString(),
    ...event,
  };
  fs.appendFileSync(eventsPath, `${JSON.stringify(enriched)}\n`, "utf8");
  fs.writeFileSync(latestPath, JSON.stringify(enriched, null, 2), "utf8");
  return enriched;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    writeJson(res, 200, {
      ok: true,
      service: "codex-headless-log-server",
      port,
      telemetryDir,
      eventsPath,
      latestPath,
      now: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && req.url === "/latest") {
    if (!fs.existsSync(latestPath)) {
      writeJson(res, 404, { ok: false, message: "No events yet." });
      return;
    }

    const content = fs.readFileSync(latestPath, "utf8");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(content);
    return;
  }

  if (req.method === "POST" && req.url === "/event") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const payload = raw ? JSON.parse(raw) : {};
        const saved = appendEvent(payload);
        writeJson(res, 201, { ok: true, data: saved });
      } catch (error) {
        writeJson(res, 400, { ok: false, message: error.message || "Invalid JSON payload." });
      }
    });
    return;
  }

  writeJson(res, 404, { ok: false, message: "Not Found" });
});

server.listen(port, "127.0.0.1", () => {
  appendEvent({
    type: "log_server_started",
    port,
    project_root: projectRoot,
    telemetry_dir: telemetryDir,
  });
  console.log(`codex-headless-log-server listening on http://127.0.0.1:${port}`);
});
