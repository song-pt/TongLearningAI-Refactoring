import assert from 'node:assert/strict';
import test from 'node:test';
import { parseResponseBlocks, stripBlockMarkers } from '../features/chat/responseBlocks';

test('parses model-authored semantic blocks without exposing protocol markers', () => {
  const value = `[[TONGAI_BLOCK id=step_1 label=移项]]\n$x+1=3$\n[[/TONGAI_BLOCK]]\n[[TONGAI_BLOCK id=step_2 label=结论]]\n$x=2$\n[[/TONGAI_BLOCK]]`;
  assert.deepEqual(parseResponseBlocks(value), [
    { id: 'step_1', label: '移项', content: '$x+1=3$' },
    { id: 'step_2', label: '结论', content: '$x=2$' },
  ]);
  assert.equal(stripBlockMarkers(value).includes('TONGAI_BLOCK'), false);
});

test('falls back to selectable paragraphs when a provider ignores the protocol', () => {
  const blocks = parseResponseBlocks('先整理条件。\n\n然后代入计算。');
  assert.equal(blocks.length, 2);
  assert.equal(blocks.at(1)?.content, '然后代入计算。');
});
