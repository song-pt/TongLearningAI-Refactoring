import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('server routes enforce signed sessions and server-side ownership', async () => {
  const [chat, history, search, admin] = await Promise.all(['api/chat.ts', 'api/history.ts', 'api/history-search.ts', 'api/admin.ts'].map(source));
  assert.match(chat, /requireSession\(req\)/);
  assert.match(history, /requireSession\(req, 'user'\)/);
  assert.match(search, /requireSession\(req, 'user'\)/);
  assert.match(admin, /requireSession\(req, 'admin'\)/);
  assert.doesNotMatch(chat, /body\.(?:apiKey|model|ownerId)/);
});

test('history is subject-scoped and search indexes questions instead of answers', async () => {
  const [history, chat, sql] = await Promise.all(['api/history.ts', 'api/chat.ts', 'supabase_schema.sql'].map(source));
  assert.match(history, /\.eq\('owner_id', ownerId\)\.eq\('subject_code', subject\)/);
  assert.match(chat, /search_document/);
  assert.match(sql, /regexp_replace\(h\.question/);
  assert.doesNotMatch(sql, /search_document[^\n]*h\.answer/);
});

test('free-tier rolling limits and private storage remain configured', async () => {
  const [history, sql] = await Promise.all(['api/_lib/history.ts', 'supabase_schema.sql'].map(source));
  assert.match(history, /count < 50 && keep\.size < 200/);
  assert.match(history, /slice\(20\)/);
  assert.match(history, /p_max_count: 1000/);
  assert.match(history, /500 \* 1024 \* 1024/);
  assert.match(sql, /'chat-images','chat-images',false,512000/);
});

test('browser bundle has no privileged secrets and UI has no gradients', async () => {
  const [vite, css, env] = await Promise.all(['vite.config.ts', 'index.css', '.env.example'].map(source));
  assert.doesNotMatch(vite, /AI_API_KEY|SERVICE_ROLE|ADMIN_PASSWORD/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(env, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(env, /VITE_(?:ADMIN|AI|SUPABASE_SERVICE)/);
});
