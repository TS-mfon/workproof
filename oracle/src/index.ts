import { createServer } from "node:http";
import { env } from "./config.js";
import { startArbitrumListener } from "./listeners/arbitrum.js";
import { pollGenLayerOnce, startGenLayerPoller } from "./listeners/genlayer.js";
import { deadlineCheckOnce, startDeadlineChecker } from "./crons/deadlineChecker.js";

const stopArbitrum = startArbitrumListener();
const stopGenLayer = startGenLayerPoller();
const stopDeadline = startDeadlineChecker();

const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "workproof-oracle", time: new Date().toISOString() }));
    return;
  }
  if (req.method === "POST" && req.url === "/admin/force-deadline-check") {
    await deadlineCheckOnce();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "POST" && req.url === "/admin/re-poll-genlayer") {
    await pollGenLayerOnce();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(env.ORACLE_HTTP_PORT, () => {
  console.log(`WorkProof oracle listening on :${env.ORACLE_HTTP_PORT}`);
});

function shutdown() {
  stopArbitrum();
  stopGenLayer();
  stopDeadline();
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
