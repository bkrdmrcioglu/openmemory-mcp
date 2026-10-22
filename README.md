# OpenMemory

**One shared memory for all your AI coding tools — self-hosted, open source.**

Every AI assistant forgets everything the moment you switch tools. Explain your project to one, open another, and you start from zero. OpenMemory is a small server you run yourself: your AI tools write what they learn into it and read it back later, no matter which tool you are using.

![OpenMemory web UI](docs/screenshot.png)

- **Works with any MCP tool** — Cursor, VS Code, and every other client that speaks the [Model Context Protocol](https://modelcontextprotocol.io)
- **Your data stays yours** — everything lives in a Postgres database on your own machine or server
- **Semantic search** — ask in your own words, get the right note back
- **Web UI included** — browse, search, add, and delete memories in the browser
- **One command to run** — Docker Compose brings up the server and database together

## How it works

```
 Cursor ─┐
 VS Code ┼──►  OpenMemory  ──►  Postgres + pgvector
 others ─┘    (your server)      (your data)
```

1. You tell your AI tool something worth keeping: *"Remember that payments go through Stripe."*
2. The tool calls OpenMemory's `save_memory` and the note is stored.
3. Days later, in any connected tool, you ask: *"How do payments work here?"* The tool calls `search_memory` and gets the note back.

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) installed. Then:

```bash
git clone https://github.com/bkrdmrcioglu/openmemory-mcp
cd openmemory-mcp
OPENMEMORY_TOKEN=pick-a-long-random-password docker compose up -d
```

That's it. Open **http://localhost:3333** and sign in with the token you picked.

> Generate a strong token with `openssl rand -hex 24`. Anyone with the token can read and write your memories.

## Connect your AI tool

In the web UI, click **Connect a tool** to get ready-to-paste config with your server's address filled in. Or copy from here, replacing `YOUR_TOKEN`:

**Cursor** — Settings → MCP → *Add new MCP server* (edits `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "openmemory": {
      "url": "http://localhost:3333/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

**VS Code** — create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "openmemory": {
      "type": "http",
      "url": "http://localhost:3333/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

**Any other MCP client** — endpoint `http://localhost:3333/mcp` (Streamable HTTP), header `Authorization: Bearer YOUR_TOKEN`.

Then just talk to your assistant:

- *"Remember that we deploy with Docker Compose on a single VPS."*
- *"What did we decide about the database?"*
- *"Show me everything we saved this week for this project."*

## Tools

| Tool | What it does |
|---|---|
| `save_memory` | Store a fact, decision, or note for a project |
| `search_memory` | Find notes by meaning, not just exact words |
| `memory_timeline` | List a project's notes newest first, optionally since a date |
| `list_projects` | All projects with their note counts |
| `delete_memory` | Remove an outdated or wrong note |

## Running on a server

Run the same `docker compose up -d` on any VPS and put it behind your reverse proxy (Caddy, Nginx, Traefik, Coolify, …) with HTTPS. Point your tools at `https://your-domain/mcp`. One server can be shared by your whole team — everyone's tools see the same project memory.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENMEMORY_TOKEN` | — | Access token for the API, MCP endpoint, and web UI. Required in `http` mode |
| `OPENMEMORY_ALLOW_NO_AUTH` | `false` | Set to `true` to run `http` mode without a token (trusted networks only) |
| `OPENAI_API_KEY` | — | Optional. Enables high-quality semantic search (see below) |
| `DATABASE_URL` | set by compose | Postgres connection string (pgvector required) |
| `TRANSPORT` | `http` in compose | `http` for a network server, `stdio` for a local process |
| `PORT` | `3333` | HTTP port |

## FAQ

**Do I need an OpenAI (or any AI) API key?**
No. Without one, search matches on shared words — good enough to try it out. Add `OPENAI_API_KEY` and search understands meaning: *"backup"* finds a note about *"database snapshots"*. Your AI tools use their own accounts as usual; OpenMemory never calls a chat model.

**Where is my data?**
In the `openmemory_db` Docker volume on the machine running the server. Nothing is sent anywhere, except note text to the embedding API if you set `OPENAI_API_KEY`.

**Can I run it without Docker?**
Yes: Node.js 20+ and Postgres with the [pgvector](https://github.com/pgvector/pgvector) extension.

```bash
npm install && npm run build
DATABASE_URL=postgres://user:pass@localhost:5432/openmemory TRANSPORT=http OPENMEMORY_TOKEN=... npm start
```

## Development

```bash
npm install
npm run build
DATABASE_URL=postgres://... npm test   # end-to-end test over stdio
```

## Roadmap

- Local embedding models (Ollama) for fully offline semantic search
- Automatic deduplication and summarisation of old memories
- Multiple tokens with per-project access
- Import / export

Ideas and pull requests are welcome.

## License

MIT
