import assert from 'node:assert/strict';
import test from 'node:test';
import { chatCompletionUrl, providerError } from '../api/_lib/ai.js';

test('chat completion URL accepts either a base URL or a full endpoint', () => {
  assert.equal(chatCompletionUrl('https://api.example.com/v1/'), 'https://api.example.com/v1/chat/completions');
  assert.equal(chatCompletionUrl('https://api.example.com/v1/chat/completions'), 'https://api.example.com/v1/chat/completions');
  assert.equal(chatCompletionUrl(' https://api.example.com/openai/ '), 'https://api.example.com/openai/chat/completions');
});

test('provider errors expose the useful upstream message', async () => {
  assert.equal(await providerError(new Response(JSON.stringify({ error: { message: 'model_not_found' } }))), 'model_not_found');
  assert.equal(await providerError(new Response('gateway unavailable')), 'gateway unavailable');
});
