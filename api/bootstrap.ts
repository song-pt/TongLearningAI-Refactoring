import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { assertMethod, handleError } from './_lib/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    assertMethod(req, ['GET']);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    return res.status(200).json({
      configVersion: 1,
      apiVersion: 1,
      apiBaseUrl: process.env.PUBLIC_API_BASE_URL || '',
      minimumAndroidVersion: 1,
      features: ['chat', 'vision', 'subject-history', 'history-search'],
      expiresInSeconds: 3600,
    });
  } catch (error) {
    handleError(res, error);
  }
}
