import { Button, Calendar, Card, Col, Empty, List, Row, Segmented, Space, Tag, Typography } from "antd";
import { DatePicker } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Dayjs } from "dayjs";
import { CalendarMode, STATUS_COLORS, STATUS_LABELS, formatDateTime, getRangeDates, taskTouchesDate } from "../appShellUtils";
import { TaskRecord } from "../types";

const { Text } = Typography;

export const CalendarView = ({
  calendarMode,
  onCalendarModeChange,
  calendarAnchor,
  onCalendarAnchorChange,
  canTaskCreate,
  onCreate,
  tasks,
  onViewTask
}: {
  calendarMode: CalendarMode;
  onCalendarModeChange: (value: CalendarMode) => void;
  calendarAnchor: Dayjs;
  onCalendarAnchorChange: (value: Dayjs) => void;
  canTaskCreate: boolean;
  onCreate: () => void;
  tasks: TaskRecord[];
  onViewTask: (task: TaskRecord) => void;
}) => {
  const calendarDates = getRangeDates(calendarMode, calendarAnchor);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Row gutter={[16, 16]} justify="space-between" align="middle">
          <Col>
            <Space wrap>
              <Segmented<CalendarMode>
                value={calendarMode}
                onChange={(value) => onCalendarModeChange(value)}
                options={[
                  { label: "按月", value: "month" },
                  { label: "按周", value: "week" },
                  { label: "按3日", value: "3day" },
                  { label: "按日", value: "day" }
                ]}
              />
              <DatePicker value={calendarAnchor} onChange={(value) => value && onCalendarAnchorChange(value)} />
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canTaskCreate} onClick={onCreate}>
              新建事务
            </Button>
          </Col>
        </Row>
      </Card>

      {calendarMode === "month" ? (
        <Card>
          <Calendar
            value={calendarAnchor}
            onPanelChange={(value) => onCalendarAnchorChange(value)}
            onSelect={(value) => onCalendarAnchorChange(value)}
            cellRender={(current) => {
              const dayTasks = tasks.filter((task) => taskTouchesDate(task, current));
              return (
                <div className="calendar-cell">
                  {dayTasks.slice(0, 3).map((task) => (
                    <Tag className="calendar-tag" color={STATUS_COLORS[task.status]} key={`${current.valueOf()}-${task.id}`}>
                      {task.title}
                    </Tag>
                  ))}
                  {dayTasks.length > 3 ? <Text type="secondary">+{dayTasks.length - 3} 条</Text> : null}
                </div>
              );
            }}
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {calendarDates.map((date) => {
            const dateTasks = tasks.filter((task) => taskTouchesDate(task, date));
            const span = calendarMode === "day" ? 24 : calendarMode === "3day" ? 8 : 6;
            return (
              <Col xs={24} md={span} key={date.toISOString()}>
                <Card title={date.format("MM-DD dddd")}>
                  {dateTasks.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当天暂无事务" />
                  ) : (
                    <List
                      dataSource={dateTasks}
                      renderItem={(task) => (
                        <List.Item
                          actions={[
                            <Button key="edit" type="link" onClick={() => onViewTask(task)}>
                              查看
                            </Button>
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <Space>
                                <Tag color={STATUS_COLORS[task.status]}>{STATUS_LABELS[task.status]}</Tag>
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
  );
};
