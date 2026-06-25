# 数据库设计目录

本目录用于保留 PostgreSQL 的数据库设计与操作脚本（建表、插入、示例查询等）。

## 目录结构

- `schema/`：建表脚本
- `seed/`：初始化数据脚本（角色、用户、系统配置、示例事务）
- `ops/`：常用数据库操作脚本（插入、查询、更新、删除示例）

## 使用方式

先执行建表脚本，再执行初始化数据脚本：

```bash
psql -U postgres -d postgres -f database/schema/001_init.sql
psql -U postgres -d postgres -f database/seed/001_seed.sql
```
