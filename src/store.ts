import { pool, ensureProject } from "./db.js";
import { embed } from "./embeddings.js";

export interface Memory {
  id: number;
  project_id: string;
  content: string;
  source_tool: string;
  tags: string[];
  created_at: Date;
  similarity?: number;
}

export interface ProjectSummary {
  id: string;
  memory_count: number;
  created_at: Date;
  last_memory_at: Date | null;
}

function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function addMemory(input: {
  project: string;
  content: string;
  tags?: string[];
  sourceTool?: string;
}): Promise<Memory> {
  await ensureProject(input.project);
  const embedding = await embed(input.content);
  const result = await pool.query<Memory>(
    `INSERT INTO memories (project_id, content, source_tool, tags, embedding)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, project_id, content, source_tool, tags, created_at`,
    [input.project, input.content, input.sourceTool ?? "unknown", input.tags ?? [], toVectorLiteral(embedding)]
  );
  return result.rows[0];
}

export async function searchMemories(project: string, query: string, limit = 5): Promise<Memory[]> {
  const queryEmbedding = await embed(query);
  const result = await pool.query<Memory>(
    `SELECT id, project_id, content, source_tool, tags, created_at,
            1 - (embedding <=> $2) AS similarity
     FROM memories
     WHERE project_id = $1
     ORDER BY embedding <=> $2
     LIMIT $3`,
    [project, toVectorLiteral(queryEmbedding), limit]
  );
  return result.rows;
}

export async function listMemories(project: string, since?: string, limit = 50): Promise<Memory[]> {
  const result = await pool.query<Memory>(
    `SELECT id, project_id, content, source_tool, tags, created_at
     FROM memories
     WHERE project_id = $1
       AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
     ORDER BY created_at DESC
     LIMIT $3`,
    [project, since ?? null, limit]
  );
  return result.rows;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const result = await pool.query<ProjectSummary>(
    `SELECT p.id, p.created_at, count(m.id)::int AS memory_count, max(m.created_at) AS last_memory_at
     FROM projects p
     LEFT JOIN memories m ON m.project_id = p.id
     GROUP BY p.id, p.created_at
     ORDER BY max(m.created_at) DESC NULLS LAST, p.created_at DESC`
  );
  return result.rows;
}

/** Deletes one memory. Removes its project too once the project is empty,
 * so projects never linger as empty shells. Returns false if not found. */
export async function deleteMemory(id: number): Promise<boolean> {
  const result = await pool.query<{ project_id: string }>(
    `DELETE FROM memories WHERE id = $1 RETURNING project_id`,
    [id]
  );
  if (result.rowCount === 0) return false;
  await pool.query(
    `DELETE FROM projects p WHERE p.id = $1 AND NOT EXISTS (SELECT 1 FROM memories m WHERE m.project_id = p.id)`,
    [result.rows[0].project_id]
  );
  return true;
}

export async function deleteProject(project: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM projects WHERE id = $1`, [project]);
  return (result.rowCount ?? 0) > 0;
}
