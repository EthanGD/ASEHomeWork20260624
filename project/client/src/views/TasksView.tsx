import { Button, Card, Col, Input, Row, Select, Space, Table } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { SessionUser, TaskRecord, TaskStatus } from "../types";

export const TasksView = ({
  currentUser,
  canTaskCreate,
  taskStatusFilter,
  onTaskStatusFilterChange,
  onTaskKeywordChange,
  onRefresh,
  onCreate,
  taskColumns,
  tasks
}: {
  currentUser: SessionUser;
  canTaskCreate: boolean;
  taskStatusFilter: "all" | TaskStatus;
  onTaskStatusFilterChange: (value: "all" | TaskStatus) => void;
  onTaskKeywordChange: (value: string) => void;
  onRefresh: (user: SessionUser) => void;
  onCreate: () => void;
  taskColumns: TableColumnsType<TaskRecord>;
  tasks: TaskRecord[];
}) => {
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="搜索标题或正文"
              allowClear
              onChange={(event) => onTaskKeywordChange(event.target.value)}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              value={taskStatusFilter}
              style={{ width: "100%" }}
              onChange={onTaskStatusFilterChange}
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
              <Button onClick={() => onRefresh(currentUser)}>刷新</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!canTaskCreate}
                onClick={onCreate}
              >
                新建事务
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Card>
        <Table rowKey="id" columns={taskColumns} dataSource={tasks} pagination={{ pageSize: 8 }} />
      </Card>
    </Space>
  );
};

