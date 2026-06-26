import {
  AppSettings,
  DashboardSummary,
  LoginResponse,
  Role,
  SessionUser,
  TaskRecord,
  User
} from "./types";

const TOKEN_KEY = "voice-task-token";
const API_BASE_URL = "";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// #region debug-point login-auth-failure-client
const DEBUG_SESSION_ID = "login-auth-failure";

const dbgReport = async (event: Record<string, unknown>) => {
  try {
    await fetch(`${API_BASE_URL}/__dbg/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ts: Date.now(),
        sessionId: DEBUG_SESSION_ID,
        ...event
      })
    });
  } catch {}
};
// #endregion debug-point login-auth-failure-client

async function request<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${input}`, {
      ...init,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    void dbgReport({
      side: "client",
      kind: "fetch_error",
      url: `${API_BASE_URL}${input}`,
      method: init.method ?? "GET",
      message
    });
    throw error;
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    void dbgReport({
      side: "client",
      kind: "http_error",
      url: `${API_BASE_URL}${input}`,
      method: init.method ?? "GET",
      status: response.status,
      message: payload?.message ?? "请求失败"
    });
    throw new Error(payload?.message ?? "请求失败");
  }

  void dbgReport({
    side: "client",
    kind: "http_ok",
    url: `${API_BASE_URL}${input}`,
    method: init.method ?? "GET",
    status: response.status
  });
  return response.json() as Promise<T>;
}

export const api = {
  login: (payload: { username: string; password: string }) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getAccount: () => request<{ user: SessionUser }>("/api/account"),
  getPasskeyRegisterOptions: () =>
    request<{ publicKey: unknown }>("/api/account/passkey/register/options", { method: "POST" }),
  verifyPasskeyRegister: (payload: { credential: unknown }) =>
    request<{ success: boolean; credentialId: string }>("/api/account/passkey/register/verify", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getWechatBindUrl: () =>
    request<{ mode: "mock" | "real"; url: string }>("/api/account/wechat/bind/url"),
  unbindWechat: () =>
    request<{ success: boolean }>("/api/account/wechat/unbind", {
      method: "POST",
      body: JSON.stringify({})
    }),
  getGithubBindUrl: () =>
    request<{ mode: "mock" | "real"; url: string }>("/api/account/github/bind/url"),
  unbindGithub: () =>
    request<{ success: boolean }>("/api/account/github/unbind", {
      method: "POST",
      body: JSON.stringify({})
    }),
  me: () => request<{ user: SessionUser }>("/api/auth/me"),
  getWechatUrl: () => request<{ mode: "mock" | "real"; url: string }>("/api/auth/wechat/url"),
  getGithubUrl: () => request<{ mode: "mock" | "real"; url: string }>("/api/auth/github/url"),
  getPasskeyLoginOptions: () =>
    request<{ publicKey: unknown }>("/api/auth/passkey/options", { method: "POST" }),
  verifyPasskeyLogin: (payload: { credential: unknown }) =>
    request<LoginResponse>("/api/auth/passkey/verify", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getDashboard: () => request<DashboardSummary>("/api/dashboard"),
  getTasks: (params?: URLSearchParams) =>
    request<TaskRecord[]>(`/api/tasks${params ? `?${params.toString()}` : ""}`),
  createTask: (payload: Partial<TaskRecord>) =>
    request("/api/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateTask: (id: number, payload: Partial<TaskRecord>) =>
    request(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  deleteTask: (id: number) =>
    request(`/api/tasks/${id}`, {
      method: "DELETE"
    }),
  getUsers: () => request<User[]>("/api/users"),
  createUser: (payload: {
    username: string;
    password: string;
    displayName: string;
    email: string | null;
    status: "enabled" | "disabled";
    roleIds: number[];
  }) =>
    request("/api/users", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateUser: (
    id: number,
    payload: {
      username: string | null;
      password?: string;
      displayName: string;
      email: string | null;
      status: "enabled" | "disabled";
      roleIds: number[];
    }
  ) =>
    request(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  deleteUser: (id: number) =>
    request(`/api/users/${id}`, {
      method: "DELETE"
    }),
  getRoles: () => request<Role[]>("/api/roles"),
  createRole: (payload: { name: string; description: string; permissions: Role["permissions"] }) =>
    request("/api/roles", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateRole: (
    id: number,
    payload: { name: string; description: string; permissions: Role["permissions"] }
  ) =>
    request(`/api/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  toggleRoleDisabled: (id: number, disabled: boolean) =>
    request(`/api/roles/${id}/disabled`, {
      method: "PATCH",
      body: JSON.stringify({ disabled })
    }),
  deleteRole: (id: number) =>
    request(`/api/roles/${id}`, {
      method: "DELETE"
    }),
  getSettings: () => request<AppSettings>("/api/settings"),
  updateSettings: (payload: AppSettings) =>
    request("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  transcribe: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ text: string }>("/api/transcriptions", {
      method: "POST",
      body: form
    });
  }
};
