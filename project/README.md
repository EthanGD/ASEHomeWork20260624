# 语音转文字事务记录网页

一个前后端分离的事务管理系统，当前技术栈如下：

- 前端：React + TypeScript + Vite + Ant Design
- 后端：Express + TypeScript
- 数据库：PostgreSQL
- 语音识别：funASR（由后端代理调用）
- 登录方式：本地账号登录 + 微信网页扫码登录结构

当前版本支持以下能力：

- 待办事务记录的新增、编辑、删除、搜索和状态流转
- 日历界面按月、按周、按 3 日、按日查阅事务
- 用户增删改查
- 自定义角色与权限管理
- 微信扫码登录扩展结构
- 企业单点登录预留配置
- 通过 funASR 服务进行音频上传和语音转文字

## 需求文档

需求基线见 `docs/requirements.md`。

## 测试用例与数据库设计

- 测试用例目录：[tests](file:///c:/Ethan/code/ASEHomeWork20260624/ASEHomeWork20260624/project/tests)
- 数据库设计目录：[database](file:///c:/Ethan/code/ASEHomeWork20260624/ASEHomeWork20260624/project/database)

## 快速启动

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

另开一个终端：

```bash
cd client
npm install
npm run dev
```

生产构建：

```bash
cd server
npm run build

cd client
npm run build
```

## 默认端口

- 前端开发服务：`http://localhost:5174`
- 后端服务：`http://localhost:3002`

说明：

- 本机 `5173` 与 `3001` 可能已被其他服务占用，因此当前项目默认使用 `5174` 和 `3002`
- 前端通过 Vite 代理把 `/api` 请求转发到 `http://localhost:3002`

## 默认账号

- 管理员：`admin / admin123`
- 示例员工：`demo / demo123`

## PostgreSQL 配置

后端通过 `server/.env` 读取数据库配置。可参考：

```env
PORT=3002
CLIENT_URL=http://localhost:5174
SERVER_PUBLIC_URL=http://localhost:3002
CORS_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
JWT_SECRET=voice-task-secret

PGHOST=127.0.0.1
PGPORT=5433
PGUSER=postgres
PGPASSWORD=123qwe
PGDATABASE=postgres
```

如果你的本机 PostgreSQL 用户名或密码与上面不同，请修改 `server/.env`。
如果你同时安装了多个 PostgreSQL 版本：常见情况是旧版本占用 `5432`，新版本（例如 18）跑在 `5433`，需要按实际端口填写 `PGPORT`。
后端启动后会额外打印 `database target user@host:port/database`，可以直接确认当前连到的是哪一个实例，避免写错库。

建议优先关注这些环境变量：

- `PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE`：数据库实例地址与库名
- `CLIENT_URL / SERVER_PUBLIC_URL`：前后端跳转与微信回调基地址
- `CORS_ALLOWED_ORIGINS`：显式允许的前端来源，多个值用英文逗号分隔
- `JWT_SECRET`：登录令牌签名密钥
- `DEBUG_SESSION_ID / DEBUG_DIR`：调试采集日志文件名与输出目录

## 微信登录说明

- 当前已实现微信网页扫码登录的后端路由结构
- 如果未配置 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`，系统会走演示登录链路，便于本地开发
- 正式接入时请在 `server/.env` 中填写：

```env
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_REDIRECT_URI=http://localhost:3002/api/auth/wechat/callback
SERVER_PUBLIC_URL=http://localhost:3002
WECHAT_MOCK_OPEN_ID=mock-open-id
WECHAT_MOCK_NICKNAME=微信演示用户
WECHAT_MOCK_EMAIL=wechat.demo@example.com
```

其中 `WECHAT_MOCK_*` 用于本地演示登录，避免把测试账号硬编码在代码里。

## funASR 接入方式

在系统“系统配置”页面中填写：

- `服务地址`：例如 `http://127.0.0.1:8000`
- `识别路径`：例如 `/recognize`
- `访问令牌`：如果你的服务需要 Bearer Token，可选填

前端上传音频后，后端会使用 `POST multipart/form-data` 请求转发到 funASR，字段名为 `file`。

系统会尝试从以下字段中读取识别文本：

- `text`
- `result`
- `transcript`
- `data.text`
- `data.result`

## 当前实现说明

- 主数据已迁移到 PostgreSQL。
- 用户删除为逻辑删除。
- 默认角色不可删除，但可以调整权限或禁用。
- 企业单点登录当前是扩展位，保留配置入口，未接入真实认证服务。
- 如果数据库配置不正确，后端会在启动时直接报 PostgreSQL 认证或连接错误。
- 后端已按 `config / services / routes / app / index` 分层，`server/src/index.ts` 只保留启动逻辑。

## 建议的后续增强

- 接入真实微信公众号/开放平台配置管理
- 接入真实 SSO
- 增加审计日志、附件管理和导出能力
- 对接正式的 funASR 网关并统一做鉴权与错误处理
- 为 Ant Design 大包做按需加载或分包优化，降低前端首屏体积
