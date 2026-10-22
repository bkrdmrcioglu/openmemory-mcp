import { z } from "zod";
import { pool } from "../db.js";

export const timelineInput = {
  project: z.string().min(1).describe("Project identifier"),
  since: z
    .string()
    .optional()
    .describe("ISO date to list memories from, e.g. '2026-09-01'. Defaults to all time."),
  limit: z.number().int().min(1).max(200).optional().describe("Max results, default 50"),
};

const schema = z.object(timelineInput);

export async function timeline(rawArgs: unknown) {
  const { project, since, limit } = schema.parse(rawArgs);

  const result = await pool.query(
    `SELECT id, content, tags, source_tool, created_at
     FROM memories
     WHERE project_id = $1
       AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
     ORDER BY created_at DESC
     LIMIT $3`,
    [project, since ?? null, limit ?? 50]
  );

  if (result.rows.length === 0) {
    return {
      content: [{ type: "text" as const, text: `No memories found for project "${project}".` }],
    };
  }

  const formatted = result.rows
    .map((row) => `${row.created_at.toISOString()} [${row.source_tool}] #${row.id}\n${row.content}`)
    .join("\n\n");

  return { content: [{ type: "text" as const, text: formatted }] };
}
