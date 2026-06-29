import { Button, Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";
import { DashboardSummary, TaskRecord } from "../types";
import { STATUS_COLORS, STATUS_LABELS, formatDateTime } from "../appShellUtils";

const { Text } = Typography;

export const DashboardView = ({
  dashboard,
  recentTasks,
  onViewAllTasks,
  onEditTask
}: {
  dashboard: DashboardSummary | null;
  recentTasks: TaskRecord[];
  onViewAllTasks: () => void;
  onEditTask: (task: TaskRecord) => void;
}) => {
  return (
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
              <Button type="link" onClick={onViewAllTasks}>
                查看全部
              </Button>
            }
          >
            <List
              dataSource={recentTasks}
              locale={{ emptyText: "暂无事务" }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button key="edit" type="link" onClick={() => onEditTask(item)}>
                      编辑
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.title}</Text>
                        <Tag color={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Tag>
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
  );
};

