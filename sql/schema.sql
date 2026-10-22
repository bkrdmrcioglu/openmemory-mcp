-- OpenMemory MCP schema
-- Requires the pgvector extension (bundled in the pgvector/pgvector Docker image)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Embedding dimension matches the default embedding model (see src/embeddings.ts).
-- Change the dimension here and in src/embeddings.ts together if you switch models.
CREATE TABLE IF NOT EXISTS memories (
    id          BIGSERIAL PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    source_tool TEXT NOT NULL DEFAULT 'unknown',
    tags        TEXT[] NOT NULL DEFAULT '{}',
    embedding   vector(1536),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_project_idx ON memories (project_id, created_at DESC);

-- Approximate nearest-neighbour index for semantic search.
-- Built lazily; fine to run once there is meaningful data in the table.
CREATE INDEX IF NOT EXISTS memories_embedding_idx
    ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
