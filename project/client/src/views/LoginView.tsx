import { Button, Card, Form, Input, Space, Typography } from "antd";
import { GithubOutlined, SafetyOutlined, WechatOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { Password } = Input;

export const LoginView = ({
  submitting,
  onLogin,
  onWechatLogin,
  onGithubLogin,
  onPasskeyLogin
}: {
  submitting: boolean;
  onLogin: (values: { username: string; password: string }) => void;
  onWechatLogin: () => void;
  onGithubLogin: () => void;
  onPasskeyLogin: () => void;
}) => {
  const [form] = Form.useForm<{ username: string; password: string }>();

  return (
    <div className="login-page">
      <Card className="login-card">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Title level={2}>语音转文字事务记录网页</Title>
            <Text type="secondary">
              React + Ant Design 前端、Express + TypeScript 后端、PostgreSQL 持久化、日历视图与微信登录。
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{ username: "admin", password: "admin123" }}
            onFinish={onLogin}
          >
            <Form.Item label="账号" name="username" rules={[{ required: true, message: "请输入账号" }]}>
              <Input placeholder="请输入账号" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Password placeholder="请输入密码" />
            </Form.Item>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button type="primary" htmlType="submit" loading={submitting} block>
                本地账号登录
              </Button>
              <Button icon={<WechatOutlined />} block onClick={onWechatLogin}>
                微信扫码登录
              </Button>
              <Button icon={<GithubOutlined />} block onClick={onGithubLogin}>
                GitHub oidc sso 登录
              </Button>
              <Button icon={<SafetyOutlined />} block onClick={onPasskeyLogin}>
                手机指纹验证登录
              </Button>
            </Space>
          </Form>

          <Card size="small" title="默认账号">
            <Text>管理员：admin / admin123</Text>
            <br />
            <Text>员工：demo / demo123</Text>
          </Card>
        </Space>
      </Card>
    </div>
  );
};

