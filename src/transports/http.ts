import express, { type NextFunction, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildServer } from "../server.js";
import * as store from "../store.js";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");

export function assertHttpAuthConfigured(): void {
  if (!process.env.OPENMEMORY_TOKEN && process.env.OPENMEMORY_ALLOW_NO_AUTH !== "true") {
    throw new Error(
      "OPENMEMORY_TOKEN is not set. Refusing to expose memories without authentication. " +
        "Set OPENMEMORY_TOKEN (e.g. `openssl rand -hex 24`), or set OPENMEMORY_ALLOW_NO_AUTH=true " +
        "if this server is only reachable from a trusted network."
    );
  }
}

/** For self-hosted, network-accessible use: multiple AI tools (possibly on
 * different machines) connect to the same OpenMemory instance over HTTP.
 * Stateless mode — one server+transport per request, no session affinity
 * required, so it sits comfortably behind any reverse proxy. */
export async function runHttp(port: number): Promise<void> {
  const app = express();
  app.use(express.json());

  assertHttpAuthConfigured();
  const authToken = process.env.OPENMEMORY_TOKEN;

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (authToken && req.headers.authorization !== `Bearer ${authToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };

  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
      fn(req, res).catch(next);

  app.post("/mcp", requireAuth, async (req, res) => {
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

  // REST API backing the web UI.
  const api = express.Router();
  api.use(requireAuth);

  api.get(
    "/projects",
    wrap(async (_req, res) => res.json(await store.listProjects()))
  );

  api.get(
    "/projects/:project/memories",
    wrap(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const project = String(req.params.project);
      res.json(q ? await store.searchMemories(project, q, limit) : await store.listMemories(project, undefined, limit));
    })
  );

  api.post(
    "/projects/:project/memories",
    wrap(async (req, res) => {
      const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content) {
        res.status(400).json({ error: "content is required" });
        return;
      }
      const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];
      res.status(201).json(
        await store.addMemory({ project: String(req.params.project), content, tags, sourceTool: "web-ui" })
      );
    })
  );

  api.delete(
    "/memories/:id",
    wrap(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid id" });
        return;
      }
      res.status((await store.deleteMemory(id)) ? 204 : 404).end();
    })
  );

  api.delete(
    "/projects/:project",
    wrap(async (req, res) => {
      res.status((await store.deleteProject(String(req.params.project))) ? 204 : 404).end();
    })
  );

  app.use("/api", api);

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  // The UI page holds no data; everything it shows comes from the token-protected API.
  app.use(express.static(publicDir));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Request failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  });

  app.listen(port, () => {
    console.log(`openmemory-mcp listening on http://0.0.0.0:${port} (MCP at /mcp, UI at /)`);
  });
}
