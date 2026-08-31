import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './http.js';
import { ApiError } from './http.js';

export interface SessionPayload {
  role: 'user' | 'admin';
  ownerId?: string;
  keyHint?: string;
  exp: number;
}

const COOKIE = 'tongai_session';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new ApiError(500, 'server_config', 'SESSION_SECRET 至少需要32个字符');
  return value;
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createSession(payload: Omit<SessionPayload, 'exp'>, maxAge = 60 * 60 * 24 * 7) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAge })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function readSession(req: ApiRequest): SessionPayload | null {
  const cookie = req.headers.cookie || '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireSession(req: ApiRequest, role?: SessionPayload['role']) {
  const session = readSession(req);
  if (!session) throw new ApiError(401, 'unauthorized', '请重新登录');
  if (role && session.role !== role) throw new ApiError(403, 'forbidden', '当前账号没有此权限');
  return session;
}

export function setSessionCookie(res: ApiResponse, token: string, maxAge = 60 * 60 * 24 * 7) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

export function clearSessionCookie(res: ApiResponse) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
