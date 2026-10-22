# OpenMemory MCP

**An open, self-hosted, vendor-neutral memory layer for AI coding tools.**

Every AI assistant keeps its own private memory. Teach one tool about your project, switch to another, and you start from zero. OpenMemory fixes that: one memory server you own, shared by every tool that speaks the [Model Context Protocol](https://modelcontextprotocol.io).

- **Vendor-neutral** — any MCP client can read and write the same memories
- **Self-hosted** — your data stays on your own server
- **Semantic search** — Postgres + pgvector, no extra vector database
- **Two transports** — `stdio` for local use, `http` for a shared network service

## Tools

| Tool | What it does |
|---|---|
| `save_memory` | Store a fact, decision, or note for a project |
| `search_memory` | Semantic search within a project's memories |
| `memory_timeline` | Chronological list, optionally since a date |
| `list_projects` | All projects with memory counts |

## Quick start (Docker, shared server)

```bash
git clone https://github.com/<you>/openmemory-mcp
cd openmemory-mcp
OPENMEMORY_TOKEN=change-me docker compose up -d
```

The MCP endpoint is now at `http://localhost:3333/mcp`. Point any HTTP-capable MCP client at it with the header `Authorization: Bearer change-me`.

## Local use (stdio)

```bash
npm install && npm run build
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "openmemory": {
      "command": "node",
      "args": ["/path/to/openmemory-mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://openmemory:openmemory@localhost:5432/openmemory"
      }
    }
  }
}
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string (pgvector required) |
| `TRANSPORT` | `stdio` | `stdio` or `http` |
| `PORT` | `3333` | HTTP port |
| `OPENMEMORY_TOKEN` | — | Bearer token required on `/mcp` when set |
| `OPENAI_API_KEY` | — | Enables real embeddings; otherwise a local hashing fallback is used |

> The local fallback embedding works offline and is fine for trying things out, but semantic quality is limited. Set an embedding key for real use.

## Roadmap

- Pluggable local embedding models (Ollama)
- Memory deduplication and summarisation
- Per-project access control and multiple tokens
- Web UI for browsing and editing memories
- Import/export (JSON) for moving between instances

## License

MIT
