#!/usr/bin/env node
import "dotenv/config";
import { ensureSchema } from "./db.js";
import { runStdio } from "./transports/stdio.js";
import { runHttp, assertHttpAuthConfigured } from "./transports/http.js";

async function main() {
  const transport = process.env.TRANSPORT ?? "stdio";

  // Fail on unsafe configuration before touching the database.
  if (transport === "http") assertHttpAuthConfigured();

  await ensureSchema();

  if (transport === "http") {
    await runHttp(Number(process.env.PORT ?? 3333));
  } else {
    await runStdio();
  }
}

main().catch((err) => {
  console.error("openmemory-mcp failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
