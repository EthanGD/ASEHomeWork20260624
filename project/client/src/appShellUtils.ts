import dayjs, { Dayjs } from "dayjs";
import { Permission, SessionUser, TaskPriority, TaskRecord, TaskStatus } from "./types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "待处理",
  in_progress: "进行中",
  done: "已完成"
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "gold",
  in_progress: "blue",
  done: "green"
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高"
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "default",
  medium: "orange",
  high: "red"
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "task:view_all": "查看全部事务",
  "task:edit_all": "编辑全部事务",
  "task:manage_own": "管理自己的事务",
  "user:manage": "用户管理",
  "role:manage": "角色管理",
  "settings:manage": "系统配置"
};

export const hasPermission = (user: SessionUser | null, permission: Permission) =>
  user?.permissions.includes(permission) ?? false;

export const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";

export type CalendarMode = "month" | "week" | "3day" | "day";

export const getWeekStart = (value: Dayjs) =>
  value.startOf("day").subtract((value.day() + 6) % 7, "day");

export const getRangeDates = (mode: CalendarMode, anchor: Dayjs) => {
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

export const taskTouchesDate = (task: TaskRecord, date: Dayjs) => {
  const start = dayjs(task.startAt ?? task.createdAt);
  const end = dayjs(task.endAt ?? task.startAt ?? task.createdAt);
  return !date.endOf("day").isBefore(start) && !date.startOf("day").isAfter(end);
};

export const sortTasks = (items: TaskRecord[]) =>
  [...items].sort(
    (left, right) =>
      dayjs(left.startAt ?? left.createdAt).valueOf() -
      dayjs(right.startAt ?? right.createdAt).valueOf()
  );

