import { Button, Card, Table } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { User } from "../types";

export const UsersView = ({
  users,
  userColumns,
  onCreate
}: {
  users: User[];
  userColumns: TableColumnsType<User>;
  onCreate: () => void;
}) => {
  return (
    <Card
      title="用户管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新增用户
        </Button>
      }
    >
      <Table rowKey="id" columns={userColumns} dataSource={users} pagination={{ pageSize: 8 }} />
    </Card>
  );
};

