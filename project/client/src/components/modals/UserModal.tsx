import { Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd";
import type { Role, User } from "../../types";

const { Password } = Input;

export type UserFormValues = {
  username: string | null;
  password?: string;
  displayName: string;
  email: string | null;
  status: "enabled" | "disabled";
  roleIds: number[];
};

export function UserModal(props: {
  open: boolean;
  target: User | null;
  roles: Role[];
  form: FormInstance<UserFormValues>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { open, target, roles, form, submitting, onCancel, onSubmit } = props;

  return (
    <Modal
      title={target ? "编辑用户" : "新增用户"}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ status: "enabled", roleIds: [] }}>
        <Form.Item label="账号" name="username" rules={[{ required: true, message: "请输入账号" }]}>
          <Input placeholder="请输入账号" disabled={target?.authSource === "wechat"} />
        </Form.Item>
        <Form.Item
          label={target ? "重置密码" : "初始密码"}
          name="password"
          rules={target ? [] : [{ required: true, message: "请输入密码" }]}
        >
          <Password placeholder={target ? "不填写则保持原密码" : "请输入初始密码"} />
        </Form.Item>
        <Form.Item label="姓名" name="displayName" rules={[{ required: true, message: "请输入姓名" }]}>
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
        <Form.Item label="角色" name="roleIds" rules={[{ required: true, message: "请至少选择一个角色" }]}>
          <Select mode="multiple" options={roles.map((role) => ({ label: role.name, value: role.id }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
