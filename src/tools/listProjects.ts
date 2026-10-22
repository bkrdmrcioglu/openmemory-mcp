import { pool } from "../db.js";

export async function listProjects() {
  const result = await pool.query(
    `SELECT p.id, p.created_at, count(m.id) AS memory_count
     FROM projects p
     LEFT JOIN memories m ON m.project_id = p.id
     GROUP BY p.id, p.created_at
     ORDER BY p.created_at DESC`
  );

  if (result.rows.length === 0) {
    return { content: [{ type: "text" as const, text: "No projects yet." }] };
  }

  const formatted = result.rows
    .map((row) => `${row.id} — ${row.memory_count} memories (since ${row.created_at.toISOString()})`)
    .join("\n");

  return { content: [{ type: "text" as const, text: formatted }] };
}
