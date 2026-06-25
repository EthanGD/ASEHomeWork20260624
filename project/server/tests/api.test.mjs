import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3002";

const json = async (response) => {
  const payload = await response.json();
  return payload;
};

const postJson = async (path, body, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return response;
};

const postEmpty = async (path, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({})
  });
  return response;
};

const getJson = async (path, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return response;
};

const putJson = async (path, body, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return response;
};

const deleteJson = async (path, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return response;
};

const login = async (username, password) => {
  const response = await postJson("/api/auth/login", { username, password });
  assert.equal(response.status, 200);
  const payload = await json(response);
  assert.equal(typeof payload.token, "string");
  assert.equal(payload.user.username, username);
  return payload.token;
};

test("GET /api/health", async () => {
  const response = await getJson("/api/health");
  assert.equal(response.status, 200);
  const payload = await json(response);
  assert.equal(payload.ok, true);
  assert.equal(payload.database, true);
});

test("POST /api/auth/login + GET /api/auth/me", async () => {
  const token = await login("admin", "admin123");
  const response = await getJson("/api/auth/me", token);
  assert.equal(response.status, 200);
  const payload = await json(response);
  assert.equal(payload.user.username, "admin");
  assert.ok(Array.isArray(payload.user.permissions));
});

test("GET /api/auth/wechat/url (mock)", async () => {
  const response = await getJson("/api/auth/wechat/url");
  assert.equal(response.status, 200);
  const payload = await json(response);
  assert.equal(payload.mode, "mock");
  assert.ok(payload.url.includes("/api/auth/wechat/mock-callback"));
});

test("account: bind and unbind wechat for local user", async () => {
  const adminToken = await login("admin", "admin123");
  const rolesResponse = await getJson("/api/roles", adminToken);
  assert.equal(rolesResponse.status, 200);
  const roles = await json(rolesResponse);
  assert.ok(Array.isArray(roles));
  assert.ok(roles.length > 0);

  const username = `bind_user_${Date.now()}`;
  const createUserResponse = await postJson(
    "/api/users",
    {
      username,
      password: "bind123456",
      displayName: "绑定测试用户",
      email: `${username}@example.com`,
      status: "enabled",
      roleIds: [roles[0].id]
    },
    adminToken
  );
  assert.equal(createUserResponse.status, 201);

  const userToken = await login(username, "bind123456");
  const meBeforeResponse = await getJson("/api/auth/me", userToken);
  assert.equal(meBeforeResponse.status, 200);
  const meBefore = await json(meBeforeResponse);
  assert.equal(meBefore.user.wechatBound, false);

  const bindUrlResponse = await getJson("/api/account/wechat/bind/url", userToken);
  assert.equal(bindUrlResponse.status, 200);
  const bindUrlPayload = await json(bindUrlResponse);
  assert.equal(bindUrlPayload.mode, "mock");
  assert.ok(bindUrlPayload.url.includes("/api/auth/wechat/mock-callback"));

  const callbackResponse = await fetch(bindUrlPayload.url, { redirect: "manual" });
  assert.equal(callbackResponse.status, 302);

  const meAfterBindResponse = await getJson("/api/auth/me", userToken);
  assert.equal(meAfterBindResponse.status, 200);
  const meAfterBind = await json(meAfterBindResponse);
  assert.equal(meAfterBind.user.wechatBound, true);

  const unbindResponse = await postEmpty("/api/account/wechat/unbind", userToken);
  assert.equal(unbindResponse.status, 200);
  const unbindPayload = await json(unbindResponse);
  assert.equal(unbindPayload.success, true);

  const meAfterUnbindResponse = await getJson("/api/auth/me", userToken);
  assert.equal(meAfterUnbindResponse.status, 200);
  const meAfterUnbind = await json(meAfterUnbindResponse);
  assert.equal(meAfterUnbind.user.wechatBound, false);
});

