import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { assertMethod, handleError } from './_lib/http.js';
import { db } from './_lib/db.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    assertMethod(req, ['GET']);
    const [subjects, levels, config] = await Promise.all([
      db().from('subjects').select('code,label,color,icon,background_chars,char_opacity,char_size_scale,sort_order').eq('is_active', true).order('sort_order'),
      db().from('levels').select('code,label,sort_order').eq('is_active', true).order('sort_order'),
      db().from('public_config').select('key,value'),
    ]);
    if (subjects.error) throw subjects.error;
    if (levels.error) throw levels.error;
    if (config.error) throw config.error;
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json({
      subjects: subjects.data || [],
      levels: levels.data || [],
      config: Object.fromEntries((config.data || []).map((row) => [row.key, row.value])),
      capabilities: { apiVersion: 1, historySearch: true, vision: true, streaming: true, androidCompatible: true },
    });
  } catch (error) {
    handleError(res, error);
  }
}

