import { Button, Card, Col, Form, Input, List, Row, Select, Space } from "antd";
import type { FormInstance } from "antd";
import { AppSettings } from "../types";

export const SettingsView = ({
  settings,
  form,
  onSubmit
}: {
  settings: AppSettings | null;
  form: FormInstance<AppSettings>;
  onSubmit: () => void;
}) => {
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title="系统配置">
        <Form form={form} layout="vertical" initialValues={settings ?? undefined}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item label="funASR 服务地址" name={["integrations", "funasrServiceUrl"]}>
                <Input placeholder="例如：http://127.0.0.1:8000" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="funASR 路径" name={["integrations", "funasrApiPath"]}>
                <Input placeholder="/recognize" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="funASR Token" name={["integrations", "funasrToken"]}>
                <Input.Password placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="微信 AppID" name={["integrations", "wechatAppId"]}>
                <Input placeholder="未配置则走演示微信登录" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="SSO 提供方" name={["integrations", "ssoProvider"]}>
                <Input placeholder="企业微信 / OAuth" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="SSO 预留开关" name={["integrations", "ssoEnabled"]}>
                <Select
                  options={[
                    { label: "关闭", value: false },
                    { label: "开启", value: true }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" onClick={onSubmit}>
            保存配置
          </Button>
        </Form>
      </Card>

      <Card title="接入说明">
        <List
          dataSource={[
            "前端通过 /api 调用 Express 后端，由后端统一访问 PostgreSQL 与 funASR。",
            "微信扫码登录未配置 AppID/AppSecret 时，系统自动走演示回调链路。",
            "正式上线时建议把微信 AppSecret 放到服务端环境变量，而不是前端页面。"
          ]}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>
    </Space>
  );
};

