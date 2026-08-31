import { ApiError } from './http.js';
import { getPrivateConfig } from './db.js';

export async function aiConfig() {
  const stored = await getPrivateConfig(['text_model', 'vision_model', 'embedding_model', 'ai_base_url']);
  return {
    baseUrl: process.env.AI_BASE_URL || stored.ai_base_url || 'https://api.openrouter.ai/api/v1',
    apiKey: process.env.AI_API_KEY || '',
    textModel: process.env.AI_TEXT_MODEL || stored.text_model || 'deepseek-ai/DeepSeek-V3',
    visionModel: process.env.AI_VISION_MODEL || stored.vision_model || 'Qwen/Qwen3-VL-30B-A3B-Instruct',
    embeddingModel: process.env.AI_EMBEDDING_MODEL || stored.embedding_model || '',
    sources: {
      textModel: process.env.AI_TEXT_MODEL ? 'environment' : 'database',
      visionModel: process.env.AI_VISION_MODEL ? 'environment' : 'database',
      embeddingModel: process.env.AI_EMBEDDING_MODEL ? 'environment' : 'database',
    },
  };
}

export function chatCompletionUrl(baseUrl: string) {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  return /\/chat\/completions$/i.test(clean) ? clean : `${clean}/chat/completions`;
}

export async function providerError(response: Response) {
  const raw = (await response.text()).slice(0, 1200);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || raw;
  } catch {
    return raw || `HTTP ${response.status}`;
  }
}

export async function testAiConnection() {
  const provider = await aiConfig();
  ensureAiKey(provider.apiKey);
  const response = await fetch(chatCompletionUrl(provider.baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model: provider.textModel, messages: [{ role: 'user', content: 'Reply with OK.' }], stream: false, temperature: 0, max_tokens: 8 }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ApiError(502, 'provider_error', `AI服务返回 ${response.status}: ${await providerError(response)}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  if (!data.choices?.[0]?.message?.content) throw new ApiError(502, 'invalid_provider_response', 'AI服务已连接，但返回格式不是 OpenAI Chat Completions 格式');
  return { model: provider.textModel, endpoint: chatCompletionUrl(provider.baseUrl) };
}

export async function createEmbedding(text: string): Promise<number[] | null> {
  const config = await aiConfig();
  if (!config.apiKey || !config.embeddingModel) return null;
  try {
    const base = config.baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
    const response = await fetch(`${base}/embeddings`, {
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
