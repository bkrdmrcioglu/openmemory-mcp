#!/usr/bin/env node
import "dotenv/config";
import { ensureSchema } from "./db.js";
import { runStdio } from "./transports/stdio.js";
import { runHttp } from "./transports/http.js";

async function main() {
  await ensureSchema();

  const transport = process.env.TRANSPORT ?? "stdio";

  if (transport === "http") {
    const port = Number(process.env.PORT ?? 3333);
    await runHttp(port);
  } else {
    await runStdio();
  }
}

main().catch((err) => {
  console.error("openmemory-mcp failed to start:", err);
  process.exit(1);
});