test("account: bind and unbind github for local user", async () => {
  const adminToken = await login("admin", "admin123");
  const rolesResponse = await getJson("/api/roles", adminToken);
  assert.equal(rolesResponse.status, 200);
  const roles = await json(rolesResponse);
  assert.ok(Array.isArray(roles));
  assert.ok(roles.length > 0);

  const username = `bind_github_user_${Date.now()}`;
  const createUserResponse = await postJson(
    "/api/users",
    {
      username,
      password: "bind123456",
      displayName: "GitHub绑定测试用户",
      email: `${username}@example.com`,
      status: "enabled",
      roleIds: [roles[0].id]
    },
    adminToken
  );
  assert.equal(createUserResponse.status, 201);

  const userToken = await login(username, "bind123456");
  const meBeforeResponse = await getJson("/api/auth/me", userToken);
  assert.equal(meBeforeResponse.status, 200);
  const meBefore = await json(meBeforeResponse);
  assert.equal(meBefore.user.githubBound, false);

  const bindUrlResponse = await getJson("/api/account/github/bind/url", userToken);
  assert.equal(bindUrlResponse.status, 200);
  const bindUrlPayload = await json(bindUrlResponse);
  assert.ok(bindUrlPayload.url);
  const bindAuthUrl = new URL(bindUrlPayload.url);
  const state = bindAuthUrl.searchParams.get("state");
  assert.ok(state);

  const callbackResponse = await fetch(
    `${baseUrl}/api/auth/github/mock-callback?state=${encodeURIComponent(state)}`,
    { redirect: "manual" }
  );
  assert.equal(callbackResponse.status, 302);

  const meAfterBindResponse = await getJson("/api/auth/me", userToken);
  assert.equal(meAfterBindResponse.status, 200);
  const meAfterBind = await json(meAfterBindResponse);
  assert.equal(meAfterBind.user.githubBound, true);

  const unbindResponse = await postEmpty("/api/account/github/unbind", userToken);
  assert.equal(unbindResponse.status, 200);
  const unbindPayload = await json(unbindResponse);
  assert.equal(unbindPayload.success, true);

  const meAfterUnbindResponse = await getJson("/api/auth/me", userToken);
  assert.equal(meAfterUnbindResponse.status, 200);
  const meAfterUnbind = await json(meAfterUnbindResponse);
  assert.equal(meAfterUnbind.user.githubBound, false);
});

test("tasks CRUD", async () => {
  const token = await login("admin", "admin123");

  const createResponse = await postJson(
    "/api/tasks",
    {
      title: `test task ${Date.now()}`,
      content: "created by api test",
      status: "todo",
      priority: "low",
      startAt: new Date(Date.now() + 60_000).toISOString(),
      endAt: new Date(Date.now() + 120_000).toISOString()
    },
    token
  );
  assert.equal(createResponse.status, 201);
  const created = await json(createResponse);
  assert.equal(created.success, true);
  assert.equal(typeof created.id, "number");

  const listResponse = await getJson("/api/tasks", token);
  assert.equal(listResponse.status, 200);
  const tasks = await json(listResponse);
  assert.ok(Array.isArray(tasks));
  const found = tasks.find((item) => item.id === created.id);
  assert.ok(found);

  const updateResponse = await putJson(
    `/api/tasks/${created.id}`,
    {
      title: found.title,
      content: `${found.content} updated`,
      status: "done",
      priority: "high",
      startAt: found.startAt,
      endAt: found.endAt
    },
    token
  );
  assert.equal(updateResponse.status, 200);

  const deleteResponse = await deleteJson(`/api/tasks/${created.id}`, token);
  assert.equal(deleteResponse.status, 200);
});

test("permission: demo cannot access /api/users", async () => {
  const demoToken = await login("demo", "demo123");
  const response = await getJson("/api/users", demoToken);
  assert.equal(response.status, 403);
});

test("permission: admin can access /api/users", async () => {
  const token = await login("admin", "admin123");
  const response = await getJson("/api/users", token);
  assert.equal(response.status, 200);
  const payload = await json(response);
  assert.ok(Array.isArray(payload));
});
