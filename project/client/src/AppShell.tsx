import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App as AntdApp,
  Button,
  Calendar,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload
} from "antd";
import type { MenuProps, TableColumnsType, UploadProps } from "antd";
import {
  CalendarOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  GithubOutlined,
  LogoutOutlined,
  PlusOutlined,
  SafetyOutlined,
  SettingOutlined,
  SolutionOutlined,
  SoundOutlined,
  TeamOutlined,
  UserOutlined,
  WechatOutlined
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { api, clearToken, getToken, setToken } from "./api";
import { clientConfig } from "./config";
import {
  AppSettings,
  DashboardSummary,
  Permission,
  Role,
  SessionUser,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  User
} from "./types";

const { Header, Content, Sider } = Layout;
const { TextArea, Password } = Input;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

type ViewKey =
  | "dashboard"
  | "account"
  | "tasks"
  | "calendar"
  | "users"
  | "roles"
  | "settings";
type CalendarMode = "month" | "week" | "3day" | "day";

type TaskFormValues = {
  title: string;
  content: string;
  status: TaskStatus;
  priority: TaskPriority;
  dateRange?: [Dayjs, Dayjs];
};

type UserFormValues = {
  username: string | null;
  password?: string;
  displayName: string;
  email: string | null;
  status: "enabled" | "disabled";
  roleIds: number[];
};

type RoleFormValues = {
  name: string;
  description: string;
  permissions: Permission[];
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "待处理",
  in_progress: "进行中",
  done: "已完成"
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "gold",
  in_progress: "blue",
  done: "green"
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高"
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "default",
  medium: "orange",
  high: "red"
};

const PERMISSION_LABELS: Record<Permission, string> = {
  "task:view_all": "查看全部事务",
  "task:edit_all": "编辑全部事务",
  "task:manage_own": "管理自己的事务",
  "user:manage": "用户管理",
  "role:manage": "角色管理",
  "settings:manage": "系统配置"
};

const hasPermission = (user: SessionUser | null, permission: Permission) =>
  user?.permissions.includes(permission) ?? false;

const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";

const getWeekStart = (value: Dayjs) =>
  value.startOf("day").subtract((value.day() + 6) % 7, "day");

const getRangeDates = (mode: CalendarMode, anchor: Dayjs) => {
  if (mode === "day") {
    return [anchor.startOf("day")];
  }

  if (mode === "3day") {
    return [0, 1, 2].map((offset) => anchor.startOf("day").add(offset, "day"));
  }

  if (mode === "week") {
    const weekStart = getWeekStart(anchor);
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => weekStart.add(offset, "day"));
  }

  return [anchor.startOf("month")];
};

const taskTouchesDate = (task: TaskRecord, date: Dayjs) => {
  const start = dayjs(task.startAt ?? task.createdAt);
  const end = dayjs(task.endAt ?? task.startAt ?? task.createdAt);
  return !date.endOf("day").isBefore(start) && !date.startOf("day").isAfter(end);
};

const sortTasks = (items: TaskRecord[]) =>
  [...items].sort(
    (left, right) =>
      dayjs(left.startAt ?? left.createdAt).valueOf() -
      dayjs(right.startAt ?? right.createdAt).valueOf()
  );

