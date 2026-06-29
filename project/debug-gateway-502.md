[OPEN] Debug Session: gateway-502

## 症状
- 访问 `https://localtest.macaowater.com/apiGateWay` 返回 `502 Bad Gateway`
- 浏览器显示 `Remote Address: 127.0.0.1:443`

## 期望
- `localtest` 入口可正常转发到本地 `apiGateWay`
- 指纹相关接口经 `apiGateWay` 可正常返回业务结果，而不是网关层 502

## 假设（待证伪）
1. `apiGateWay` 进程未启动，`3003` 没有监听，导致 `443` 反代上游不可用。
2. `apiGateWay` 已启动，但其目标后端 `3002` 不可达，导致反代链路最终返回 502。
3. `localtest.macaowater.com` 对应的本地 `443` 反向代理配置指向了错误端口或旧实例。
4. 当前项目服务已切换端口/重启方式，但本地反代仍沿用旧配置，只有通过 `443` 的入口会报 502。

## 采集计划
- 检查 `3002`、`3003`、`5175` 本地监听与健康状态
- 对比直连 `3003` 与通过 `443/localtest` 的返回差异
- 搜索仓库内是否有 `localtest` 或反代相关配置线索

## 证据记录
- 本机监听状态：
  - `3002` 在监听，`GET http://127.0.0.1:3002/api/health` 返回 `{"ok":true,"database":true}`
  - `5175` 未监听，直连 `http://127.0.0.1:5175/` 返回 `Unable to connect to the remote server`
  - `3003` 未监听，直连 `http://127.0.0.1:3003/health` 返回 `Unable to connect to the remote server`
- 用户提供的 `nginx` 配置显示：
  - `https://localtest.macaowater.com/` 入口仅反代到 `http://localhost:5175`
  - 因此 `443` 返回 `502` 时，最先失败的是 `5175` 不可达，而不是 `3002` 业务接口本身
- 启动缺失服务后再次验证：
  - `GET http://127.0.0.1:5175/` 返回 `200`
  - `GET http://127.0.0.1:3003/health` 返回 `{"ok":true,"target":"http://127.0.0.1:3002"}`
  - `GET https://localtest.macaowater.com/` 返回 `200`
  - `POST https://localtest.macaowater.com/apiGateWay` with `{ path: "/api/health", method: "GET" }` 返回 `{"ok":true,"database":true}`

## 结论
- 已证伪假设 2：`3002` 后端本身是可访问的
- 已证实假设 1 和 4：当前缺少 `5175` 与 `3003` 运行实例，导致 `443 -> 5175 -> 3003 -> 3002` 链路在前两跳就中断
- Root cause：`nginx 443` 入口本身没问题，真正原因是本地前端 dev server 和 `apiGateWay` 进程未启动
- Fix：已重新启动 `5175` 前端和 `3003` `apiGateWay`，当前入口链路已恢复
