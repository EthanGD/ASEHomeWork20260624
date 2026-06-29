import { Button, Card, Descriptions, List, Space, Tag, Typography } from "antd";
import { GithubOutlined, SafetyOutlined, WechatOutlined } from "@ant-design/icons";
import { SessionUser } from "../types";

const { Text } = Typography;

export const AccountView = ({
  currentUser,
  passkeys,
  formatDateTime,
  onWechatBind,
  onWechatUnbind,
  onGithubBind,
  onGithubUnbind,
  onPasskeyBind,
  onPasskeyUnbind
}: {
  currentUser: SessionUser;
  passkeys: { id: number; credentialId: string; createdAt: string; updatedAt: string }[];
  formatDateTime: (value: string) => string;
  onWechatBind: () => void;
  onWechatUnbind: () => void;
  onGithubBind: () => void;
  onGithubUnbind: () => void;
  onPasskeyBind: () => void;
  onPasskeyUnbind: (credentialId: string) => void;
}) => {
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title="账号信息">
        <Descriptions column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="姓名">{currentUser.displayName}</Descriptions.Item>
          <Descriptions.Item label="账号">{currentUser.username ?? "未设置账号"}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{currentUser.email ?? "未填写"}</Descriptions.Item>
          <Descriptions.Item label="当前角色">
            {currentUser.roleNames.join("、") || "未分配角色"}
          </Descriptions.Item>
          <Descriptions.Item label="登录来源">
            <Tag color={currentUser.authSource === "wechat" ? "green" : "blue"}>
              {currentUser.authSource === "wechat" ? "微信" : "本地"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="微信绑定状态">
            <Tag color={currentUser.wechatBound ? "green" : "default"}>
              {currentUser.wechatBound ? "已绑定" : "未绑定"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="GitHub 绑定状态">
            <Tag color={currentUser.githubBound ? "green" : "default"}>
              {currentUser.githubBound ? "已绑定" : "未绑定"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="指纹登录状态">
            <Tag color={currentUser.passkeyBound ? "green" : "default"}>
              {currentUser.passkeyBound ? `已绑定 ${currentUser.passkeyCount} 个` : "未绑定"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="微信扫码登录绑定">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text>绑定后，同一个账号可以直接通过微信扫码登录，不需要再单独创建新的微信账号。</Text>
          <List
            size="small"
            dataSource={[
              "点击“绑定微信扫码登录”后，会跳转到微信扫码授权页面。",
              "未配置正式微信参数时，系统会自动走演示扫码绑定流程。",
              "如果该微信号已经绑定到其他账号，系统会直接提示绑定失败。"
            ]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
          <Space wrap>
            <Button type="primary" icon={<WechatOutlined />} onClick={onWechatBind}>
              {currentUser.wechatBound ? "重新绑定微信扫码登录" : "绑定微信扫码登录"}
            </Button>
            {currentUser.wechatBound ? (
              <Button danger onClick={onWechatUnbind}>
                解除微信绑定
              </Button>
            ) : null}
          </Space>
        </Space>
      </Card>

      <Card title="GitHub OAuth 绑定">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text>绑定后，同一个账号可以通过 GitHub OAuth 进行登录（当前版本优先实现绑定，登录功能后续按需开启）。</Text>
          <List
            size="small"
            dataSource={[
              "点击“绑定 GitHub”后会跳转到 GitHub 授权页面。",
              "未配置 GitHub Client ID/Secret 时，系统会自动走演示绑定流程。",
              "如果该 GitHub 账号已经绑定到其他账号，会提示绑定失败。"
            ]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
          <Space wrap>
            <Button type="primary" icon={<GithubOutlined />} onClick={onGithubBind}>
              {currentUser.githubBound ? "重新绑定 GitHub" : "绑定 GitHub"}
            </Button>
            {currentUser.githubBound ? (
              <Button danger onClick={onGithubUnbind}>
                解除 GitHub 绑定
              </Button>
            ) : null}
          </Space>
        </Space>
      </Card>

      <Card title="手机指纹登录绑定">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text>绑定后，可以在登录页使用手机指纹/人脸验证完成登录（需要浏览器支持 WebAuthn / Passkey）。</Text>
          {currentUser.passkeyBound ? (
            <Tag color="green">已绑定 {currentUser.passkeyCount} 个指纹凭证</Tag>
          ) : (
            <Tag color="default">未绑定</Tag>
          )}
          {passkeys.length > 0 ? (
            <List
              size="small"
              bordered
              dataSource={passkeys}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="unbind"
                      type="link"
                      danger
                      size="small"
                      onClick={() => onPasskeyUnbind(item.credentialId)}
                    >
                      解除绑定
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={`凭证 ${item.credentialId.slice(0, 16)}...`}
                    description={`绑定时间：${formatDateTime(item.createdAt)}`}
                  />
                </List.Item>
              )}
            />
          ) : null}
          <Space wrap>
            <Button type="primary" icon={<SafetyOutlined />} onClick={onPasskeyBind}>
              {currentUser.passkeyBound ? "重新绑定指纹登录" : "绑定指纹登录"}
            </Button>
          </Space>
        </Space>
      </Card>
    </Space>
  );
};
