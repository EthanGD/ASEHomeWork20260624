import { AuthenticatedRequest, hasPermission } from "../auth.js";
import { query } from "../db.js";

type TaskRow = {
  id: number;
  title: string;
  content: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  start_at: string | null;
  end_at: string | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
  created_by_name: string;
  updated_by_name: string;
};

export const fetchVisibleTasks = async (request: AuthenticatedRequest) => {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (
    !request.user ||
    (!hasPermission(request.user, "task:view_all") && !hasPermission(request.user, "task:edit_all"))
  ) {
    params.push(request.user?.id);
    conditions.push(`t.created_by = $${params.length}`);
  }

  if (typeof request.query.status === "string" && request.query.status) {
    params.push(request.query.status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (typeof request.query.keyword === "string" && request.query.keyword.trim()) {
    params.push(`%${request.query.keyword.trim()}%`);
    conditions.push(`(t.title ILIKE $${params.length} OR t.content ILIKE $${params.length})`);
  }

  if (typeof request.query.start === "string" && request.query.start) {
    params.push(request.query.start);
    conditions.push(`COALESCE(t.end_at, t.start_at, t.created_at) >= $${params.length}::timestamptz`);
  }

  if (typeof request.query.end === "string" && request.query.end) {
    params.push(request.query.end);
    conditions.push(`COALESCE(t.start_at, t.created_at) <= $${params.length}::timestamptz`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query<TaskRow>(
    `
      SELECT
        t.id,
        t.title,
        t.content,
        t.status,
        t.priority,
        t.start_at,
        t.end_at,
        t.created_by,
        t.updated_by,
        t.created_at,
        t.updated_at,
        creator.display_name AS created_by_name,
        updater.display_name AS updated_by_name
      FROM tasks t
      JOIN users creator ON creator.id = t.created_by
      JOIN users updater ON updater.id = t.updated_by
      ${where}
      ORDER BY COALESCE(t.start_at, t.created_at) ASC, t.updated_at DESC
    `,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    priority: row.priority,
    startAt: row.start_at,
    endAt: row.end_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name
  }));
};
