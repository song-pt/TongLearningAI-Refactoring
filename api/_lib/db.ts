import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './http.js';

let client: SupabaseClient<any> | undefined;

export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError(500, 'server_config', '服务端数据库配置不完整');
  client = createClient<any>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function getPrivateConfig(keys: string[]) {
  const { data, error } = await db().from('private_config').select('key,value').in('key', keys);
  if (error) throw new ApiError(500, 'database_error', error.message);
  return Object.fromEntries((data || []).map((row) => [row.key, row.value])) as Record<string, string>;
}
