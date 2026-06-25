import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FunAsrSettings,
  Permission,
  Role,
  SessionUser,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  User
} from "./types";

type Notice = {
  type: "success" | "error" | "info";
  text: string;
};

type View = "dashboard" | "tasks" | "users" | "roles" | "settings";

const STORAGE_KEYS = {
  roles: "voice-task-roles",
  users: "voice-task-users",
  tasks: "voice-task-tasks",
  settings: "voice-task-settings",
  session: "voice-task-session"
} as const;

const ALL_PERMISSIONS: Permission[] = [
  "task:view_all",
  "task:edit_all",
  "task:manage_own",
  "user:manage",
  "role:manage",
  "settings:manage"
];

const PERMISSION_LABELS: Record<Permission, string> = {
  "task:view_all": "查看全部事务",
  "task:edit_all": "编辑全部事务",
  "task:manage_own": "管理自己的事务",
  "user:manage": "用户管理",
  "role:manage": "角色管理",
  "settings:manage": "系统配置"
};

const nowIso = () => new Date().toISOString();
const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createSeedRoles = (): Role[] => {
  const createdAt = nowIso();

  return [
    {
      id: "role-admin",
      name: "超级管理员",
      description: "拥有系统全部权限",
      permissions: [...ALL_PERMISSIONS],
      system: true,
      disabled: false,
      createdAt
    },
    {
      id: "role-employee",
      name: "普通员工",
      description: "只能管理自己的事务",
      permissions: ["task:manage_own"],
      system: true,
      disabled: false,
      createdAt
    }
  ];
};

const createSeedUsers = (): User[] => {
  const createdAt = nowIso();

  return [
    {
      id: "user-admin",
      username: "admin",
      password: "admin123",
      displayName: "系统管理员",
      email: "admin@example.com",
      roleIds: ["role-admin"],
      status: "启用",
      deleted: false,
      createdAt
    },
    {
      id: "user-demo",
      username: "demo",
      password: "demo123",
      displayName: "示例员工",
      email: "demo@example.com",
      roleIds: ["role-employee"],
      status: "启用",
      deleted: false,
      createdAt
    }
  ];
};

const createSeedTasks = (): TaskRecord[] => {
  const current = nowIso();

  return [
    {
      id: createId(),
      title: "整理今天的客户回访事项",
      content: "优先联系 A 类客户，确认回访结果并补充备注。",
      status: "待处理",
      priority: "高",
      createdBy: "user-admin",
      updatedBy: "user-admin",
      createdAt: current,
      updatedAt: current
    },
    {
      id: createId(),
      title: "补充会议中的待办任务",
      content: "上传录音后通过 funASR 生成文本，再拆分为多条事务。",
      status: "进行中",
      priority: "中",
      createdBy: "user-demo",
      updatedBy: "user-demo",
      createdAt: current,
      updatedAt: current
    }
  ];
};

const createSeedSettings = (): FunAsrSettings => ({
  serviceUrl: "",
  apiPath: "/recognize",
  token: "",
  ssoEnabled: false,
  ssoProvider: "企业微信 / OAuth"
});

const readStorage = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveStorage = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const formatTime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const getPermissionsForUser = (
  user: User | undefined,
  roles: Role[]
): Permission[] => {
  if (!user) {
    return [];
  }

  const permissionSet = new Set<Permission>();

  user.roleIds.forEach((roleId) => {
    roles
      .filter((role) => role.id === roleId && !role.disabled)
      .forEach((role) => role.permissions.forEach((permission) => permissionSet.add(permission)));
  });

  return [...permissionSet];
};

const userLabel = (userId: string, users: User[]) =>
  users.find((item) => item.id === userId)?.displayName ?? "未知用户";

const extractTextFromFunAsrResponse = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const directText =
    record.text ??
    record.result ??
    record.transcript ??
    (record.data as Record<string, unknown> | undefined)?.text ??
    (record.data as Record<string, unknown> | undefined)?.result;

  return typeof directText === "string" ? directText : "";
};

const emptyTaskForm = {
  id: "",
  title: "",
  content: "",
  status: "待处理" as TaskStatus,
  priority: "中" as TaskPriority
};

