// End-to-end smoke test: exercises every MCP tool through a real MCP client
// (and, in http mode, the REST API behind the web UI), then removes its own
// test data so it is safe to run against a live instance.
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
const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
const transport = url
  ? new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: authHeaders } })
  : new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
      env: { ...process.env, TRANSPORT: "stdio" } as Record<string, string>,
    });
console.log(`transport: ${url ? `http (${url})` : "stdio"}`);
const client = new Client({ name: "smoke-test", version: "0.0.0" });
await client.connect(transport);

const text = (r: unknown) => (r as TextResult).content[0].text;
const savedIds: number[] = [];

try {
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["delete_memory", "list_projects", "memory_timeline", "save_memory", "search_memory"]);
  console.log("✓ tools listed:", names.join(", "));

  for (const content of [
    "The checkout service uses Stripe webhooks for payment confirmation.",
    "Database backups go to the Cloudflare R2 bucket every Sunday at 03:00 UTC.",
    "Frontend is built with Next.js and deployed through Coolify.",
  ]) {
    const r = text(
      await client.callTool({
        name: "save_memory",
        arguments: { project, content, source_tool: "smoke-test", tags: ["test"] },
      })
    );
    const match = r.match(/Saved memory #(\d+)/);
    assert.ok(match, r);
    savedIds.push(Number(match[1]));
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

  const deleted = text(await client.callTool({ name: "delete_memory", arguments: { id: savedIds[0] } }));
  assert.equal(deleted, `Deleted memory #${savedIds[0]}.`);
  const missing = text(await client.callTool({ name: "delete_memory", arguments: { id: savedIds[0] } }));
  assert.match(missing, /not found/);
  savedIds.shift();
  console.log("✓ delete_memory removes a memory and reports missing ids");

  if (url) {
    const base = new URL("/api", url).toString();
    const unauth = await fetch(`${base}/projects`);
    assert.equal(unauth.status, token ? 401 : 200);
    const list = (await (await fetch(`${base}/projects`, { headers: authHeaders })).json()) as {
      id: string;
      memory_count: number;
    }[];
    assert.equal(list.find((p) => p.id === project)?.memory_count, 2);
    const mems = (await (
      await fetch(`${base}/projects/${project}/memories?q=deployed%20through%20coolify`, { headers: authHeaders })
    ).json()) as { content: string }[];
    assert.match(mems[0].content, /Coolify/);
    const page = await fetch(new URL("/", url));
    assert.match(await page.text(), /<title>OpenMemory<\/title>/);
    console.log("✓ REST API and web UI respond (auth enforced, search works)");
  }
} finally {
  for (const id of savedIds) {
    await client.callTool({ name: "delete_memory", arguments: { id } });
  }
  const after = text(await client.callTool({ name: "list_projects", arguments: {} }));
  assert.doesNotMatch(after, new RegExp(project));
  await client.close();
}

console.log("✓ test data cleaned up");
console.log("\nAll smoke tests passed.");
