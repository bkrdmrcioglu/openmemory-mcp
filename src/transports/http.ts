import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "../server.js";

/** For self-hosted, network-accessible use: multiple AI tools (possibly on
 * different machines) connect to the same OpenMemory instance over HTTP.
 * Stateless mode — one server+transport per request, no session affinity
 * required, so it sits comfortably behind any reverse proxy (incl. the
 * Traefik proxy Coolify already runs). */
export async function runHttp(port: number): Promise<void> {
  const app = express();
  app.use(express.json());

  const authToken = process.env.OPENMEMORY_TOKEN;

  app.post("/mcp", async (req, res) => {
    if (authToken) {
      const header = req.headers.authorization;
      if (header !== `Bearer ${authToken}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("Error handling MCP request:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Stateless server: GET/DELETE session semantics are not supported.
  app.get("/mcp", (_req, res) => res.status(405).json({ error: "Method not allowed" }));
  app.delete("/mcp", (_req, res) => res.status(405).json({ error: "Method not allowed" }));

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  app.listen(port, () => {
    console.log(`openmemory-mcp listening on http://0.0.0.0:${port}/mcp`);
  });
}
