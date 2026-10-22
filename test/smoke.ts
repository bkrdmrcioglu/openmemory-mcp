// End-to-end smoke test: spawns the built server over stdio, exercises every
// tool through a real MCP client, and fails loudly on any mismatch.
// Usage:
//   stdio: DATABASE_URL=... npx tsx test/smoke.ts
//   http:  SMOKE_URL=http://localhost:3333/mcp OPENMEMORY_TOKEN=... npx tsx test/smoke.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import assert from "node:assert/strict";

type TextResult = { content: { type: string; text: string }[] };

const project = `smoke-${Date.now()}`;

const url = process.env.SMOKE_URL;
const token = process.env.OPENMEMORY_TOKEN;
const transport = url
  ? new StreamableHTTPClientTransport(new URL(url), {
      requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    })
  : new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
      env: { ...process.env, TRANSPORT: "stdio" } as Record<string, string>,
    });
console.log(`transport: ${url ? `http (${url})` : "stdio"}`);
const client = new Client({ name: "smoke-test", version: "0.0.0" });
await client.connect(transport);

const text = (r: unknown) => (r as TextResult).content[0].text;

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
assert.deepEqual(names, ["list_projects", "memory_timeline", "save_memory", "search_memory"]);
console.log("✓ tools listed:", names.join(", "));

for (const content of [
  "The checkout service uses Stripe webhooks for payment confirmation.",
  "Database backups go to the Cloudflare R2 bucket every Sunday at 03:00 UTC.",
  "Frontend is built with Next.js and deployed through Coolify.",
]) {
  const r = await client.callTool({
    name: "save_memory",
    arguments: { project, content, source_tool: "smoke-test", tags: ["test"] },
  });
  assert.match(text(r), /Saved memory #\d+/);
}
console.log("✓ saved 3 memories");

const search = text(
  await client.callTool({
    name: "search_memory",
    arguments: { project, query: "where do database backups go", limit: 1 },
  })
);
assert.match(search, /Cloudflare R2/);
console.log("✓ semantic search returned the backup memory first");

const tl = text(await client.callTool({ name: "memory_timeline", arguments: { project } }));
assert.equal((tl.match(/\[smoke-test\]/g) ?? []).length, 3);
console.log("✓ timeline lists all 3 memories");

const projects = text(await client.callTool({ name: "list_projects", arguments: {} }));
assert.match(projects, new RegExp(`${project} — 3 memories`));
console.log("✓ list_projects shows the project with 3 memories");

const empty = text(
  await client.callTool({ name: "search_memory", arguments: { project: "does-not-exist", query: "x" } })
);
assert.match(empty, /No memories found/);
console.log("✓ empty project handled");

await client.close();
console.log("\nAll smoke tests passed.");
