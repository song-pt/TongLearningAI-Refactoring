import type { AdminData, AppConfig, ConversationDetail, HistoryPage, SearchResult, SessionInfo } from '../types';
interface ErrorPayload { error?: { code?: string; message?: string } }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try { message = ((await response.json()) as ErrorPayload).error?.message || message; } catch { /* non-JSON */ }
    throw new Error(message);
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('服务端 API 未连接，请使用 Vercel Dev 或检查部署配置');
  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<SessionInfo>('/api/auth'),
  login: (mode: 'user' | 'admin', credential: string, deviceId: string) => request<{ success: boolean; role: 'user' | 'admin' }>('/api/auth', { method: 'POST', body: JSON.stringify({ mode, credential, deviceId }) }),
  logout: () => request<{ success: boolean }>('/api/auth', { method: 'DELETE' }),
  config: () => request<AppConfig>('/api/config'),
  history: (subject: string, page = 0) => request<HistoryPage>(`/api/history?subject=${encodeURIComponent(subject)}&page=${page}`),
  conversation: (id: string) => request<ConversationDetail>(`/api/history?id=${encodeURIComponent(id)}`),
  deleteConversation: (id: string) => request<{ success: boolean }>(`/api/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  searchHistory: (query: string, subject: string, allSubjects = false) => request<SearchResult>('/api/history-search', { method: 'POST', body: JSON.stringify({ query, subject, allSubjects }) }),
  admin: () => request<AdminData>('/api/admin'),
  adminAction: (action: string, payload: Record<string, unknown>) => request<{ success: boolean; code?: string; message?: string; detail?: unknown }>('/api/admin', { method: 'POST', body: JSON.stringify({ action, payload }) }),
};

export interface StreamChatInput { question: string; subjectCode: string; levelCode?: string; conversationId?: string; imageData?: string; useSearch?: boolean }
export async function streamChat(input: StreamChatInput, handlers: { onDelta: (content: string) => void; onMeta: (meta: { conversationId?: string; tokens?: number }) => void; signal?: AbortSignal }) {
  const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: handlers.signal });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({})) as ErrorPayload;
    throw new Error(payload.error?.message || `生成失败 (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';
    for (const raw of events) {
      let event = 'message'; let data = '';
      for (const line of raw.split(/\r?\n/)) { if (line.startsWith('event:')) event = line.slice(6).trim(); if (line.startsWith('data:')) data += line.slice(5).trim(); }
      if (!data) continue;
      const parsed = JSON.parse(data) as { content?: string; conversationId?: string; tokens?: number; message?: string };
      if (event === 'delta' && parsed.content) handlers.onDelta(parsed.content);
      if (event === 'meta') handlers.onMeta(parsed);
      if (event === 'error') throw new Error(parsed.message || '生成中断');
    }
    if (done) break;
  }
}

export function getDeviceId() {
  const key = 'tongai_device_id_v2';
  let value = localStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value); }
  return value;
}

export async function compressImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('只支持 JPG、PNG 和 WebP 图片');
  if (file.size > 12 * 1024 * 1024) throw new Error('原始图片不能超过12MB');
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  for (const quality of [0.78, 0.65, 0.5, 0.38]) { const data = canvas.toDataURL('image/jpeg', quality); if (data.length < 680_000) return data; }
  throw new Error('图片压缩后仍超过500KB，请选择更小的图片');
}
