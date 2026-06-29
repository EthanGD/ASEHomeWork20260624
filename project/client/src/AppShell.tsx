import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App as AntdApp,
  Button,
  Form,
  Layout,
  Menu,
  Space,
  Spin,
  Tag,
  Typography
} from "antd";
import type { MenuProps, TableColumnsType, UploadProps } from "antd";
import {
  CalendarOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  LogoutOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  WechatOutlined
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { api, clearToken, getToken, setToken } from "./api";
import {
  CalendarMode,
  PERMISSION_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  formatDateTime,
  getRangeDates,
  hasPermission,
  sortTasks,
  taskTouchesDate
} from "./appShellUtils";
import { clientConfig } from "./config";
import { RoleFormValues, RoleModal } from "./components/modals/RoleModal";
import { TaskFormValues, TaskModal } from "./components/modals/TaskModal";
import { UserFormValues, UserModal } from "./components/modals/UserModal";
import { AccountView } from "./views/AccountView";
import { CalendarView } from "./views/CalendarView";
import { DashboardView } from "./views/DashboardView";
import { LoginView } from "./views/LoginView";
import { RolesView } from "./views/RolesView";
import { SettingsView } from "./views/SettingsView";
import { TasksView } from "./views/TasksView";
import { UsersView } from "./views/UsersView";
import { credentialToJson, fromBase64Url, toBase64Url } from "./webauthnUtils";
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
const { Title, Text } = Typography;

type ViewKey =
  | "dashboard"
  | "account"
  | "tasks"
  | "calendar"
  | "users"
  | "roles"
  | "settings";

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
      <LoginView
        submitting={submitting}
        onLogin={(values) => void handleLogin(values)}
        onWechatLogin={() => void handleWechatLogin()}
        onGithubLogin={() => void handleGithubLogin()}
        onPasskeyLogin={() => void handlePasskeyLogin()}
      />
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
              <DashboardView
                dashboard={dashboard}
                recentTasks={filteredTasks.slice(0, 6)}
                onViewAllTasks={() => setActiveView("tasks")}
                onEditTask={(task) => openTaskModal(task)}
              />
            ) : null}

            {activeView === "account" ? (
              <AccountView
                currentUser={currentUser}
                passkeys={passkeys}
                formatDateTime={formatDateTime}
                onWechatBind={() => void handleWechatBind()}
                onWechatUnbind={() => void handleWechatUnbind()}
                onGithubBind={() => void handleGithubBind()}
                onGithubUnbind={() => void handleGithubUnbind()}
                onPasskeyBind={() => void handlePasskeyBind()}
                onPasskeyUnbind={(credentialId) => void handlePasskeyUnbind(credentialId)}
              />
            ) : null}

            {activeView === "tasks" ? (
              <TasksView
                currentUser={currentUser}
                canTaskCreate={canTaskCreate}
                taskStatusFilter={taskStatusFilter}
                onTaskStatusFilterChange={setTaskStatusFilter}
                onTaskKeywordChange={setTaskKeyword}
                onRefresh={(user) => void refreshData(user)}
                onCreate={() => openTaskModal()}
                taskColumns={taskColumns}
                tasks={filteredTasks}
              />
            ) : null}

            {activeView === "calendar" ? (
              <CalendarView
                calendarMode={calendarMode}
                onCalendarModeChange={setCalendarMode}
                calendarAnchor={calendarAnchor}
                onCalendarAnchorChange={setCalendarAnchor}
                canTaskCreate={canTaskCreate}
                onCreate={() => openTaskModal()}
                tasks={filteredTasks}
                onViewTask={(task) => openTaskModal(task)}
              />
            ) : null}

            {activeView === "users" && canUserManage ? (
              <UsersView users={users} userColumns={userColumns} onCreate={() => openUserModal()} />
            ) : null}

            {activeView === "roles" && canRoleManage ? (
              <RolesView roles={roles} roleColumns={roleColumns} onCreate={() => openRoleModal()} />
            ) : null}

            {activeView === "settings" && canSettingsManage ? (
              <SettingsView settings={settings} form={settingsForm} onSubmit={() => void submitSettings()} />
            ) : null}
          </Spin>
        </Content>
      </Layout>

      <TaskModal
        open={taskModalOpen}
        target={taskModalTarget}
        form={taskForm}
        submitting={submitting}
        transcribing={transcribing}
        uploadProps={uploadProps}
        onCancel={() => setTaskModalOpen(false)}
        onSubmit={() => void submitTask()}
      />

      <UserModal
        open={userModalOpen}
        target={userModalTarget}
        roles={roles}
        form={userForm}
        submitting={submitting}
        onCancel={() => setUserModalOpen(false)}
        onSubmit={() => void submitUser()}
      />

      <RoleModal
        open={roleModalOpen}
        target={roleModalTarget}
        form={roleForm}
        submitting={submitting}
        onCancel={() => setRoleModalOpen(false)}
        onSubmit={() => void submitRole()}
      />
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
