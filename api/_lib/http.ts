import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiRequest = IncomingMessage & { body?: unknown; method?: string; query?: Record<string, string | string[]> };
export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse;
  json(value: unknown): void;
  send(value: string): void;
};

export function readJson<T>(req: ApiRequest): T {
  if (!req.body || typeof req.body !== 'object') throw new ApiError(400, 'invalid_body', '请求数据格式无效');
  return req.body as T;
}

export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

export function handleError(res: ApiResponse, error: unknown) {
  const known = error instanceof ApiError;
  const status = known ? error.statusCode : 500;
  const code = known ? error.code : 'internal_error';
  const message = known ? error.message : '服务器暂时无法完成请求';
  if (!res.headersSent) res.status(status).json({ error: { code, message } });
  else res.end();
}

export function assertMethod(req: ApiRequest, allowed: string[]) {
  if (!req.method || !allowed.includes(req.method)) {
    throw new ApiError(405, 'method_not_allowed', '请求方法不受支持');
  }
}

export function stringField(value: unknown, name: string, max = 5000): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, 'invalid_field', `${name}不能为空`);
  const normalized = value.trim();
  if (normalized.length > max) throw new ApiError(400, 'field_too_long', `${name}过长`);
  return normalized;
}
