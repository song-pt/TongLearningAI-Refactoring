import { createHash, timingSafeEqual } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { ApiError, assertMethod, handleError, readJson, stringField } from './_lib/http.js';
import { clearSessionCookie, createSession, readSession, setSessionCookie } from './_lib/session.js';
import { db } from './_lib/db.js';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    assertMethod(req, ['GET', 'POST', 'DELETE']);
    if (req.method === 'GET') {
      const session = readSession(req);
      return res.status(200).json({ authenticated: !!session, session: session ? { role: session.role, keyHint: session.keyHint } : null });
    }
    if (req.method === 'DELETE') {
      clearSessionCookie(res);
      return res.status(200).json({ success: true });
    }

    const body = readJson<{ mode?: string; credential?: unknown; deviceId?: unknown }>(req);
    const credential = stringField(body.credential, '登录凭证', 200);
    if (body.mode === 'admin') {
      const [{ data }, { data: configured, error: configError }] = await Promise.all([
        db().rpc('verify_admin_password', { input_password: credential }),
        db().from('private_config').select('key').eq('key', 'admin_password_hash').maybeSingle(),
      ]);
      if (configError) throw new ApiError(500, 'database_error', configError.message);
      const fallback = process.env.ADMIN_PASSWORD || '';
      const valid = configured ? data === true : !!fallback && safeEqual(credential, fallback);
      if (!valid) throw new ApiError(401, 'invalid_credentials', '管理员密码错误');
      setSessionCookie(res, createSession({ role: 'admin' }), 60 * 60 * 12);
      return res.status(200).json({ success: true, role: 'admin' });
    }

    const codeHash = sha256(credential);
    const { data: key, error } = await db().from('access_keys').select('id,code_hint,is_active,total_tokens,token_limit,total_images,image_limit').eq('code_hash', codeHash).maybeSingle();
    if (error) throw new ApiError(500, 'database_error', error.message);
    if (!key?.is_active) throw new ApiError(401, 'invalid_credentials', '访问密钥无效或已停用');
    if (key.token_limit !== null && key.total_tokens >= key.token_limit) throw new ApiError(402, 'quota_exceeded', 'Token额度已用完');

    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 100) : 'unknown';
    const { data: device } = await db().from('device_sessions').select('is_banned').eq('owner_id', key.id).eq('device_id', deviceId).maybeSingle();
    if (device?.is_banned) throw new ApiError(403, 'device_banned', '此设备已被停用');
    await db().from('device_sessions').upsert({ owner_id: key.id, device_id: deviceId, last_seen: new Date().toISOString() }, { onConflict: 'owner_id,device_id' });

    setSessionCookie(res, createSession({ role: 'user', ownerId: key.id, keyHint: key.code_hint }));
    return res.status(200).json({ success: true, role: 'user', keyHint: key.code_hint });
  } catch (error) {
    handleError(res, error);
  }
}
