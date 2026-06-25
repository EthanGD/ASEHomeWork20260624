[OPEN] Debug Session: login-auth-failure

## 症状
- 本地账号登录失败
- 微信扫码登录失败

## 期望
- 本地账号可登录并进入系统
- 微信扫码登录可跳转并在回调后进入系统（未配置 AppID/Secret 时应走 mock）

## 假设（待证伪）
1. 前端 `/api` 代理未指向正确后端端口，导致请求打到错误服务或 404。
2. 后端未正常运行或启动即退出（例如数据库连接/端口冲突），导致登录请求失败。
3. 后端 CORS/CLIENT_URL 配置不匹配，浏览器阻止请求或预检失败。
4. 本地账号：数据库中的 admin/demo 用户未初始化或密码哈希不匹配，导致 401。
5. 微信扫码：`/api/auth/wechat/url` 返回的 URL 不可达/回调参数未处理，导致无法完成登录。

## 采集计划
- 启动 Debug Server 收集前端/后端运行时日志
- 在前端 API 请求层、后端认证路由与鉴权中间件加入最小化埋点（仅上报，不改业务逻辑）
- 复现：本地登录 + 点击微信扫码登录

## 证据记录
- pre-fix:
  - 预检请求（Origin=http://localhost:5175）返回 `Access-Control-Allow-Origin: http://localhost:5174`，浏览器会拦截跨域请求，导致“本地登录/微信扫码登录”在前端表现为失败（请求未能成功完成）。
- post-fix:
  - 已允许开发环境 `http://localhost:*` / `http://127.0.0.1:*` / `http://192.168.*` 跨域访问，预检返回 `Access-Control-Allow-Origin: http://localhost:5175`。
  - 服务器日志（.dbg/trae-debug-log-login-auth-failure.ndjson）显示：
    - POST /api/auth/login 200（admin 登录成功）
    - GET /api/auth/wechat/url 200（mock 模式 URL 下发成功）

## 结论
- Root cause:
  - Vite Dev Server 端口发生漂移（5174 被占用，实际运行在 5175），但后端 CORS 仍固定只允许 `CLIENT_URL=http://localhost:5174`，导致浏览器跨域拦截。
- Fix:
  - 后端 CORS 改为：允许 `config.clientUrl` 以及开发环境常见本地域名端口（localhost/127.0.0.1/192.168.*）。
  - 增加最小化埋点：记录 auth 请求结果与关键路径，输出到 `.dbg/trae-debug-log-login-auth-failure.ndjson`。
