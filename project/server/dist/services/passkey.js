import { config } from "../config.js";
import { query } from "../db.js";
const toBase64Url = (input) => Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
const fromBase64Url = (input) => {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
    return new Uint8Array(Buffer.from(padded, "base64"));
};
const concatBytes = (a, b) => {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
};
const asArrayBuffer = (bytes) => new Uint8Array(bytes).buffer;
const derToRaw = (der) => {
    let offset = 0;
    if (der[offset] !== 0x30)
        throw new Error("不是合法的 DER 签名");
    offset++;
    if (der[offset] < 128) {
        offset++;
    }
    else {
        const lenBytes = der[offset] & 0x7f;
        offset += 1 + lenBytes;
    }
    const readInt = () => {
        if (der[offset] !== 0x02)
            throw new Error("DER 格式错误");
        offset++;
        const len = der[offset];
        offset++;
        const val = der.slice(offset, offset + len);
        offset += len;
        return val[0] === 0 ? val.slice(1) : val;
    };
    const r = readInt();
    const s = readInt();
    const raw = new Uint8Array(64);
    raw.set(r.slice(-32), 32 - Math.min(r.length, 32));
    raw.set(s.slice(-32), 64 - Math.min(s.length, 32));
    return raw;
};
const sha256 = async (input) => {
    const digest = await crypto.subtle.digest("SHA-256", asArrayBuffer(input));
    return new Uint8Array(digest);
};
const normalizeOrigin = (origin) => {
    if (origin) {
        return new URL(origin).origin;
    }
    return new URL(config.clientUrl).origin;
};
const rpIdFromOrigin = (origin) => new URL(origin).hostname;
const pending = new Map();
const issueChallenge = (key, userId, origin) => {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const challenge = toBase64Url(raw);
    pending.set(key, {
        challenge,
        userId,
        origin,
        rpId: rpIdFromOrigin(origin),
        expiresAt: Date.now() + 5 * 60_000
    });
    return challenge;
};
const consumeChallenge = (key, expectedUserId) => {
    const record = pending.get(key);
    pending.delete(key);
    if (!record) {
        throw new Error("challenge 不存在或已过期");
    }
    if (record.expiresAt < Date.now()) {
        throw new Error("challenge 已过期");
    }
    if (expectedUserId !== null && record.userId !== expectedUserId) {
        throw new Error("challenge 与用户不匹配");
    }
    return record;
};
const readCbor = (bytes, offset) => {
    if (offset >= bytes.length) {
        throw new Error("CBOR 数据不完整");
    }
    const head = bytes[offset];
    const major = head >> 5;
    const addl = head & 0x1f;
    const readLength = () => {
        if (addl < 24) {
            return { length: addl, next: offset + 1 };
        }
        if (addl === 24) {
            return { length: bytes[offset + 1], next: offset + 2 };
        }
        if (addl === 25) {
            const length = (bytes[offset + 1] << 8) | bytes[offset + 2];
            return { length, next: offset + 3 };
        }
        if (addl === 26) {
            const length = (bytes[offset + 1] << 24) |
                (bytes[offset + 2] << 16) |
                (bytes[offset + 3] << 8) |
                bytes[offset + 4];
            return { length: length >>> 0, next: offset + 5 };
        }
        throw new Error("不支持的 CBOR length 编码");
    };
    if (major === 0) {
        const { length, next } = readLength();
        return { value: length, nextOffset: next };
    }
    if (major === 1) {
        const { length, next } = readLength();
        return { value: -1 - length, nextOffset: next };
    }
    if (major === 2) {
        const { length, next } = readLength();
        const end = next + length;
        if (end > bytes.length) {
            throw new Error("CBOR bytes 越界");
        }
        return { value: bytes.slice(next, end), nextOffset: end };
    }
    if (major === 3) {
        const { length, next } = readLength();
        const end = next + length;
        if (end > bytes.length) {
            throw new Error("CBOR string 越界");
        }
        const text = Buffer.from(bytes.slice(next, end)).toString("utf8");
        return { value: text, nextOffset: end };
    }
    if (major === 4) {
        const { length, next } = readLength();
        const items = [];
        let cursor = next;
        for (let i = 0; i < length; i += 1) {
            const result = readCbor(bytes, cursor);
            items.push(result.value);
            cursor = result.nextOffset;
        }
        return { value: items, nextOffset: cursor };
    }
    if (major === 5) {
        const { length, next } = readLength();
        const map = new Map();
        let cursor = next;
        for (let i = 0; i < length; i += 1) {
            const keyResult = readCbor(bytes, cursor);
            const valueResult = readCbor(bytes, keyResult.nextOffset);
            map.set(keyResult.value, valueResult.value);
            cursor = valueResult.nextOffset;
        }
        return { value: map, nextOffset: cursor };
    }
    throw new Error("不支持的 CBOR major type");
};
const decodeCborMap = (bytes) => {
    const result = readCbor(bytes, 0);
    if (!(result.value instanceof Map)) {
        throw new Error("CBOR 顶层不是 map");
    }
    return result.value;
};
const readUint32BE = (bytes, offset) => (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
const parseAuthenticatorDataForRp = async (authenticatorData, rpId) => {
    if (authenticatorData.length < 37) {
        throw new Error("authenticatorData 不完整");
    }
    const rpIdHash = authenticatorData.slice(0, 32);
    const flags = authenticatorData[32];
    const signCount = readUint32BE(authenticatorData, 33) >>> 0;
    const expectedRpIdHash = await sha256(new TextEncoder().encode(rpId));
    const rpOk = Buffer.from(rpIdHash).equals(Buffer.from(expectedRpIdHash));
    if (!rpOk) {
        throw new Error("rpIdHash 校验失败");
    }
    return { flags, signCount };
};
const parseRegistrationAuthData = async (attestationObject, rpId) => {
    const map = decodeCborMap(attestationObject);
    const authData = map.get("authData");
    if (!(authData instanceof Uint8Array)) {
        throw new Error("attestationObject.authData 缺失");
    }
    if (authData.length < 37) {
        throw new Error("authData 不完整");
    }
    const flags = authData[32];
    const attested = (flags & 0x40) !== 0;
    if (!attested) {
        throw new Error("authData 不包含 attested credential data");
    }
    await parseAuthenticatorDataForRp(authData.slice(0, 37), rpId);
    const signCount = readUint32BE(authData, 33) >>> 0;
    let offset = 37;
    offset += 16;
    const credIdLen = (authData[offset] << 8) | authData[offset + 1];
    offset += 2;
    const credId = authData.slice(offset, offset + credIdLen);
    offset += credIdLen;
    const coseKeyResult = readCbor(authData, offset);
    if (!(coseKeyResult.value instanceof Map)) {
        throw new Error("COSE public key 解析失败");
    }
    return { credentialId: toBase64Url(credId), coseKey: coseKeyResult.value, signCount };
};
const coseEc2ToJwk = (coseKey) => {
    const kty = coseKey.get(1);
    const crv = coseKey.get(-1);
    const x = coseKey.get(-2);
    const y = coseKey.get(-3);
    if (kty !== 2 || crv !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
        throw new Error("当前只支持 ES256(P-256) 的 passkey");
    }
    return {
        kty: "EC",
        crv: "P-256",
        x: toBase64Url(x),
        y: toBase64Url(y),
        ext: true
    };
};
export const createPasskeyRegisterOptions = async (userId, username, origin) => {
    const originNormalized = normalizeOrigin(origin);
    const rpId = rpIdFromOrigin(originNormalized);
    const challenge = issueChallenge(`register:${userId}`, userId, originNormalized);
    const userIdBytes = new TextEncoder().encode(String(userId));
    return {
        publicKey: {
            challenge,
            rp: { name: "语音转文字事务记录网页", id: rpId },
            user: {
                id: toBase64Url(userIdBytes),
                name: username ?? `user-${userId}`,
                displayName: username ?? `user-${userId}`
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            timeout: 60_000,
            attestation: "none",
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
                residentKey: "preferred"
            }
        }
    };
};
export const verifyAndBindPasskey = async (userId, credential) => {
    const payload = credential;
    if (!payload?.id || payload.type !== "public-key") {
        throw new Error("credential 数据不完整");
    }
    const clientDataRaw = fromBase64Url(String(payload.response?.clientDataJSON ?? ""));
    const clientDataText = Buffer.from(clientDataRaw).toString("utf8");
    const clientData = JSON.parse(clientDataText);
    if (clientData.type !== "webauthn.create") {
        throw new Error("clientData.type 不合法");
    }
    const expected = consumeChallenge(`register:${userId}`, userId);
    if (clientData.challenge !== expected.challenge) {
        throw new Error("challenge 校验失败");
    }
    if (clientData.origin !== expected.origin) {
        throw new Error("origin 校验失败");
    }
    const attObj = fromBase64Url(String(payload.response?.attestationObject ?? ""));
    const { credentialId, coseKey, signCount } = await parseRegistrationAuthData(attObj, expected.rpId);
    const jwk = coseEc2ToJwk(coseKey);
    await query(`
      INSERT INTO webauthn_credentials(user_id, credential_id, public_key_jwk, sign_count, updated_at)
      VALUES ($1, $2, $3::jsonb, $4, NOW())
      ON CONFLICT (credential_id)
      DO UPDATE SET user_id = EXCLUDED.user_id, public_key_jwk = EXCLUDED.public_key_jwk, sign_count = EXCLUDED.sign_count, updated_at = NOW()
    `, [userId, credentialId, JSON.stringify(jwk), signCount]);
    return { credentialId };
};
export const listPasskeys = async (userId) => {
    const result = await query(`
      SELECT id, credential_id, created_at, updated_at
      FROM webauthn_credentials
      WHERE user_id = $1
      ORDER BY id DESC
    `, [userId]);
    return result.rows.map((row) => ({
        id: row.id,
        credentialId: row.credential_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
};
export const deletePasskey = async (userId, credentialId) => {
    const result = await query(`
      DELETE FROM webauthn_credentials
      WHERE user_id = $1 AND credential_id = $2
    `, [userId, credentialId]);
    return (result.rowCount ?? 0) > 0;
};
export const createPasskeyLoginOptions = async (origin) => {
    const normalized = normalizeOrigin(origin);
    const key = `login:${challengeSeed()}`;
    const challenge = issueChallenge(key, null, normalized);
    const creds = await query(`
      SELECT credential_id
      FROM webauthn_credentials
      ORDER BY id DESC
      LIMIT 30
    `);
    return {
        publicKey: {
            challenge,
            timeout: 60_000,
            rpId: rpIdFromOrigin(normalized),
            userVerification: "required",
            allowCredentials: creds.rows.map((row) => ({
                type: "public-key",
                id: row.credential_id
            }))
        }
    };
};
const challengeSeed = () => typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const verifyPasskeyLogin = async (credential) => {
    const payload = credential;
    if (!payload?.id || payload.type !== "public-key") {
        throw new Error("credential 数据不完整");
    }
    const clientDataRaw = fromBase64Url(String(payload.response?.clientDataJSON ?? ""));
    const clientDataText = Buffer.from(clientDataRaw).toString("utf8");
    const clientData = JSON.parse(clientDataText);
    if (clientData.type !== "webauthn.get") {
        throw new Error("clientData.type 不合法");
    }
    const authData = fromBase64Url(String(payload.response?.authenticatorData ?? ""));
    const signature = fromBase64Url(String(payload.response?.signature ?? ""));
    const loginRecord = consumeChallenge(findLoginKey(clientData.challenge), null);
    if (clientData.challenge !== loginRecord.challenge) {
        throw new Error("challenge 校验失败");
    }
    if (clientData.origin !== loginRecord.origin) {
        throw new Error("origin 校验失败");
    }
    const { signCount } = await parseAuthenticatorDataForRp(authData, loginRecord.rpId);
    const record = await query(`
      SELECT user_id, public_key_jwk, sign_count
      FROM webauthn_credentials
      WHERE credential_id = $1
      LIMIT 1
    `, [payload.id]);
    const row = record.rows[0];
    if (!row) {
        throw new Error("该指纹凭证未绑定任何系统账号");
    }
    const jwk = row.public_key_jwk;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const clientHash = await sha256(clientDataRaw);
    const signed = concatBytes(authData, clientHash);
    const rawSig = derToRaw(signature);
    const verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, asArrayBuffer(rawSig), asArrayBuffer(signed));
    if (!verified) {
        throw new Error("指纹验证失败");
    }
    if (signCount !== 0 && row.sign_count !== 0 && signCount <= row.sign_count) {
        throw new Error("signCount 校验失败");
    }
    await query(`
      UPDATE webauthn_credentials
      SET sign_count = $2, updated_at = NOW()
      WHERE credential_id = $1
    `, [payload.id, signCount]);
    return { userId: row.user_id };
};
const findLoginKey = (challenge) => {
    if (!challenge) {
        throw new Error("challenge 缺失");
    }
    const keys = Array.from(pending.entries())
        .filter(([key, value]) => key.startsWith("login:") && value.challenge === challenge)
        .map(([key]) => key);
    if (keys[0]) {
        return keys[0];
    }
    throw new Error("challenge 不存在或已过期");
};
