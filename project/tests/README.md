# 测试用例目录

本目录用于存放测试用例与测试结果记录。

## 后端 API 自动化测试

测试代码在 [server/tests](file:///c:/Ethan/code/ASEHomeWork20260624/ASEHomeWork20260624/project/server/tests)。

运行方式：

1. 确保后端已启动（默认 `http://localhost:3002`）
2. 在 `server` 目录执行：

```bash
npm test
```

如果后端不在 3002 端口，可设置：

```bash
API_BASE_URL=http://localhost:3002 npm test
```
