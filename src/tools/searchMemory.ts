import { z } from "zod";
import { pool } from "../db.js";
import { embed } from "../embeddings.js";
import { toVectorLiteral } from "./saveMemory.js";

export const searchMemoryInput = {
  project: z.string().min(1).describe("Project identifier to search within"),
  query: z.string().min(1).describe("Natural-language search query"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results, default 5"),
};

const schema = z.object(searchMemoryInput);

export async function searchMemory(rawArgs: unknown) {
  const { project, query, limit } = schema.parse(rawArgs);

  const queryEmbedding = await embed(query);

  const result = await pool.query(
    `SELECT id, content, tags, source_tool, created_at,
            1 - (embedding <=> $2) AS similarity
     FROM memories
     WHERE project_id = $1
     ORDER BY embedding <=> $2
     LIMIT $3`,
    [project, toVectorLiteral(queryEmbedding), limit ?? 5]
  );

  if (result.rows.length === 0) {
    return {
      content: [{ type: "text" as const, text: `No memories found for project "${project}".` }],
    };
  }

  const formatted = result.rows
    .map(
      (row) =>
        `#${row.id} (${(row.similarity * 100).toFixed(1)}% match, ${row.created_at.toISOString()})\n${row.content}`
    )
    .join("\n\n");

  return { content: [{ type: "text" as const, text: formatted }] };
}
