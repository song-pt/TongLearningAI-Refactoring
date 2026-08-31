import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { ApiError, assertMethod, handleError, readJson, stringField } from './_lib/http.js';
import { requireSession } from './_lib/session.js';
import { db } from './_lib/db.js';
import { createEmbedding } from './_lib/ai.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    assertMethod(req, ['POST']);
    const session = requireSession(req, 'user');
    const body = readJson<{ query?: unknown; subject?: unknown; allSubjects?: boolean }>(req);
    const query = stringField(body.query, '题目描述', 500);
    const subject = typeof body.subject === 'string' && !body.allSubjects ? body.subject : null;
    const embedding = await createEmbedding(query);
    const { data, error } = await db().rpc('search_history', {
      p_owner_id: session.ownerId,
      p_subject_code: subject,
      p_query: query,
      p_embedding: embedding ? `[${embedding.join(',')}]` : null,
      p_limit: 10,
    });
    if (error) throw new ApiError(500, 'search_failed', error.message);
    return res.status(200).json({ items: data || [], mode: embedding ? 'hybrid' : 'text' });
  } catch (error) {
    handleError(res, error);
  }
}
