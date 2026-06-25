import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { query } from "./db.js";
export const hashPassword = async (password) => bcrypt.hash(password, 10);
export const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
export const signToken = (userId) => jwt.sign({ userId }, config.jwtSecret, { expiresIn: "7d" });
export const fetchSessionUser = async (userId) => {
    const result = await query(`
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.email,
        u.status,
        u.auth_source,
        (u.wechat_open_id IS NOT NULL) AS wechat_bound,
        EXISTS (
          SELECT 1
          FROM oauth_identities oi
          WHERE oi.user_id = u.id AND oi.provider = 'github'
        ) AS github_bound,
        COALESCE(array_agg(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL), '{}') AS role_ids,
        COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.id IS NOT NULL), '{}') AS role_names,
        COALESCE(array_agg(DISTINCT p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS permissions
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN LATERAL unnest(r.permission_keys) AS p(permission) ON TRUE
      WHERE u.id = $1 AND u.deleted = FALSE
      GROUP BY u.id
    `, [userId]);
    const row = result.rows[0];
    if (!row || row.status !== "enabled") {
        return null;
    }
    return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        status: row.status,
        authSource: row.auth_source,
        wechatBound: row.wechat_bound,
        githubBound: row.github_bound,
        roleIds: row.role_ids ?? [],
        roleNames: row.role_names ?? [],
        permissions: row.permissions ?? []
    };
};
export const requireAuth = async (request, response, next) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        response.status(401).json({ message: "未登录或登录已失效" });
        return;
    }
    try {
        const token = header.slice("Bearer ".length);
        const payload = jwt.verify(token, config.jwtSecret);
        const user = await fetchSessionUser(payload.userId);
        if (!user) {
            response.status(401).json({ message: "用户不存在或已被禁用" });
            return;
        }
        request.user = user;
        next();
    }
    catch {
        response.status(401).json({ message: "登录凭证无效，请重新登录" });
    }
};
export const requirePermission = (permission) => (request, response, next) => {
    if (!request.user) {
        response.status(401).json({ message: "未登录" });
        return;
    }
    if (!request.user.permissions.includes(permission)) {
        response.status(403).json({ message: "无权限执行该操作" });
        return;
    }
    next();
};
export const hasPermission = (user, permission) => user.permissions.includes(permission);
