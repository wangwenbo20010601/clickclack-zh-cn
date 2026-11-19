import { apiWithTimeout, APIError } from "./api";
import type { User } from "./types";

export type WorkspaceMemberRole = "owner" | "moderator" | "member" | "bot" | "guest";

export type WorkspaceMember = {
  workspace_id: string;
  user: User;
  role: WorkspaceMemberRole;
  joined_at: string;
};

export type WorkspaceMemberRoleCounts = Record<WorkspaceMemberRole, number>;

export type WorkspaceMemberPage = {
  members: WorkspaceMember[];
  next_cursor?: string;
  has_more: boolean;
  total_count?: number;
  total_by_role?: WorkspaceMemberRoleCounts;
};

export type ListWorkspaceMembersParams = {
  workspaceID: string;
  cursor?: string;
  query?: string;
  role?: WorkspaceMemberRole | "";
  limit?: number;
  signal?: AbortSignal;
};

export const MEMBERS_PAGE_LIMIT = 100;

export async function listWorkspaceMembersPage(
  params: ListWorkspaceMembersParams,
): Promise<WorkspaceMemberPage> {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  const trimmed = params.query?.trim();
  if (trimmed) search.set("q", trimmed);
  if (params.role) search.set("role", params.role);
  const qs = search.toString();
  const path = `/api/workspaces/${params.workspaceID}/members${qs ? `?${qs}` : ""}`;
  return apiWithTimeout<WorkspaceMemberPage>(path, { signal: params.signal });
}

export async function listAllWorkspaceMembers(
  params: Omit<ListWorkspaceMembersParams, "cursor">,
): Promise<WorkspaceMember[]> {
  const members: WorkspaceMember[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    params.signal?.throwIfAborted();
    const page = await listWorkspaceMembersPage({ ...params, cursor });
    params.signal?.throwIfAborted();
    members.push(...page.members);
    if (!page.has_more) return members;
    cursor = page.next_cursor;
    if (!cursor) throw new Error("成员列表返回的分页不完整");
    if (seenCursors.has(cursor)) {
      throw new Error("成员列表返回了重复的分页游标");
    }
    seenCursors.add(cursor);
  } while (cursor);
  return members;
}

export function memberLoadErrorMessage(err: unknown): string {
  if (err instanceof APIError) {
    if (err.status === 401 || err.status === 403) {
      return "你没有权限查看此工作区的成员。";
    }
    if (err.status === 400) {
      return "搜索无效，请更换搜索词或筛选条件。";
    }
  }
  return err instanceof Error ? err.message : "无法加载成员";
}
