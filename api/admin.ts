import { createHash } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { ApiError, assertMethod, handleError, readJson, stringField } from './_lib/http.js';
import { requireSession } from './_lib/session.js';
import { db, getPrivateConfig } from './_lib/db.js';
import { removeOwnerFiles } from './_lib/history.js';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    assertMethod(req, ['GET', 'POST']);
    requireSession(req, 'admin');
    if (req.method === 'GET') {
      const [keys, devices, subjects, levels, publicConfig, privateConfig] = await Promise.all([
        db().from('access_keys').select('id,code_hint,note,is_active,total_tokens,token_limit,total_images,image_limit,created_at').order('created_at', { ascending: false }).limit(200),
        db().from('device_sessions').select('id,owner_id,device_id,last_seen,is_banned').order('last_seen', { ascending: false }).limit(200),
        db().from('subjects').select('*').order('sort_order'),
        db().from('levels').select('*').order('sort_order'),
        db().from('public_config').select('key,value'),
        getPrivateConfig(['text_model', 'vision_model', 'embedding_model']),
      ]);
      const firstError = [keys.error, devices.error, subjects.error, levels.error, publicConfig.error].find(Boolean);
      if (firstError) throw new ApiError(500, 'database_error', firstError.message);
      return res.status(200).json({
        keys: keys.data || [], devices: devices.data || [], subjects: subjects.data || [], levels: levels.data || [],
        config: Object.fromEntries((publicConfig.data || []).map((row) => [row.key, row.value])),
        models: privateConfig,
      });
    }

    const body = readJson<{ action?: string; payload?: Record<string, unknown> }>(req);
    const action = stringField(body.action, '操作', 80);
    const payload = body.payload || {};
    switch (action) {
      case 'key.create': {
        const code = stringField(payload.code, '密钥', 200);
        const hint = code.length <= 8 ? code.slice(0, 2) + '••••' : `${code.slice(0, 4)}••••${code.slice(-2)}`;
        const { error } = await db().from('access_keys').insert({ code_hash: sha256(code), code_hint: hint, note: typeof payload.note === 'string' ? payload.note.slice(0, 200) : null });
        if (error) throw new ApiError(400, 'key_create_failed', error.message);
        return res.status(200).json({ success: true, code });
      }
      case 'key.update': {
        const id = stringField(payload.id, '密钥ID', 80);
        const updates: Record<string, unknown> = {};
        if (typeof payload.isActive === 'boolean') updates.is_active = payload.isActive;
        if (payload.tokenLimit === null || Number.isFinite(payload.tokenLimit)) updates.token_limit = payload.tokenLimit;
        if (payload.imageLimit === null || Number.isFinite(payload.imageLimit)) updates.image_limit = payload.imageLimit;
        if (typeof payload.note === 'string') updates.note = payload.note.slice(0, 200);
        const { error } = await db().from('access_keys').update(updates).eq('id', id);
        if (error) throw new ApiError(400, 'key_update_failed', error.message);
        return res.status(200).json({ success: true });
      }
      case 'key.delete': {
        const id = stringField(payload.id, '密钥ID', 80);
        await removeOwnerFiles(id);
        const { error } = await db().from('access_keys').delete().eq('id', id);
        if (error) throw new ApiError(400, 'key_delete_failed', error.message);
        return res.status(200).json({ success: true });
      }
      case 'device.toggle': {
        const { error } = await db().from('device_sessions').update({ is_banned: !!payload.banned }).eq('id', stringField(payload.id, '设备ID', 80));
        if (error) throw new ApiError(400, 'device_update_failed', error.message);
        return res.status(200).json({ success: true });
      }
      case 'subject.upsert': {
        const code = stringField(payload.code, '学科编码', 60);
        const row = {
          code, label: stringField(payload.label, '学科名称', 100), color: typeof payload.color === 'string' ? payload.color : 'slate',
          icon: typeof payload.icon === 'string' ? payload.icon : 'book', prompt_prefix: typeof payload.promptPrefix === 'string' ? payload.promptPrefix.slice(0, 4000) : '',
          background_chars: typeof payload.backgroundChars === 'string' ? payload.backgroundChars.slice(0, 100) : '', sort_order: Number(payload.sortOrder) || 0,
          is_active: payload.isActive !== false,
        };
        const { error } = await db().from('subjects').upsert(row);
        if (error) throw new ApiError(400, 'subject_save_failed', error.message);
        return res.status(200).json({ success: true });
      }
      case 'subject.delete':
        await db().from('subjects').delete().eq('code', stringField(payload.code, '学科编码', 60));
        return res.status(200).json({ success: true });
      case 'level.upsert': {
        const row = { code: stringField(payload.code, '等级编码', 60), label: stringField(payload.label, '等级名称', 100), sort_order: Number(payload.sortOrder) || 0, is_active: payload.isActive !== false };
        const { error } = await db().from('levels').upsert(row, { onConflict: 'code' });
        if (error) throw new ApiError(400, 'level_save_failed', error.message);
        return res.status(200).json({ success: true });
      }
      case 'level.delete':
        await db().from('levels').delete().eq('code', stringField(payload.code, '等级编码', 60));
        return res.status(200).json({ success: true });
      case 'config.update': {
        const publicRows = Object.entries(payload.public || {}).map(([key, value]) => ({ key, value: String(value) }));
        const privateRows = Object.entries(payload.models || {}).filter(([key]) => ['text_model', 'vision_model', 'embedding_model'].includes(key)).map(([key, value]) => ({ key, value: String(value) }));
        if (publicRows.length) await db().from('public_config').upsert(publicRows);
        if (privateRows.length) await db().from('private_config').upsert(privateRows);
        if (typeof payload.adminPassword === 'string' && payload.adminPassword.length >= 10) await db().rpc('set_admin_password', { new_password: payload.adminPassword });
        return res.status(200).json({ success: true });
      }
      default:
        throw new ApiError(400, 'unknown_action', '未知管理操作');
    }
  } catch (error) {
    handleError(res, error);
  }
}
