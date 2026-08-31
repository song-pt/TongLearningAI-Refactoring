import { ApiError } from './http.js';
import { getPrivateConfig } from './db.js';

export async function aiConfig() {
  const stored = await getPrivateConfig(['text_model', 'vision_model', 'embedding_model', 'ai_base_url']);
  return {
    baseUrl: process.env.AI_BASE_URL || stored.ai_base_url || 'https://api.openrouter.ai/api/v1',
    apiKey: process.env.AI_API_KEY || '',
    textModel: stored.text_model || process.env.AI_TEXT_MODEL || 'deepseek-ai/DeepSeek-V3',
    visionModel: stored.vision_model || process.env.AI_VISION_MODEL || 'Qwen/Qwen3-VL-30B-A3B-Instruct',
    embeddingModel: stored.embedding_model || process.env.AI_EMBEDDING_MODEL || '',
  };
}

export async function createEmbedding(text: string): Promise<number[] | null> {
  const config = await aiConfig();
  if (!config.apiKey || !config.embeddingModel) return null;
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.embeddingModel, input: text.slice(0, 2000) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
    const embedding = data.data?.[0]?.embedding;
    return embedding?.length === 1536 ? embedding : null;
  } catch {
    return null;
  }
}

export function ensureAiKey(value: string) {
  if (!value) throw new ApiError(500, 'ai_not_configured', 'AI_API_KEY 尚未配置');
}

