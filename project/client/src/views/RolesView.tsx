import { Button, Card, Table } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { Role } from "../types";

export const RolesView = ({
  roles,
  roleColumns,
  onCreate
}: {
  roles: Role[];
  roleColumns: TableColumnsType<Role>;
  onCreate: () => void;
}) => {
  return (
    <Card
      title="角色管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新增角色
        </Button>
      }
    >
      <Table rowKey="id" columns={roleColumns} dataSource={roles} pagination={false} />
    </Card>
  );
};

