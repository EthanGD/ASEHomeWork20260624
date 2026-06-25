export type Permission =
  | "task:view_all"
  | "task:edit_all"
  | "task:manage_own"
  | "user:manage"
  | "role:manage"
  | "settings:manage";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
  system: boolean;
  disabled: boolean;
  createdAt: string;
}

export interface User {
  id: number;
  username: string | null;
  displayName: string;
  email: string | null;
  roleIds: number[];
  roleNames: string[];
  status: "enabled" | "disabled";
  authSource: "local" | "wechat";
  wechatBound: boolean;
  githubBound: boolean;
  createdAt: string;
}

export interface TaskRecord {
  id: number;
  title: string;
  content: string;
  status: TaskStatus;
  priority: TaskPriority;
  startAt: string | null;
  endAt: string | null;
  createdBy: number;
  updatedBy: number;
  createdByName: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  integrations: {
    funasrServiceUrl: string;
    funasrApiPath: string;
    funasrToken: string;
    wechatAppId: string;
    ssoEnabled: boolean;
    ssoProvider: string;
  };
}

export interface SessionUser {
  id: number;
  username: string | null;
  displayName: string;
  email: string | null;
  status: "enabled" | "disabled";
  authSource: "local" | "wechat";
  wechatBound: boolean;
  githubBound: boolean;
  roleIds: number[];
  roleNames: string[];
  permissions: Permission[];
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface DashboardSummary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}
