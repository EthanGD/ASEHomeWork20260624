import { Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd";
import { PERMISSION_LABELS } from "../../appShellUtils";
import type { Permission, Role } from "../../types";

const { TextArea } = Input;

export type RoleFormValues = {
  name: string;
  description: string;
  permissions: Permission[];
};

export function RoleModal(props: {
  open: boolean;
  target: Role | null;
  form: FormInstance<RoleFormValues>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { open, target, form, submitting, onCancel, onSubmit } = props;

  return (
    <Modal
      title={target ? "编辑角色" : "新增角色"}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ permissions: ["task:manage_own"] }}>
        <Form.Item label="角色名称" name="name" rules={[{ required: true, message: "请输入角色名称" }]}>
          <Input placeholder="例如：销售经理" />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <TextArea rows={4} placeholder="请输入角色描述" />
        </Form.Item>
        <Form.Item label="权限" name="permissions" rules={[{ required: true, message: "请至少选择一个权限" }]}>
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
  );
}
