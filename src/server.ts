import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as store from "./store.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

/** Builds a fresh MCP server instance with every OpenMemory tool registered.
 * Called once per connection in HTTP mode, once total in stdio mode. */
export function buildServer(): McpServer {
  const server = new McpServer({ name: "openmemory-mcp", version: "0.2.0" });

  server.tool(
    "save_memory",
    "Save a fact, decision, or note so any connected AI tool can recall it later.",
    {
      project: z.string().min(1).describe("Project identifier shared across tools, e.g. a repo name"),
      content: z.string().min(1).describe("The fact, decision, or note to remember"),
      tags: z.array(z.string()).optional().describe("Optional labels, e.g. ['architecture', 'bug']"),
      source_tool: z.string().optional().describe("Name of the calling AI tool, e.g. 'cursor', 'vscode'"),
    },
    async ({ project, content, tags, source_tool }) => {
      const m = await store.addMemory({ project, content, tags, sourceTool: source_tool });
      return text(`Saved memory #${m.id} for project "${project}" at ${m.created_at.toISOString()}.`);
    }
  );

  server.tool(
    "search_memory",
    "Semantically search saved memories for a project.",
    {
      project: z.string().min(1).describe("Project identifier to search within"),
      query: z.string().min(1).describe("Natural-language search query"),
      limit: z.number().int().min(1).max(50).optional().describe("Max results, default 5"),
    },
    async ({ project, query, limit }) => {
      const rows = await store.searchMemories(project, query, limit);
      if (rows.length === 0) return text(`No memories found for project "${project}".`);
      return text(
        rows
          .map(
            (m) =>
              `#${m.id} (${((m.similarity ?? 0) * 100).toFixed(1)}% match, ${m.created_at.toISOString()})\n${m.content}`
          )
          .join("\n\n")
      );
    }
  );

  server.tool(
    "memory_timeline",
    "List memories for a project in chronological order, optionally since a given date.",
    {
      project: z.string().min(1).describe("Project identifier"),
      since: z.string().optional().describe("ISO date to list memories from, e.g. '2026-09-01'"),
      limit: z.number().int().min(1).max(200).optional().describe("Max results, default 50"),
    },
    async ({ project, since, limit }) => {
      const rows = await store.listMemories(project, since, limit);
      if (rows.length === 0) return text(`No memories found for project "${project}".`);
      return text(
        rows.map((m) => `${m.created_at.toISOString()} [${m.source_tool}] #${m.id}\n${m.content}`).join("\n\n")
      );
    }
  );

  server.tool("list_projects", "List every project that has stored memories, with counts.", {}, async () => {
    const rows = await store.listProjects();
    if (rows.length === 0) return text("No projects yet.");
    return text(
      rows.map((p) => `${p.id} — ${p.memory_count} memories (since ${p.created_at.toISOString()})`).join("\n")
    );
  });

  server.tool(
    "delete_memory",
    "Delete a single memory by its id, e.g. when it is outdated or wrong.",
    { id: z.number().int().positive().describe("Memory id, as shown in search or timeline results") },
    async ({ id }) => text((await store.deleteMemory(id)) ? `Deleted memory #${id}.` : `Memory #${id} not found.`)
  );

  return server;
}
