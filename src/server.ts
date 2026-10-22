import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { saveMemory, saveMemoryInput } from "./tools/saveMemory.js";
import { searchMemory, searchMemoryInput } from "./tools/searchMemory.js";
import { timeline, timelineInput } from "./tools/timeline.js";
import { listProjects } from "./tools/listProjects.js";

/** Builds a fresh MCP server instance with every OpenMemory tool registered.
 * Called once per connection in HTTP mode, once total in stdio mode. */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: "openmemory-mcp",
    version: "0.1.0",
  });

  server.tool(
    "save_memory",
    "Save a fact, decision, or note so any connected AI tool can recall it later.",
    saveMemoryInput,
    async (args) => saveMemory(args)
  );

  server.tool(
    "search_memory",
    "Semantically search saved memories for a project.",
    searchMemoryInput,
    async (args) => searchMemory(args)
  );

  server.tool(
    "memory_timeline",
    "List memories for a project in chronological order, optionally since a given date.",
    timelineInput,
    async (args) => timeline(args)
  );

  server.tool(
    "list_projects",
    "List every project that has stored memories, with counts.",
    {},
    async () => listProjects()
  );

  return server;
}
