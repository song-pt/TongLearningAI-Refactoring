import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { ApiError, assertMethod, handleError } from './_lib/http.js';
import { requireSession } from './_lib/session.js';
import { db } from './_lib/db.js';
import { removeConversationFiles } from './_lib/history.js';

function queryValue(req: ApiRequest, key: string) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    assertMethod(req, ['GET', 'DELETE']);
    const session = requireSession(req, 'user');
    const ownerId = session.ownerId!;
    const id = queryValue(req, 'id');
    if (req.method === 'DELETE') {
      if (!id) throw new ApiError(400, 'missing_id', '缺少会话ID');
      const { data: owned } = await db().from('conversations').select('id').eq('id', id).eq('owner_id', ownerId).maybeSingle();
      if (!owned) throw new ApiError(404, 'not_found', '会话不存在');
      await removeConversationFiles([id]);
      const { error } = await db().from('conversations').delete().eq('id', id).eq('owner_id', ownerId);
      if (error) throw new ApiError(500, 'database_error', error.message);
      return res.status(200).json({ success: true });
    }
    if (id) {
      const { data: conversation, error } = await db().from('conversations').select('id,subject_code,level_code,title,summary,created_at,updated_at').eq('id', id).eq('owner_id', ownerId).maybeSingle();
      if (error) throw new ApiError(500, 'database_error', error.message);
      if (!conversation) throw new ApiError(404, 'not_found', '会话不存在');
      const { data: messages, error: messageError } = await db().from('messages').select('id,role,content,created_at').eq('conversation_id', id).order('created_at');
      if (messageError) throw new ApiError(500, 'database_error', messageError.message);
      return res.status(200).json({ conversation, messages: messages || [] });
    }
    const subject = queryValue(req, 'subject');
    if (!subject) throw new ApiError(400, 'missing_subject', '缺少学科');
    const page = Math.max(0, Number(queryValue(req, 'page')) || 0);
    const pageSize = 20;
    const { data, error } = await db().from('conversations')
      .select('id,subject_code,level_code,title,summary,created_at,updated_at')
      .eq('owner_id', ownerId).eq('subject_code', subject)
      .order('updated_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new ApiError(500, 'database_error', error.message);
    return res.status(200).json({ items: data || [], page, hasMore: (data || []).length === pageSize });
  } catch (error) {
    handleError(res, error);
  }
}
