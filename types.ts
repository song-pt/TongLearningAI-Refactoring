export type Role = 'user' | 'admin';
export type Language = 'zh-cn' | 'zh-tw' | 'en';
export interface SessionInfo { authenticated: boolean; session: { role: Role; keyHint?: string } | null }
export interface Subject { code: string; label: string; color: string; icon: string; background_chars?: string; char_opacity?: number; char_size_scale?: number; sort_order: number; is_active?: boolean; prompt_prefix?: string }
export interface Level { code: string; label: string; sort_order: number; is_active?: boolean }
export interface AppConfig { subjects: Subject[]; levels: Level[]; config: Record<string, string>; capabilities: Record<string, unknown> }
export interface Conversation { id: string; subject_code: string; level_code?: string | null; title: string; summary: string; created_at: string; updated_at: string; score?: number }
export interface Message { id: string; role: 'user' | 'assistant' | 'tool' | 'system'; content: string; created_at?: string }
export interface ConversationDetail { conversation: Conversation; messages: Message[] }
export interface HistoryPage { items: Conversation[]; page: number; hasMore: boolean }
export interface SearchResult { items: Conversation[]; mode: 'hybrid' | 'text' }
export interface AdminKey { id: string; code: string | null; code_hint: string; note?: string | null; is_active: boolean; total_tokens: number; token_limit: number | null; total_images: number; image_limit: number | null; created_at: string }
export interface AdminDevice { id: string; owner_id: string; device_id: string; last_seen: string; is_banned: boolean }
export interface AdminData { keys: AdminKey[]; devices: AdminDevice[]; subjects: Subject[]; levels: Level[]; config: Record<string, string>; models: Record<string, string>; runtime: { baseUrl: string; textModel: string; visionModel: string; embeddingModel: string; apiConfigured: boolean; sources: Record<string, string> } }