const emptyUserForm = {
  id: "",
  username: "",
  password: "",
  displayName: "",
  email: "",
  roleIds: [] as string[],
  status: "启用" as User["status"]
};

const emptyRoleForm = {
  id: "",
  name: "",
  description: "",
  permissions: ["task:manage_own"] as Permission[]
};

function App() {
  const [roles, setRoles] = useState<Role[]>(() =>
    readStorage<Role[]>(STORAGE_KEYS.roles, createSeedRoles())
  );
  const [users, setUsers] = useState<User[]>(() =>
    readStorage<User[]>(STORAGE_KEYS.users, createSeedUsers())
  );
  const [tasks, setTasks] = useState<TaskRecord[]>(() =>
    readStorage<TaskRecord[]>(STORAGE_KEYS.tasks, createSeedTasks())
  );
  const [settings, setSettings] = useState<FunAsrSettings>(() =>
    readStorage<FunAsrSettings>(STORAGE_KEYS.settings, createSeedSettings())
  );
  const [session, setSession] = useState<SessionUser | null>(() =>
    readStorage<SessionUser | null>(STORAGE_KEYS.session, null)
  );
  const [notice, setNotice] = useState<Notice | null>({
    type: "info",
    text: "默认管理员：admin / admin123，示例员工：demo / demo123。"
  });
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "admin123" });
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"全部" | TaskStatus>("全部");
  const [taskFileName, setTaskFileName] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);

  useEffect(() => saveStorage(STORAGE_KEYS.roles, roles), [roles]);
  useEffect(() => saveStorage(STORAGE_KEYS.users, users), [users]);
  useEffect(() => saveStorage(STORAGE_KEYS.tasks, tasks), [tasks]);
  useEffect(() => saveStorage(STORAGE_KEYS.settings, settings), [settings]);
  useEffect(() => saveStorage(STORAGE_KEYS.session, session), [session]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === session?.id && !user.deleted),
    [session, users]
  );
  const currentPermissions = useMemo(
    () => getPermissionsForUser(currentUser, roles),
    [currentUser, roles]
  );

  const can = (permission: Permission) => currentPermissions.includes(permission);
  const canManageOwnTasks = can("task:manage_own");

  useEffect(() => {
    if (session && !currentUser) {
      setSession(null);
      setNotice({ type: "info", text: "当前登录用户已失效，请重新登录。" });
    }
  }, [currentUser, session]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const allowedViews: View[] = ["dashboard", "tasks"];
    if (can("user:manage")) {
      allowedViews.push("users");
    }
    if (can("role:manage")) {
      allowedViews.push("roles");
    }
    if (can("settings:manage")) {
      allowedViews.push("settings");
    }

    if (!allowedViews.includes(activeView)) {
      setActiveView(allowedViews[0]);
    }
  }, [activeView, currentUser, currentPermissions]);

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (can("task:view_all") || can("task:edit_all")) {
          return true;
        }

        return task.createdBy === currentUser?.id;
      })
      .filter((task) => {
        if (taskStatusFilter === "全部") {
          return true;
        }

        return task.status === taskStatusFilter;
      })
      .filter((task) => {
        const keyword = taskSearch.trim().toLowerCase();
        if (!keyword) {
          return true;
        }

        return (
          task.title.toLowerCase().includes(keyword) ||
          task.content.toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [tasks, currentUser, taskSearch, taskStatusFilter, currentPermissions]);

  const taskStats = useMemo(
    () => ({
      total: visibleTasks.length,
      todo: visibleTasks.filter((item) => item.status === "待处理").length,
      doing: visibleTasks.filter((item) => item.status === "进行中").length,
      done: visibleTasks.filter((item) => item.status === "已完成").length
    }),
    [visibleTasks]
  );

  const pushNotice = (type: Notice["type"], text: string) => setNotice({ type, text });

  const resetTaskEditor = () => {
    setTaskForm(emptyTaskForm);
    setTaskFileName("");
  };

  const resetUserEditor = () => setUserForm(emptyUserForm);
  const resetRoleEditor = () => setRoleForm(emptyRoleForm);

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();

    const found = users.find(
      (user) =>
        !user.deleted &&
        user.status === "启用" &&
        user.username === loginForm.username &&
        user.password === loginForm.password
    );

    if (!found) {
      pushNotice("error", "登录失败，请检查账号、密码或账号状态。");
      return;
    }

    setSession({ id: found.id, username: found.username });
    pushNotice("success", `欢迎回来，${found.displayName}。`);
  };

  const handleLogout = () => {
    setSession(null);
    pushNotice("info", "已退出当前账号。");
  };

  const handleTaskSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!currentUser || !taskForm.title.trim() || !taskForm.content.trim()) {
      pushNotice("error", "请填写完整的事务标题和内容。");
      return;
    }

    const currentTime = nowIso();

    if (taskForm.id) {
      const target = tasks.find((task) => task.id === taskForm.id);
      if (!target) {
        pushNotice("error", "事务不存在，列表已刷新。");
        resetTaskEditor();
        return;
      }

      const canEditTarget =
        can("task:edit_all") ||
        can("task:view_all") ||
        (canManageOwnTasks && target.createdBy === currentUser.id);

      if (!canEditTarget) {
        pushNotice("error", "没有权限修改这条事务。");
        return;
      }

      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskForm.id
            ? {
                ...task,
                title: taskForm.title.trim(),
                content: taskForm.content.trim(),
                status: taskForm.status,
                priority: taskForm.priority,
                updatedAt: currentTime,
                updatedBy: currentUser.id
              }
            : task
        )
      );
      pushNotice("success", "事务已更新。");
    } else {
      if (!canManageOwnTasks && !can("task:edit_all")) {
        pushNotice("error", "当前账号没有新增事务的权限。");
        return;
      }

      setTasks((previous) => [
        {
          id: createId(),
          title: taskForm.title.trim(),
          content: taskForm.content.trim(),
          status: taskForm.status,
          priority: taskForm.priority,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          createdAt: currentTime,
          updatedAt: currentTime
        },
        ...previous
      ]);
      pushNotice("success", "事务已创建。");
    }

    resetTaskEditor();
  };

  const handleTaskEdit = (task: TaskRecord) => {
    setTaskForm({
      id: task.id,
      title: task.title,
      content: task.content,
      status: task.status,
      priority: task.priority
    });
    setActiveView("tasks");
  };

  const handleTaskDelete = (task: TaskRecord) => {
    if (!currentUser) {
      return;
    }

    const canDelete =
      can("task:edit_all") || (canManageOwnTasks && task.createdBy === currentUser.id);

    if (!canDelete) {
      pushNotice("error", "没有权限删除该事务。");
      return;
    }

    setTasks((previous) => previous.filter((item) => item.id !== task.id));
    if (taskForm.id === task.id) {
      resetTaskEditor();
    }
    pushNotice("success", "事务已删除。");
  };

  const handleTaskStatusQuickChange = (task: TaskRecord, status: TaskStatus) => {
    if (!currentUser) {
      return;
    }

    const canUpdate =
      can("task:edit_all") ||
      can("task:view_all") ||
      (canManageOwnTasks && task.createdBy === currentUser.id);

    if (!canUpdate) {
      pushNotice("error", "没有权限修改该事务状态。");
      return;
    }

    setTasks((previous) =>
      previous.map((item) =>
        item.id === task.id
          ? { ...item, status, updatedAt: nowIso(), updatedBy: currentUser.id }
          : item
      )
    );
  };

  const handleTranscribe = async (file: File | null) => {
    if (!file) {
      return;
    }

    const validTypes = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/webm"];
    if (!validTypes.includes(file.type)) {
      pushNotice("error", "仅支持 mp3、wav、m4a 或 webm 音频。");
      return;
    }

    if (!settings.serviceUrl.trim()) {
      pushNotice("error", "请先在系统配置中填写 funASR 服务地址。");
      return;
    }

    setTaskFileName(file.name);
    setTranscribing(true);

    try {
      const targetUrl = `${settings.serviceUrl.replace(/\/$/, "")}${
        settings.apiPath.startsWith("/") ? settings.apiPath : `/${settings.apiPath}`
      }`;
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: settings.token.trim()
          ? {
              Authorization: `Bearer ${settings.token.trim()}`
            }
          : undefined,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`funASR 调用失败，状态码 ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextFromFunAsrResponse(payload);

      if (!text) {
        throw new Error("识别结果为空，请检查 funASR 返回格式。");
      }

      setTaskForm((previous) => ({
        ...previous,
        content: previous.content.trim() ? `${previous.content.trim()}\n${text}` : text
      }));
      pushNotice("success", "语音转文字成功，内容已回填到事务正文。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "语音识别失败";
      pushNotice("error", message);
    } finally {
      setTranscribing(false);
    }
  };

  const handleUserSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!can("user:manage")) {
      pushNotice("error", "当前账号没有用户管理权限。");
      return;
    }

    if (
      !userForm.username.trim() ||
      !userForm.displayName.trim() ||
      !userForm.email.trim() ||
      userForm.roleIds.length === 0
    ) {
      pushNotice("error", "请填写完整的用户信息并分配至少一个角色。");
      return;
    }

    const duplicated = users.find(
      (user) => !user.deleted && user.username === userForm.username.trim() && user.id !== userForm.id
    );
    if (duplicated) {
      pushNotice("error", "账号已存在，请更换用户名。");
      return;
    }

    if (userForm.id) {
      setUsers((previous) =>
        previous.map((user) =>
          user.id === userForm.id
            ? {
                ...user,
                username: userForm.username.trim(),
                displayName: userForm.displayName.trim(),
                email: userForm.email.trim(),
                roleIds: userForm.roleIds,
                status: userForm.status,
                password: userForm.password.trim() ? userForm.password.trim() : user.password
              }
            : user
        )
      );
      pushNotice("success", "用户信息已更新。");
    } else {
      if (!userForm.password.trim()) {
        pushNotice("error", "新增用户必须填写初始密码。");
        return;
      }

      setUsers((previous) => [
        {
          id: createId(),
          username: userForm.username.trim(),
          password: userForm.password.trim(),
          displayName: userForm.displayName.trim(),
          email: userForm.email.trim(),
          roleIds: userForm.roleIds,
          status: userForm.status,
          deleted: false,
          createdAt: nowIso()
        },
        ...previous
      ]);
      pushNotice("success", "用户已创建。");
    }

    resetUserEditor();
  };

  const handleUserEdit = (user: User) => {
    setUserForm({
      id: user.id,
      username: user.username,
      password: "",
      displayName: user.displayName,
      email: user.email,
      roleIds: user.roleIds,
      status: user.status
    });
    setActiveView("users");
  };

  const handleUserDelete = (user: User) => {
    if (!currentUser) {
      return;
    }

    if (user.id === currentUser.id) {
      pushNotice("error", "不能删除当前登录用户。");
      return;
    }

    setUsers((previous) =>
      previous.map((item) => (item.id === user.id ? { ...item, deleted: true } : item))
    );
    pushNotice("success", "用户已逻辑删除。");
  };

  const handleRoleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!can("role:manage")) {
      pushNotice("error", "当前账号没有角色管理权限。");
      return;
    }

    if (!roleForm.name.trim() || roleForm.permissions.length === 0) {
      pushNotice("error", "请填写角色名称并至少勾选一个权限。");
      return;
    }

    const duplicated = roles.find(
      (role) => role.name === roleForm.name.trim() && role.id !== roleForm.id
    );

    if (duplicated) {
      pushNotice("error", "角色名称已存在。");
      return;
    }

    if (roleForm.id) {
      setRoles((previous) =>
        previous.map((role) =>
          role.id === roleForm.id
            ? {
                ...role,
                name: roleForm.name.trim(),
                description: roleForm.description.trim(),
                permissions: roleForm.permissions
              }
            : role
        )
      );
      pushNotice("success", "角色已更新。");
    } else {
      setRoles((previous) => [
        {
          id: createId(),
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
          permissions: roleForm.permissions,
          system: false,
          disabled: false,
          createdAt: nowIso()
        },
        ...previous
      ]);
      pushNotice("success", "角色已创建。");
    }

    resetRoleEditor();
  };

  const handleRoleEdit = (role: Role) => {
    setRoleForm({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions
    });
    setActiveView("roles");
  };

  const handleRoleDelete = (role: Role) => {
    if (role.system) {
      pushNotice("error", "系统默认角色不可删除。");
      return;
    }

    const inUse = users.some((user) => !user.deleted && user.roleIds.includes(role.id));
    if (inUse) {
      pushNotice("error", "该角色仍被用户使用，无法删除。");
      return;
    }

    setRoles((previous) => previous.filter((item) => item.id !== role.id));
    pushNotice("success", "角色已删除。");
  };

  const handleRoleDisabledChange = (role: Role) => {
    setRoles((previous) =>
      previous.map((item) =>
        item.id === role.id ? { ...item, disabled: !item.disabled } : item
      )
    );
  };

  const availableUsers = users.filter((user) => !user.deleted);
  const availableRoles = roles;

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div>
            <p className="eyebrow">需求基线 V1.0</p>
            <h1>语音转文字事务记录网页</h1>
            <p className="muted">
              支持待办事务、用户管理、自定义角色、企业单点登录预留以及 funASR 语音转文字接入。
            </p>
          </div>

          {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}

          <form className="panel form-grid" onSubmit={handleLogin}>
            <label>
              <span>账号</span>
              <input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((previous) => ({ ...previous, username: event.target.value }))
                }
                placeholder="请输入账号"
              />
            </label>
            <label>
              <span>密码</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="请输入密码"
              />
            </label>
            <button className="primary" type="submit">
              登录系统
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Voice Task</p>
          <h2>事务记录工作台</h2>
          <p className="muted">
            当前用户：{currentUser.displayName}
            <br />
            角色：{currentUser.roleIds.map((roleId) => roles.find((role) => role.id === roleId)?.name).join("、")}
          </p>
        </div>

        <nav className="nav-list">
          <button
            className={activeView === "dashboard" ? "active" : ""}
            onClick={() => setActiveView("dashboard")}
          >
            总览
          </button>
          <button
            className={activeView === "tasks" ? "active" : ""}
            onClick={() => setActiveView("tasks")}
          >
            事务记录
          </button>
          {can("user:manage") ? (
            <button
              className={activeView === "users" ? "active" : ""}
              onClick={() => setActiveView("users")}
            >
              用户管理
            </button>
          ) : null}
          {can("role:manage") ? (
            <button
              className={activeView === "roles" ? "active" : ""}
              onClick={() => setActiveView("roles")}
            >
              角色管理
            </button>
          ) : null}
          {can("settings:manage") ? (
            <button
              className={activeView === "settings" ? "active" : ""}
              onClick={() => setActiveView("settings")}
            >
              系统配置
            </button>
          ) : null}
        </nav>

        <button className="ghost" onClick={handleLogout}>
          退出登录
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{activeView === "dashboard" ? "业务总览" : "业务工作区"}</h1>
            <p className="muted">
              当前权限：{currentPermissions.map((permission) => PERMISSION_LABELS[permission]).join(" / ")}
            </p>
          </div>
          {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}
        </header>

        {activeView === "dashboard" ? (
          <section className="content-grid">
            <div className="stats-row">
              <article className="stat-card">
                <span>可见事务</span>
                <strong>{taskStats.total}</strong>
              </article>
              <article className="stat-card">
                <span>待处理</span>
                <strong>{taskStats.todo}</strong>
              </article>
              <article className="stat-card">
                <span>进行中</span>
                <strong>{taskStats.doing}</strong>
              </article>
              <article className="stat-card">
                <span>已完成</span>
                <strong>{taskStats.done}</strong>
              </article>
            </div>

            <div className="two-column">
              <section className="panel">
                <h3>最近事务</h3>
                {visibleTasks.slice(0, 5).map((task) => (
                  <div className="list-item" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p className="muted">
                        {task.status} / {task.priority} / {userLabel(task.createdBy, users)}
                      </p>
                    </div>
                    <button className="ghost small" onClick={() => handleTaskEdit(task)}>
                      编辑
                    </button>
                  </div>
                ))}
              </section>

              <section className="panel">
                <h3>接入提示</h3>
                <ul className="hint-list">
                  <li>funASR 采用可配置服务地址调用，适合后续接真实识别服务。</li>
                  <li>企业单点登录当前为预留位，保留配置入口但不影响本地账号登录。</li>
                  <li>当前示例数据存储在浏览器本地，适合作为 MVP 演示和原型继续扩展。</li>
                </ul>
              </section>
            </div>
          </section>
        ) : null}

        {activeView === "tasks" ? (
          <section className="content-grid">
            <div className="two-column">
              <form className="panel form-grid" onSubmit={handleTaskSubmit}>
                <div className="panel-header">
                  <h3>{taskForm.id ? "编辑事务" : "新建事务"}</h3>
                  {taskForm.id ? (
                    <button className="ghost small" type="button" onClick={resetTaskEditor}>
                      取消编辑
                    </button>
                  ) : null}
                </div>

                <label>
                  <span>标题</span>
                  <input
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((previous) => ({ ...previous, title: event.target.value }))
                    }
                    placeholder="例如：整理客户回访待办"
                  />
                </label>

                <label>
                  <span>正文</span>
                  <textarea
                    rows={8}
                    value={taskForm.content}
                    onChange={(event) =>
                      setTaskForm((previous) => ({ ...previous, content: event.target.value }))
                    }
                    placeholder="可以直接输入，也可以先上传语音让 funASR 转写。"
                  />
                </label>

                <div className="inline-fields">
                  <label>
                    <span>状态</span>
                    <select
                      value={taskForm.status}
                      onChange={(event) =>
                        setTaskForm((previous) => ({
                          ...previous,
                          status: event.target.value as TaskStatus
                        }))
                      }
                    >
                      <option value="待处理">待处理</option>
                      <option value="进行中">进行中</option>
                      <option value="已完成">已完成</option>
                    </select>
                  </label>

                  <label>
                    <span>优先级</span>
                    <select
                      value={taskForm.priority}
                      onChange={(event) =>
                        setTaskForm((previous) => ({
                          ...previous,
                          priority: event.target.value as TaskPriority
                        }))
                      }
                    >
                      <option value="低">低</option>
                      <option value="中">中</option>
                      <option value="高">高</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span>语音文件</span>
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,.webm,audio/*"
                    onChange={(event) => void handleTranscribe(event.target.files?.[0] ?? null)}
                  />
                  <small className="muted">
                    {transcribing
                      ? "正在调用 funASR 识别..."
                      : taskFileName
                        ? `最近上传：${taskFileName}`
                        : "上传音频后会把识别文本追加到正文中。"}
                  </small>
                </label>

                <button className="primary" type="submit">
                  {taskForm.id ? "保存事务" : "创建事务"}
                </button>
              </form>

              <section className="panel">
                <div className="panel-header">
                  <h3>事务列表</h3>
                  <div className="inline-actions">
                    <input
                      value={taskSearch}
                      onChange={(event) => setTaskSearch(event.target.value)}
                      placeholder="搜索标题或正文"
                    />
                    <select
                      value={taskStatusFilter}
                      onChange={(event) =>
                        setTaskStatusFilter(event.target.value as "全部" | TaskStatus)
                      }
                    >
                      <option value="全部">全部状态</option>
                      <option value="待处理">待处理</option>
                      <option value="进行中">进行中</option>
                      <option value="已完成">已完成</option>
                    </select>
                  </div>
                </div>

                <div className="table-list">
                  {visibleTasks.map((task) => (
                    <article className="task-card" key={task.id}>
                      <div className="task-card-header">
                        <div>
                          <h4>{task.title}</h4>
                          <p className="muted">
                            创建人：{userLabel(task.createdBy, users)} / 更新时间：{formatTime(task.updatedAt)}
                          </p>
                        </div>
                        <span className={`badge ${task.status}`}>{task.status}</span>
                      </div>
                      <p>{task.content}</p>
                      <div className="task-meta">
                        <span>优先级：{task.priority}</span>
                        <span>最后修改：{userLabel(task.updatedBy, users)}</span>
                      </div>
                      <div className="inline-actions wrap">
                        <button className="ghost small" onClick={() => handleTaskEdit(task)}>
                          编辑
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => handleTaskStatusQuickChange(task, "待处理")}
                        >
                          设为待处理
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => handleTaskStatusQuickChange(task, "进行中")}
                        >
                          设为进行中
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => handleTaskStatusQuickChange(task, "已完成")}
                        >
                          设为已完成
                        </button>
                        <button className="danger small" onClick={() => handleTaskDelete(task)}>
                          删除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeView === "users" && can("user:manage") ? (
          <section className="content-grid">
            <div className="two-column">
              <form className="panel form-grid" onSubmit={handleUserSubmit}>
                <div className="panel-header">
                  <h3>{userForm.id ? "编辑用户" : "新增用户"}</h3>
                  {userForm.id ? (
                    <button className="ghost small" type="button" onClick={resetUserEditor}>
                      取消编辑
                    </button>
                  ) : null}
                </div>

                <label>
                  <span>账号</span>
                  <input
                    value={userForm.username}
                    onChange={(event) =>
                      setUserForm((previous) => ({ ...previous, username: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>{userForm.id ? "重置密码" : "初始密码"}</span>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(event) =>
                      setUserForm((previous) => ({ ...previous, password: event.target.value }))
                    }
                    placeholder={userForm.id ? "不填写则保持原密码" : "请输入初始密码"}
                  />
                </label>
                <label>
                  <span>姓名</span>
                  <input
                    value={userForm.displayName}
                    onChange={(event) =>
                      setUserForm((previous) => ({ ...previous, displayName: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>邮箱</span>
                  <input
                    value={userForm.email}
                    onChange={(event) =>
                      setUserForm((previous) => ({ ...previous, email: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>状态</span>
                  <select
                    value={userForm.status}
                    onChange={(event) =>
                      setUserForm((previous) => ({
                        ...previous,
                        status: event.target.value as User["status"]
                      }))
                    }
                  >
                    <option value="启用">启用</option>
                    <option value="禁用">禁用</option>
                  </select>
                </label>
                <label>
                  <span>角色</span>
                  <div className="check-list">
                    {availableRoles.map((role) => (
                      <label className="check-item" key={role.id}>
                        <input
                          type="checkbox"
                          checked={userForm.roleIds.includes(role.id)}
                          onChange={(event) => {
                            const nextRoleIds = event.target.checked
                              ? [...userForm.roleIds, role.id]
                              : userForm.roleIds.filter((roleId) => roleId !== role.id);
                            setUserForm((previous) => ({ ...previous, roleIds: nextRoleIds }));
                          }}
                        />
                        <span>
                          {role.name}
                          {role.disabled ? "（已禁用）" : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </label>

                <button className="primary" type="submit">
                  {userForm.id ? "保存用户" : "创建用户"}
                </button>
              </form>

              <section className="panel">
                <h3>用户列表</h3>
                {availableUsers.map((user) => (
                  <div className="list-item stretch" key={user.id}>
                    <div>
                      <strong>
                        {user.displayName} ({user.username})
                      </strong>
                      <p className="muted">
                        {user.email} / {user.status} /{" "}
                        {user.roleIds
                          .map((roleId) => roles.find((role) => role.id === roleId)?.name ?? "未知角色")
                          .join("、")}
                      </p>
                    </div>
                    <div className="inline-actions">
                      <button className="ghost small" onClick={() => handleUserEdit(user)}>
                        编辑
                      </button>
                      <button className="danger small" onClick={() => handleUserDelete(user)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </section>
        ) : null}

        {activeView === "roles" && can("role:manage") ? (
          <section className="content-grid">
            <div className="two-column">
              <form className="panel form-grid" onSubmit={handleRoleSubmit}>
                <div className="panel-header">
                  <h3>{roleForm.id ? "编辑角色" : "新增角色"}</h3>
                  {roleForm.id ? (
                    <button className="ghost small" type="button" onClick={resetRoleEditor}>
                      取消编辑
                    </button>
                  ) : null}
                </div>

                <label>
                  <span>角色名称</span>
                  <input
                    value={roleForm.name}
                    onChange={(event) =>
                      setRoleForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>描述</span>
                  <textarea
                    rows={4}
                    value={roleForm.description}
                    onChange={(event) =>
                      setRoleForm((previous) => ({
                        ...previous,
                        description: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>权限</span>
                  <div className="check-list">
                    {ALL_PERMISSIONS.map((permission) => (
                      <label className="check-item" key={permission}>
                        <input
                          type="checkbox"
                          checked={roleForm.permissions.includes(permission)}
                          onChange={(event) => {
                            const nextPermissions = event.target.checked
                              ? [...roleForm.permissions, permission]
                              : roleForm.permissions.filter((item) => item !== permission);
                            setRoleForm((previous) => ({
                              ...previous,
                              permissions: nextPermissions
                            }));
                          }}
                        />
                        <span>{PERMISSION_LABELS[permission]}</span>
                      </label>
                    ))}
                  </div>
                </label>

                <button className="primary" type="submit">
                  {roleForm.id ? "保存角色" : "创建角色"}
                </button>
              </form>

              <section className="panel">
                <h3>角色列表</h3>
                {roles.map((role) => (
                  <div className="list-item stretch" key={role.id}>
                    <div>
                      <strong>
                        {role.name}
                        {role.system ? "（系统）" : ""}
                      </strong>
                      <p className="muted">{role.description || "暂无描述"}</p>
                      <p className="muted">
                        权限：{role.permissions.map((item) => PERMISSION_LABELS[item]).join("、")}
                      </p>
                    </div>
                    <div className="inline-actions wrap">
                      <button className="ghost small" onClick={() => handleRoleEdit(role)}>
                        编辑
                      </button>
                      <button
                        className="ghost small"
                        onClick={() => handleRoleDisabledChange(role)}
                      >
                        {role.disabled ? "启用" : "禁用"}
                      </button>
                      {!role.system ? (
                        <button className="danger small" onClick={() => handleRoleDelete(role)}>
                          删除
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </section>
        ) : null}

        {activeView === "settings" && can("settings:manage") ? (
          <section className="content-grid">
            <div className="two-column">
              <form
                className="panel form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  pushNotice("success", "系统配置已保存。");
                }}
              >
                <h3>funASR 配置</h3>
                <label>
                  <span>服务地址</span>
                  <input
                    value={settings.serviceUrl}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        serviceUrl: event.target.value
                      }))
                    }
                    placeholder="例如：http://127.0.0.1:8000"
                  />
                </label>
                <label>
                  <span>识别路径</span>
                  <input
                    value={settings.apiPath}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        apiPath: event.target.value
                      }))
                    }
                    placeholder="/recognize"
                  />
                </label>
                <label>
                  <span>访问令牌</span>
                  <input
                    value={settings.token}
                    onChange={(event) =>
                      setSettings((previous) => ({ ...previous, token: event.target.value }))
                    }
                    placeholder="可选"
                  />
                </label>
                <button className="primary" type="submit">
                  保存 funASR 配置
                </button>
              </form>

              <form
                className="panel form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  pushNotice("success", "单点登录预留配置已保存。");
                }}
              >
                <h3>认证与单点登录预留</h3>
                <label className="toggle-row">
                  <span>启用 SSO 预留配置</span>
                  <input
                    type="checkbox"
                    checked={settings.ssoEnabled}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        ssoEnabled: event.target.checked
                      }))
                    }
                  />
                </label>
                <label>
                  <span>身份提供方</span>
                  <input
                    value={settings.ssoProvider}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        ssoProvider: event.target.value
                      }))
                    }
                    placeholder="企业微信 / OAuth / 自定义"
                  />
                </label>
                <div className="subtle-box">
                  当前版本说明：本地账号登录已可用，SSO 作为扩展位保留，后续可接入统一认证服务。
                </div>
                <button className="primary" type="submit">
                  保存认证配置
                </button>
              </form>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
