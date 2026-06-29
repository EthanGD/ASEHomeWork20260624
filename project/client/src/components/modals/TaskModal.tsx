import { SoundOutlined } from "@ant-design/icons";
import { Button, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Typography, Upload } from "antd";
import type { FormInstance, UploadProps } from "antd";
import type { Dayjs } from "dayjs";
import type { TaskPriority, TaskRecord, TaskStatus } from "../../types";

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Text } = Typography;

export type TaskFormValues = {
  title: string;
  content: string;
  status: TaskStatus;
  priority: TaskPriority;
  dateRange?: [Dayjs, Dayjs];
};

export function TaskModal(props: {
  open: boolean;
  target: TaskRecord | null;
  form: FormInstance<TaskFormValues>;
  submitting: boolean;
  transcribing: boolean;
  uploadProps: UploadProps;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { open, target, form, submitting, transcribing, uploadProps, onCancel, onSubmit } = props;

  return (
    <Modal
      title={target ? "编辑事务" : "新建事务"}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={submitting}
      width={760}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: "todo", priority: "medium" }}
      >
        <Form.Item label="标题" name="title" rules={[{ required: true, message: "请输入标题" }]}>
          <Input placeholder="请输入事务标题" />
        </Form.Item>
        <Form.Item label="正文" name="content" rules={[{ required: true, message: "请输入事务正文" }]}>
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
          <Text type="secondary">支持在编辑事务时直接把转写结果追加到正文</Text>
        </Space>
      </Form>
    </Modal>
  );
}
