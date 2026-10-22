import { z } from "zod";
import { pool, ensureProject } from "../db.js";
import { embed } from "../embeddings.js";

export const saveMemoryInput = {
  project: z.string().min(1).describe("Project identifier shared across tools, e.g. a repo name"),
  content: z.string().min(1).describe("The fact, decision, or note to remember"),
  tags: z.array(z.string()).optional().describe("Optional labels, e.g. ['architecture', 'bug']"),
  source_tool: z
    .string()
    .optional()
    .describe("Name of the calling AI tool, e.g. 'cursor', 'vscode'"),
};

const schema = z.object(saveMemoryInput);

export async function saveMemory(rawArgs: unknown) {
  const { project, content, tags, source_tool } = schema.parse(rawArgs);

  await ensureProject(project);
  const embedding = await embed(content);

  const result = await pool.query(
    `INSERT INTO memories (project_id, content, source_tool, tags, embedding)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [project, content, source_tool ?? "unknown", tags ?? [], toVectorLiteral(embedding)]
  );

  const row = result.rows[0];
  return {
    content: [
      {
        type: "text" as const,
        text: `Saved memory #${row.id} for project "${project}" at ${row.created_at.toISOString()}.`,
      },
    ],
  };
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