function AppShellInner() {
  const { message } = AntdApp.useApp();
  const [booting, setBooting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalTarget, setTaskModalTarget] = useState<TaskRecord | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalTarget, setUserModalTarget] = useState<User | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalTarget, setRoleModalTarget] = useState<Role | null>(null);
  const [taskKeyword, setTaskKeyword] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskStatus>("all");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [calendarAnchor, setCalendarAnchor] = useState(dayjs());
  const [loginForm] = Form.useForm<{ username: string; password: string }>();
  const [taskForm] = Form.useForm<TaskFormValues>();
  const [userForm] = Form.useForm<UserFormValues>();
  const [roleForm] = Form.useForm<RoleFormValues>();
  const [settingsForm] = Form.useForm<AppSettings>();
  const [passkeys, setPasskeys] = useState<{ id: number; credentialId: string; createdAt: string; updatedAt: string }[]>([]);

  const canUserManage = hasPermission(currentUser, "user:manage");
  const canRoleManage = hasPermission(currentUser, "role:manage");
  const canSettingsManage = hasPermission(currentUser, "settings:manage");
  const canTaskCreate =
    hasPermission(currentUser, "task:manage_own") ||
    hasPermission(currentUser, "task:edit_all");

  const syncCurrentUser = useCallback(async () => {
    const { user } = await api.me();
    setCurrentUser(user);
    return user;
  }, []);

  const refreshData = useCallback(
    async (user: SessionUser) => {
      setRefreshing(true);
      try {
        const [dashboardData, tasksData, rolesData] = await Promise.all([
          api.getDashboard(),
          api.getTasks(),
          api.getRoles()
        ]);
        setDashboard(dashboardData);
        setTasks(tasksData);
        setRoles(rolesData);

        if (hasPermission(user, "user:manage")) {
          setUsers(await api.getUsers());
        } else {
          setUsers([]);
        }

        if (hasPermission(user, "settings:manage")) {
          const nextSettings = await api.getSettings();
          setSettings(nextSettings);
          settingsForm.setFieldsValue(nextSettings);
        } else {
          setSettings(null);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [settingsForm]
  );

  const bootstrap = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setBooting(false);
      return null;
    }

    try {
      const user = await syncCurrentUser();
      await refreshData(user);
      return user;
    } catch (error) {
      clearToken();
      setCurrentUser(null);
      message.error(error instanceof Error ? error.message : "登录状态已失效");
      return null;
    } finally {
      setBooting(false);
    }
  }, [message, refreshData, syncCurrentUser]);

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("token");
      const auth = url.searchParams.get("auth");
      const error = url.searchParams.get("error");
      const account = url.searchParams.get("account");
      const bind = url.searchParams.get("bind");
      const bindMessage = url.searchParams.get("message");

      if (token) {
        setToken(token);
        url.searchParams.delete("token");
        url.searchParams.delete("auth");
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
        if (auth === "wechat") {
          message.success(error ? `微信登录回调：${error}` : "微信登录成功");
        } else if (auth === "github") {
          message.success(error ? `GitHub 登录回调：${error}` : "GitHub 登录成功");
        }
      } else if ((auth === "wechat" || auth === "github") && error) {
        url.searchParams.delete("auth");
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.toString());
        message.error(error);
      }

      if (account && bind) {
        setActiveView("account");
        url.searchParams.delete("account");
        url.searchParams.delete("bind");
        url.searchParams.delete("message");
        window.history.replaceState({}, "", url.toString());
        const accountLabel = account === "github" ? "GitHub" : "微信";
        if (bind === "success") {
          message.success(bindMessage || `${accountLabel}账号绑定成功`);
        } else {
          message.error(bindMessage || `${accountLabel}账号绑定失败`);
        }
      }

      const user = await bootstrap();
      if (account && bind === "success" && user) {
        const bound =
          account === "github" ? user.githubBound : account === "wechat" ? user.wechatBound : true;
        if (!bound) {
          const accountLabel = account === "github" ? "GitHub" : "微信";
          message.error(`${accountLabel}绑定未生效，请重试`);
        }
      }
    };

    void run();
  }, [bootstrap, message]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const availableViews: ViewKey[] = ["dashboard", "account", "tasks", "calendar"];
    if (canUserManage) {
      availableViews.push("users");
    }
    if (canRoleManage) {
      availableViews.push("roles");
    }
    if (canSettingsManage) {
      availableViews.push("settings");
    }

    if (!availableViews.includes(activeView)) {
      setActiveView(availableViews[0]);
    }
  }, [activeView, canRoleManage, canSettingsManage, canUserManage, currentUser]);

  const filteredTasks = useMemo(() => {
    return sortTasks(
      tasks.filter((task) => {
        const keyword = taskKeyword.trim().toLowerCase();
        const keywordMatch =
          !keyword ||
          task.title.toLowerCase().includes(keyword) ||
          task.content.toLowerCase().includes(keyword);
        const statusMatch =
          taskStatusFilter === "all" || task.status === taskStatusFilter;
        return keywordMatch && statusMatch;
      })
    );
  }, [taskKeyword, taskStatusFilter, tasks]);

  const calendarDates = useMemo(
    () => getRangeDates(calendarMode, calendarAnchor),
    [calendarAnchor, calendarMode]
  );

  const handleLogin = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    try {
      const result = await api.login(values);
      setToken(result.token);
      setCurrentUser(result.user);
      await refreshData(result.user);
      message.success(`欢迎回来，${result.user.displayName}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
      setBooting(false);
    }
  };

  const handleWechatLogin = async () => {
    try {
      const result = await api.getWechatUrl();
      window.location.href = result.url;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "无法发起微信登录");
    }
  };

  const handleGithubLogin = async () => {
    try {
      try {
        const result = await api.getGithubUrl();
        window.location.href = result.url;
        return;
      } catch {}

      const clientId = clientConfig.githubClientId;
      if (!clientId) {
        throw new Error("GitHub Client ID 未配置");
      }

      const redirectUri = "http://localhost:3002/api/auth/github/callback";
      const scope = "read:user user:email";
      const state =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state
      });
      window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "无法发起 GitHub 登录");
    }
  };

  const toBase64Url = (bytes: Uint8Array) => {
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const fromBase64Url = (input: string) => {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
    const raw = atob(padded);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      out[i] = raw.charCodeAt(i);
    }
    return out;
  };

  const credentialToJson = (credential: PublicKeyCredential) => {
    const response = credential.response as AuthenticatorResponse;
    const base = {
      id: credential.id,
      type: credential.type,
      rawId: toBase64Url(new Uint8Array(credential.rawId))
    };

    if ("attestationObject" in response) {
      const att = response as AuthenticatorAttestationResponse;
      return {
        ...base,
        response: {
          clientDataJSON: toBase64Url(new Uint8Array(att.clientDataJSON)),
          attestationObject: toBase64Url(new Uint8Array(att.attestationObject))
        }
      };
    }

    const ass = response as AuthenticatorAssertionResponse;
    return {
      ...base,
      response: {
        clientDataJSON: toBase64Url(new Uint8Array(ass.clientDataJSON)),
        authenticatorData: toBase64Url(new Uint8Array(ass.authenticatorData)),
        signature: toBase64Url(new Uint8Array(ass.signature)),
        userHandle: ass.userHandle ? toBase64Url(new Uint8Array(ass.userHandle)) : null
      }
    };
  };

  const handlePasskeyLogin = async () => {
    if (!window.isSecureContext) {
      message.error(`指纹登录需要 HTTPS 安全上下文（当前：${window.location.origin}）`);
      return;
    }

    if (!window.PublicKeyCredential || !navigator.credentials) {
      message.error("当前浏览器不支持指纹登录，请使用其他方式登录");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.getPasskeyLoginOptions();
      const options = result.publicKey as {
        challenge: string;
        rpId?: string;
        timeout?: number;
        userVerification?: PublicKeyCredentialUserVerificationRequirement;
        allowCredentials?: { type: PublicKeyCredentialType; id: string }[];
      };

      const publicKey: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: fromBase64Url(options.challenge).buffer,
        allowCredentials: options.allowCredentials?.map((cred) => ({
          type: cred.type,
          id: fromBase64Url(cred.id).buffer
        }))
      };

      const cred = (await navigator.credentials.get({
        publicKey
      })) as PublicKeyCredential | null;

      if (!cred) {
        throw new Error("未获取到指纹凭证");
      }

      const loginResult = await api.verifyPasskeyLogin({ credential: credentialToJson(cred) });
      setToken(loginResult.token);
      setCurrentUser(loginResult.user);
      await refreshData(loginResult.user);
      message.success(`欢迎回来，${loginResult.user.displayName}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "指纹登录失败");
    } finally {
      setSubmitting(false);
      setBooting(false);
    }
  };

  const handlePasskeyBind = async () => {
    if (!window.isSecureContext) {
      message.error(`绑定指纹登录需要 HTTPS 安全上下文（当前：${window.location.origin}）`);
      return;
    }

    if (!window.PublicKeyCredential || !navigator.credentials) {
      message.error("当前浏览器不支持指纹绑定，请使用其他方式登录");
      return;
    }

    setSubmitting(true);
    try {
      const optionsResult = await api.getPasskeyRegisterOptions();
      const options = optionsResult.publicKey as {
        challenge: string;
        rp: { name: string; id?: string };
        user: { id: string; name: string; displayName: string };
        pubKeyCredParams: { type: PublicKeyCredentialType; alg: number }[];
        timeout?: number;
        attestation?: AttestationConveyancePreference;
        authenticatorSelection?: AuthenticatorSelectionCriteria;
      };

      const publicKey: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: fromBase64Url(options.challenge).buffer,
        user: {
          ...options.user,
          id: fromBase64Url(options.user.id).buffer
        }
      };

      const cred = (await navigator.credentials.create({
        publicKey
      })) as PublicKeyCredential | null;

      if (!cred) {
        throw new Error("未创建指纹凭证");
      }

      await api.verifyPasskeyRegister({ credential: credentialToJson(cred) });
      const user = await syncCurrentUser();
      await refreshData(user);
      await loadPasskeys();
      message.success("指纹登录绑定成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "绑定指纹登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const loadPasskeys = useCallback(async () => {
    try {
      const result = await api.listPasskeys();
      setPasskeys(result.passkeys);
    } catch {}
  }, []);

  useEffect(() => {
    if (currentUser && activeView === "account") {
      void loadPasskeys();
    }
  }, [activeView, currentUser, loadPasskeys]);

  const handlePasskeyUnbind = async (credentialId: string) => {
    setSubmitting(true);
    try {
      await api.deletePasskey(credentialId);
      const user = await syncCurrentUser();
      await refreshData(user);
      await loadPasskeys();
      message.success("指纹凭证已解除绑定");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "解除绑定失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWechatBind = async () => {
    try {
      const result = await api.getWechatBindUrl();
      window.location.href = result.url;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "无法发起微信绑定");
    }
  };

  const handleWechatUnbind = async () => {
    if (!window.confirm("解除绑定后将无法继续通过微信扫码登录当前账号，确定继续吗？")) {
      return;
    }

    setSubmitting(true);
    try {
      await api.unbindWechat();
      const user = await syncCurrentUser();
      await refreshData(user);
      message.success("微信绑定已解除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "解除微信绑定失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGithubBind = async () => {
    try {
      const result = await api.getGithubBindUrl();
      window.location.href = result.url;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "无法发起 GitHub 绑定");
    }
  };

  const handleGithubUnbind = async () => {
    if (!window.confirm("解除绑定后将无法继续通过 GitHub 登录当前账号，确定继续吗？")) {
      return;
    }

    setSubmitting(true);
    try {
      await api.unbindGithub();
      const user = await syncCurrentUser();
      await refreshData(user);
      message.success("GitHub 绑定已解除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "解除 GitHub 绑定失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setDashboard(null);
    setTasks([]);
    setUsers([]);
    setRoles([]);
    setSettings(null);
    message.success("已退出登录");
  };

  const openTaskModal = (task?: TaskRecord) => {
    setTaskModalTarget(task ?? null);
    setTaskModalOpen(true);
    taskForm.setFieldsValue({
      title: task?.title ?? "",
      content: task?.content ?? "",
      status: task?.status ?? "todo",
      priority: task?.priority ?? "medium",
      dateRange:
        task?.startAt && task?.endAt
          ? [dayjs(task.startAt), dayjs(task.endAt)]
          : undefined
    });
  };

  const submitTask = async () => {
    const values = await taskForm.validateFields();
    const payload = {
      title: values.title,
      content: values.content,
      status: values.status,
      priority: values.priority,
      startAt: values.dateRange?.[0]?.toISOString() ?? null,
      endAt: values.dateRange?.[1]?.toISOString() ?? null
    };

    setSubmitting(true);
    try {
      if (taskModalTarget) {
        await api.updateTask(taskModalTarget.id, payload);
        message.success("事务已更新");
      } else {
        await api.createTask(payload);
        message.success("事务已创建");
      }
      setTaskModalOpen(false);
      taskForm.resetFields();
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存事务失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (task: TaskRecord) => {
    setSubmitting(true);
    try {
      await api.deleteTask(task.id);
      message.success("事务已删除");
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除事务失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openUserModal = (user?: User) => {
    setUserModalTarget(user ?? null);
    setUserModalOpen(true);
    userForm.setFieldsValue({
      username: user?.username ?? "",
      password: "",
      displayName: user?.displayName ?? "",
      email: user?.email ?? "",
      status: user?.status ?? "enabled",
      roleIds: user?.roleIds ?? []
    });
  };

  const submitUser = async () => {
    const values = await userForm.validateFields();
    setSubmitting(true);
    try {
      if (userModalTarget) {
        await api.updateUser(userModalTarget.id, {
          username: values.username,
          password: values.password,
          displayName: values.displayName,
          email: values.email,
          status: values.status,
          roleIds: values.roleIds
        });
        message.success("用户已更新");
      } else {
        await api.createUser({
          username: values.username ?? "",
          password: values.password ?? "",
          displayName: values.displayName,
          email: values.email,
          status: values.status,
          roleIds: values.roleIds
        });
        message.success("用户已创建");
      }
      setUserModalOpen(false);
      userForm.resetFields();
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存用户失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    setSubmitting(true);
    try {
      await api.deleteUser(user.id);
      message.success("用户已删除");
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除用户失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openRoleModal = (role?: Role) => {
    setRoleModalTarget(role ?? null);
    setRoleModalOpen(true);
    roleForm.setFieldsValue({
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissions: role?.permissions ?? ["task:manage_own"]
    });
  };

  const submitRole = async () => {
    const values = await roleForm.validateFields();
    setSubmitting(true);
    try {
      if (roleModalTarget) {
        await api.updateRole(roleModalTarget.id, values);
        message.success("角色已更新");
      } else {
        await api.createRole(values);
        message.success("角色已创建");
      }
      setRoleModalOpen(false);
      roleForm.resetFields();
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存角色失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRole = async (role: Role) => {
    setSubmitting(true);
    try {
      await api.toggleRoleDisabled(role.id, !role.disabled);
      message.success(role.disabled ? "角色已启用" : "角色已禁用");
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新角色状态失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    setSubmitting(true);
    try {
      await api.deleteRole(role.id);
      message.success("角色已删除");
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除角色失败");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSettings = async () => {
    const values = await settingsForm.validateFields();
    setSubmitting(true);
    try {
      await api.updateSettings(values);
      setSettings(values);
      message.success("系统配置已保存");
      if (currentUser) {
        await refreshData(currentUser);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: async (file) => {
      setTranscribing(true);
      try {
        const result = await api.transcribe(file as File);
        const current = taskForm.getFieldValue("content") ?? "";
        taskForm.setFieldValue(
          "content",
          current ? `${current}\n${result.text}` : result.text
        );
        message.success("语音转文字成功，已追加到正文");
      } catch (error) {
        message.error(error instanceof Error ? error.message : "语音转文字失败");
      } finally {
        setTranscribing(false);
      }
      return false;
    }
  };

  const taskColumns: TableColumnsType<TaskRecord> = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.title}</Text>
          <Text type="secondary">{record.content.slice(0, 48) || "无正文"}</Text>
        </Space>
      )
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (value: TaskStatus) => (
        <Tag color={STATUS_COLORS[value]}>{STATUS_LABELS[value]}</Tag>
      )
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (value: TaskPriority) => (
        <Tag color={PRIORITY_COLORS[value]}>{PRIORITY_LABELS[value]}</Tag>
      )
    },
    {
      title: "时间",
      key: "time",
      render: (_value, record) => (
        <Space direction="vertical" size={2}>
          <Text>{formatDateTime(record.startAt)}</Text>
          <Text type="secondary">至 {formatDateTime(record.endAt)}</Text>
        </Space>
      )
    },
    {
      title: "创建人",
      dataIndex: "createdByName",
      key: "createdByName",
      width: 140
    },
    {
      title: "操作",
      key: "action",
      width: 140,
      render: (_value, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openTaskModal(record)}
          >
            编辑
          </Button>
          <Button
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => void handleDeleteTask(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const userColumns: TableColumnsType<User> = [
    {
      title: "账号",
      dataIndex: "username",
      key: "username",
      render: (value: string | null, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.displayName}</Text>
          <Text type="secondary">{value ?? "未设置账号"}</Text>
        </Space>
      )
    },
    {
      title: "登录来源",
      dataIndex: "authSource",
      key: "authSource",
      width: 120,
      render: (value: User["authSource"]) => (
        <Tag color={value === "wechat" ? "green" : "blue"}>
          {value === "wechat" ? "微信" : "本地"}
        </Tag>
      )
    },
    {
      title: "微信绑定",
      dataIndex: "wechatBound",
      key: "wechatBound",
      width: 110,
      render: (value: boolean) => (
        <Tag color={value ? "green" : "default"}>{value ? "已绑定" : "未绑定"}</Tag>
      )
    },
    {
      title: "GitHub绑定",
      dataIndex: "githubBound",
      key: "githubBound",
      width: 120,
      render: (value: boolean) => (
        <Tag color={value ? "green" : "default"}>{value ? "已绑定" : "未绑定"}</Tag>
      )
    },
    {
      title: "角色",
      dataIndex: "roleNames",
      key: "roleNames",
      render: (value: string[]) => value.join("、")
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (value: User["status"]) => (
        <Tag color={value === "enabled" ? "green" : "red"}>
          {value === "enabled" ? "启用" : "禁用"}
        </Tag>
      )
    },
    {
      title: "操作",
      key: "action",
      width: 140,
      render: (_value, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openUserModal(record)}
          >
            编辑
          </Button>
          <Button
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => void handleDeleteUser(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const roleColumns: TableColumnsType<Role> = [
    {
      title: "角色",
      dataIndex: "name",
      key: "name",
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>
            {value}
            {record.system ? "（系统）" : ""}
          </Text>
          <Text type="secondary">{record.description || "暂无描述"}</Text>
        </Space>
      )
    },
    {
      title: "权限",
      dataIndex: "permissions",
      key: "permissions",
      render: (value: Permission[]) =>
        value.map((item) => PERMISSION_LABELS[item]).join("、")
    },
    {
      title: "状态",
      dataIndex: "disabled",
      key: "disabled",
      width: 100,
      render: (value: boolean) => (
        <Tag color={value ? "red" : "green"}>{value ? "禁用" : "启用"}</Tag>
      )
    },
    {
      title: "操作",
      key: "action",
      width: 220,
      render: (_value, record) => (
        <Space wrap>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openRoleModal(record)}
          >
            编辑
          </Button>
          <Button type="link" onClick={() => void handleToggleRole(record)}>
            {record.disabled ? "启用" : "禁用"}
          </Button>
          {!record.system ? (
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              onClick={() => void handleDeleteRole(record)}
            >
              删除
            </Button>
          ) : null}
        </Space>
      )
    }
  ];

  const menuItems: MenuProps["items"] = [
    { key: "dashboard", icon: <DashboardOutlined />, label: "总览" },
    { key: "account", icon: <WechatOutlined />, label: "账号管理" },
    { key: "tasks", icon: <SolutionOutlined />, label: "事务列表" },
    { key: "calendar", icon: <CalendarOutlined />, label: "日历视图" },
    ...(canUserManage
      ? [{ key: "users", icon: <TeamOutlined />, label: "用户管理" }]
      : []),
    ...(canRoleManage
      ? [{ key: "roles", icon: <UserOutlined />, label: "角色管理" }]
      : []),
    ...(canSettingsManage
      ? [{ key: "settings", icon: <SettingOutlined />, label: "系统配置" }]
      : [])
  ];

  if (booting) {
    return (
      <div className="boot-screen">
        <Spin size="large" fullscreen tip="正在加载系统..." />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Title level={2}>语音转文字事务记录网页</Title>
              <Text type="secondary">
                React + Ant Design 前端、Express + TypeScript 后端、PostgreSQL
                持久化、日历视图与微信登录。
              </Text>
            </div>

            <Form
              form={loginForm}
              layout="vertical"
              initialValues={{ username: "admin", password: "admin123" }}
              onFinish={(values) => void handleLogin(values)}
            >
              <Form.Item
                label="账号"
                name="username"
                rules={[{ required: true, message: "请输入账号" }]}
              >
                <Input placeholder="请输入账号" />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: "请输入密码" }]}
              >
                <Password placeholder="请输入密码" />
              </Form.Item>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button type="primary" htmlType="submit" loading={submitting} block>
                  本地账号登录
                </Button>
                <Button
                  icon={<WechatOutlined />}
                  block
                  onClick={() => void handleWechatLogin()}
                >
                  微信扫码登录
                </Button>
                <Button
                  icon={<GithubOutlined />}
                  block
                  onClick={() => void handleGithubLogin()}
                >
                  GitHub oidc sso 登录
                </Button>
                <Button
                  icon={<SafetyOutlined />}
                  block
                  onClick={() => void handlePasskeyLogin()}
                >
                  手机指纹验证登录
                </Button>
              </Space>
            </Form>

            <Card size="small" title="默认账号">
              <Text>管理员：admin / admin123</Text>
              <br />
              <Text>员工：demo / demo123</Text>
            </Card>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <Layout className="app-layout">
      <Sider width={240} theme="light" breakpoint="lg">
        <div className="sider-brand">
          <Title level={4} style={{ margin: 0 }}>
            事务记录工作台
          </Title>
          <Text type="secondary">{currentUser.displayName}</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeView]}
          items={menuItems}
          onClick={({ key }) => setActiveView(key as ViewKey)}
        />
        <div className="sider-footer">
          <Button icon={<LogoutOutlined />} block onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </Sider>

      <Layout>
        <Header className="app-header">
          <Space direction="vertical" size={2}>
            <Title level={3} style={{ margin: 0 }}>
              {activeView === "dashboard"
                ? "业务总览"
                : activeView === "account"
                  ? "账号管理"
                : activeView === "tasks"
                  ? "事务列表"
                  : activeView === "calendar"
                    ? "日历视图"
                    : activeView === "users"
                      ? "用户管理"
                      : activeView === "roles"
                        ? "角色管理"
                        : "系统配置"}
            </Title>
            <Text type="secondary">
              当前角色：{currentUser.roleNames.join("、") || "未分配角色"}
            </Text>
          </Space>
        </Header>

        <Content className="app-content">
          <Spin spinning={refreshing || submitting}>
            {activeView === "dashboard" ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12} xl={6}>
                    <Card>
                      <Statistic title="可见事务" value={dashboard?.total ?? 0} />
                    </Card>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Card>
                      <Statistic title="待处理" value={dashboard?.todo ?? 0} />
                    </Card>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Card>
                      <Statistic title="进行中" value={dashboard?.inProgress ?? 0} />
                    </Card>
                  </Col>
                  <Col xs={24} md={12} xl={6}>
                    <Card>
                      <Statistic title="已完成" value={dashboard?.done ?? 0} />
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={14}>
                    <Card
                      title="最近事务"
                      extra={
                        <Button type="link" onClick={() => setActiveView("tasks")}>
                          查看全部
                        </Button>
                      }
                    >
                      <List
                        dataSource={filteredTasks.slice(0, 6)}
                        locale={{ emptyText: "暂无事务" }}
                        renderItem={(item) => (
                          <List.Item
                            actions={[
                              <Button
                                key="edit"
                                type="link"
                                onClick={() => openTaskModal(item)}
                              >
                                编辑
                              </Button>
                            ]}
                          >
                            <List.Item.Meta
                              title={
                                <Space>
                                  <Text strong>{item.title}</Text>
                                  <Tag color={STATUS_COLORS[item.status]}>
                                    {STATUS_LABELS[item.status]}
                                  </Tag>
                                </Space>
                              }
                              description={`${formatDateTime(item.startAt)} - ${formatDateTime(item.endAt)} / ${item.createdByName}`}
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} xl={10}>
                    <Card title="集成说明">
                      <List
                        dataSource={[
                          "支持本地账号登录与微信网页扫码登录结构。",
                          "语音转文字通过后端代理调用 funASR 服务。",
                          "事务支持月、周、3 日、日四种日历查阅方式。",
                          "主数据已迁移到 PostgreSQL，不再以 localStorage 为主存储。"
                        ]}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                    </Card>
                  </Col>
                </Row>
              </Space>
            ) : null}

            {activeView === "account" ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card title="账号信息">
                  <Descriptions column={{ xs: 1, md: 2 }}>
                    <Descriptions.Item label="姓名">
                      {currentUser.displayName}
                    </Descriptions.Item>
                    <Descriptions.Item label="账号">
                      {currentUser.username ?? "未设置账号"}
                    </Descriptions.Item>
                    <Descriptions.Item label="邮箱">
                      {currentUser.email ?? "未填写"}
                    </Descriptions.Item>
                    <Descriptions.Item label="当前角色">
                      {currentUser.roleNames.join("、") || "未分配角色"}
                    </Descriptions.Item>
                    <Descriptions.Item label="登录来源">
                      <Tag color={currentUser.authSource === "wechat" ? "green" : "blue"}>
                        {currentUser.authSource === "wechat" ? "微信" : "本地"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="微信绑定状态">
                      <Tag color={currentUser.wechatBound ? "green" : "default"}>
                        {currentUser.wechatBound ? "已绑定" : "未绑定"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="GitHub 绑定状态">
                      <Tag color={currentUser.githubBound ? "green" : "default"}>
                        {currentUser.githubBound ? "已绑定" : "未绑定"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="指纹登录状态">
                      <Tag color={currentUser.passkeyBound ? "green" : "default"}>
                        {currentUser.passkeyBound ? `已绑定 ${currentUser.passkeyCount} 个` : "未绑定"}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="微信扫码登录绑定">
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Text>
                      绑定后，同一个账号可以直接通过微信扫码登录，不需要再单独创建新的微信账号。
                    </Text>
                    <List
                      size="small"
                      dataSource={[
                        "点击“绑定微信扫码登录”后，会跳转到微信扫码授权页面。",
                        "未配置正式微信参数时，系统会自动走演示扫码绑定流程。",
                        "如果该微信号已经绑定到其他账号，系统会直接提示绑定失败。"
                      ]}
                      renderItem={(item) => <List.Item>{item}</List.Item>}
                    />
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<WechatOutlined />}
                        onClick={() => void handleWechatBind()}
                      >
                        {currentUser.wechatBound ? "重新绑定微信扫码登录" : "绑定微信扫码登录"}
                      </Button>
                      {currentUser.wechatBound ? (
                        <Button danger onClick={() => void handleWechatUnbind()}>
                          解除微信绑定
                        </Button>
                      ) : null}
                    </Space>
                  </Space>
                </Card>

                <Card title="GitHub OAuth 绑定">
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Text>
                      绑定后，同一个账号可以通过 GitHub OAuth 进行登录（当前版本优先实现绑定，登录功能后续按需开启）。
                    </Text>
                    <List
                      size="small"
                      dataSource={[
                        "点击“绑定 GitHub”后会跳转到 GitHub 授权页面。",
                        "未配置 GitHub Client ID/Secret 时，系统会自动走演示绑定流程。",
                        "如果该 GitHub 账号已经绑定到其他账号，会提示绑定失败。"
                      ]}
                      renderItem={(item) => <List.Item>{item}</List.Item>}
                    />
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<GithubOutlined />}
                        onClick={() => void handleGithubBind()}
                      >
                        {currentUser.githubBound ? "重新绑定 GitHub" : "绑定 GitHub"}
                      </Button>
                      {currentUser.githubBound ? (
                        <Button danger onClick={() => void handleGithubUnbind()}>
                          解除 GitHub 绑定
                        </Button>
                      ) : null}
                    </Space>
                  </Space>
                </Card>

                <Card title="手机指纹登录绑定">
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Text>
                      绑定后，可以在登录页使用手机指纹/人脸验证完成登录（需要浏览器支持 WebAuthn / Passkey）。
                    </Text>
                    {currentUser.passkeyBound ? (
                      <Tag color="green">已绑定 {currentUser.passkeyCount} 个指纹凭证</Tag>
                    ) : (
                      <Tag color="default">未绑定</Tag>
                    )}
                    {passkeys.length > 0 && (
                      <List
                        size="small"
                        bordered
                        dataSource={passkeys}
                        renderItem={(item) => (
                          <List.Item
                            actions={[
                              <Button
                                key="unbind"
                                type="link"
                                danger
                                size="small"
                                onClick={() => void handlePasskeyUnbind(item.credentialId)}
                              >
                                解除绑定
                              </Button>
                            ]}
                          >
                            <List.Item.Meta
                              title={`凭证 ${item.credentialId.slice(0, 16)}...`}
                              description={`绑定时间：${formatDateTime(item.createdAt)}`}
                            />
                          </List.Item>
                        )}
                      />
                    )}
                    <Space wrap>
                      <Button
                        type="primary"
                        icon={<SafetyOutlined />}
                        onClick={() => void handlePasskeyBind()}
                      >
                        {currentUser.passkeyBound ? "重新绑定指纹登录" : "绑定指纹登录"}
                      </Button>
                    </Space>
                  </Space>
                </Card>
              </Space>
            ) : null}

            {activeView === "tasks" ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={8}>
                      <Input.Search
                        placeholder="搜索标题或正文"
                        allowClear
                        onChange={(event) => setTaskKeyword(event.target.value)}
                      />
                    </Col>
                    <Col xs={24} md={5}>
                      <Select
                        value={taskStatusFilter}
                        style={{ width: "100%" }}
                        onChange={setTaskStatusFilter}
                        options={[
                          { label: "全部状态", value: "all" },
                          { label: "待处理", value: "todo" },
                          { label: "进行中", value: "in_progress" },
                          { label: "已完成", value: "done" }
                        ]}
                      />
                    </Col>
                    <Col xs={24} md={11} style={{ textAlign: "right" }}>
                      <Space wrap>
                        <Button
                          onClick={() =>
                            void (currentUser ? refreshData(currentUser) : Promise.resolve())
                          }
                        >
                          刷新
                        </Button>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          disabled={!canTaskCreate}
                          onClick={() => openTaskModal()}
                        >
                          新建事务
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>
                <Card>
                  <Table
                    rowKey="id"
                    columns={taskColumns}
                    dataSource={filteredTasks}
                    pagination={{ pageSize: 8 }}
                  />
                </Card>
              </Space>
            ) : null}

            {activeView === "calendar" ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card>
                  <Row gutter={[16, 16]} justify="space-between" align="middle">
                    <Col>
                      <Space wrap>
                        <Segmented<CalendarMode>
                          value={calendarMode}
                          onChange={(value) => setCalendarMode(value)}
                          options={[
                            { label: "按月", value: "month" },
                            { label: "按周", value: "week" },
                            { label: "按3日", value: "3day" },
                            { label: "按日", value: "day" }
                          ]}
                        />
                        <DatePicker
                          value={calendarAnchor}
                          onChange={(value) => value && setCalendarAnchor(value)}
                        />
                      </Space>
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        disabled={!canTaskCreate}
                        onClick={() => openTaskModal()}
                      >
                        新建事务
                      </Button>
                    </Col>
                  </Row>
                </Card>

                {calendarMode === "month" ? (
                  <Card>
                    <Calendar
                      value={calendarAnchor}
                      onPanelChange={(value) => setCalendarAnchor(value)}
                      onSelect={(value) => setCalendarAnchor(value)}
                      cellRender={(current) => {
                        const dayTasks = filteredTasks.filter((task) =>
                          taskTouchesDate(task, current)
                        );
                        return (
                          <div className="calendar-cell">
                            {dayTasks.slice(0, 3).map((task) => (
                              <Tag
                                className="calendar-tag"
                                color={STATUS_COLORS[task.status]}
                                key={`${current.valueOf()}-${task.id}`}
                              >
                                {task.title}
                              </Tag>
                            ))}
                            {dayTasks.length > 3 ? (
                              <Text type="secondary">+{dayTasks.length - 3} 条</Text>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                  </Card>
                ) : (
                  <Row gutter={[16, 16]}>
                    {calendarDates.map((date) => {
                      const dateTasks = filteredTasks.filter((task) =>
                        taskTouchesDate(task, date)
                      );
                      const span =
                        calendarMode === "day" ? 24 : calendarMode === "3day" ? 8 : 6;
                      return (
                        <Col xs={24} md={span} key={date.toISOString()}>
                          <Card title={date.format("MM-DD dddd")}>
                            {dateTasks.length === 0 ? (
                              <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description="当天暂无事务"
                              />
                            ) : (
                              <List
                                dataSource={dateTasks}
                                renderItem={(task) => (
                                  <List.Item
                                    actions={[
                                      <Button
                                        key="edit"
                                        type="link"
                                        onClick={() => openTaskModal(task)}
                                      >
                                        查看
                                      </Button>
                                    ]}
                                  >
                                    <List.Item.Meta
                                      title={
                                        <Space>
                                          <Tag color={STATUS_COLORS[task.status]}>
                                            {STATUS_LABELS[task.status]}
                                          </Tag>
                                          <Text strong>{task.title}</Text>
                                        </Space>
                                      }
                                      description={`${formatDateTime(task.startAt)} - ${formatDateTime(task.endAt)}`}
                                    />
                                  </List.Item>
                                )}
                              />
                            )}
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                )}
              </Space>
            ) : null}

            {activeView === "users" && canUserManage ? (
              <Card
                title="用户管理"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openUserModal()}
                  >
                    新增用户
                  </Button>
                }
              >
                <Table
                  rowKey="id"
                  columns={userColumns}
                  dataSource={users}
                  pagination={{ pageSize: 8 }}
                />
              </Card>
            ) : null}

            {activeView === "roles" && canRoleManage ? (
              <Card
                title="角色管理"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openRoleModal()}
                  >
                    新增角色
                  </Button>
                }
              >
                <Table
                  rowKey="id"
                  columns={roleColumns}
                  dataSource={roles}
                  pagination={false}
                />
              </Card>
            ) : null}

            {activeView === "settings" && canSettingsManage ? (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card title="系统配置">
                  <Form
                    form={settingsForm}
                    layout="vertical"
                    initialValues={settings ?? undefined}
                  >
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="funASR 服务地址"
                          name={["integrations", "funasrServiceUrl"]}
                        >
                          <Input placeholder="例如：http://127.0.0.1:8000" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="funASR 路径"
                          name={["integrations", "funasrApiPath"]}
                        >
                          <Input placeholder="/recognize" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="funASR Token"
                          name={["integrations", "funasrToken"]}
                        >
                          <Input.Password placeholder="可选" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="微信 AppID"
                          name={["integrations", "wechatAppId"]}
                        >
                          <Input placeholder="未配置则走演示微信登录" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="SSO 提供方"
                          name={["integrations", "ssoProvider"]}
                        >
                          <Input placeholder="企业微信 / OAuth" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="SSO 预留开关"
                          name={["integrations", "ssoEnabled"]}
                        >
                          <Select
                            options={[
                              { label: "关闭", value: false },
                              { label: "开启", value: true }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Button type="primary" onClick={() => void submitSettings()}>
                      保存配置
                    </Button>
                  </Form>
                </Card>

                <Card title="接入说明">
                  <List
                    dataSource={[
                      "前端通过 /api 调用 Express 后端，由后端统一访问 PostgreSQL 与 funASR。",
                      "微信扫码登录未配置 AppID/AppSecret 时，系统自动走演示回调链路。",
                      "正式上线时建议把微信 AppSecret 放到服务端环境变量，而不是前端页面。"
                    ]}
                    renderItem={(item) => <List.Item>{item}</List.Item>}
                  />
                </Card>
              </Space>
            ) : null}
          </Spin>
        </Content>
      </Layout>

      <Modal
        title={taskModalTarget ? "编辑事务" : "新建事务"}
        open={taskModalOpen}
        onCancel={() => setTaskModalOpen(false)}
        onOk={() => void submitTask()}
        confirmLoading={submitting}
        width={760}
        destroyOnClose
      >
        <Form
          form={taskForm}
          layout="vertical"
          initialValues={{ status: "todo", priority: "medium" }}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input placeholder="请输入事务标题" />
          </Form.Item>
          <Form.Item
            label="正文"
            name="content"
            rules={[{ required: true, message: "请输入事务正文" }]}
          >
            <TextArea rows={6} placeholder="可直接输入内容，也可上传音频转写" />
          </Form.Item>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Form.Item label="状态" name="status" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "待处理", value: "todo" },
                    { label: "进行中", value: "in_progress" },
                    { label: "已完成", value: "done" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="优先级" name="priority" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "低", value: "low" },
                    { label: "中", value: "medium" },
                    { label: "高", value: "high" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="日历时间段" name="dateRange">
                <RangePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Upload {...uploadProps}>
              <Button icon={<SoundOutlined />} loading={transcribing}>
                上传音频并调用 funASR
              </Button>
            </Upload>
            <Text type="secondary">
              支持在编辑事务时直接把转写结果追加到正文
            </Text>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={userModalTarget ? "编辑用户" : "新增用户"}
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        onOk={() => void submitUser()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={userForm}
          layout="vertical"
          initialValues={{ status: "enabled", roleIds: [] }}
        >
          <Form.Item
            label="账号"
            name="username"
            rules={[{ required: true, message: "请输入账号" }]}
          >
            <Input
              placeholder="请输入账号"
              disabled={userModalTarget?.authSource === "wechat"}
            />
          </Form.Item>
          <Form.Item
            label={userModalTarget ? "重置密码" : "初始密码"}
            name="password"
            rules={
              userModalTarget ? [] : [{ required: true, message: "请输入密码" }]
            }
          >
            <Password
              placeholder={
                userModalTarget ? "不填写则保持原密码" : "请输入初始密码"
              }
            />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="displayName"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "启用", value: "enabled" },
                { label: "禁用", value: "disabled" }
              ]}
            />
          </Form.Item>
          <Form.Item
            label="角色"
            name="roleIds"
            rules={[{ required: true, message: "请至少选择一个角色" }]}
          >
            <Select
              mode="multiple"
              options={roles.map((role) => ({ label: role.name, value: role.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={roleModalTarget ? "编辑角色" : "新增角色"}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={() => void submitRole()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={roleForm}
          layout="vertical"
          initialValues={{ permissions: ["task:manage_own"] }}
        >
          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, message: "请输入角色名称" }]}
          >
            <Input placeholder="例如：销售经理" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={4} placeholder="请输入角色描述" />
          </Form.Item>
          <Form.Item
            label="权限"
            name="permissions"
            rules={[{ required: true, message: "请至少选择一个权限" }]}
          >
            <Select
              mode="multiple"
              options={Object.entries(PERMISSION_LABELS).map(([value, label]) => ({
                label,
                value
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default function AppShell() {
  return (
    <AntdApp>
      <AppShellInner />
    </AntdApp>
  );
}
