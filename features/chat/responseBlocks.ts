import type { AnswerBlock } from '../../types';

const OPEN = /\[\[TONGAI_BLOCK\s+id=([a-zA-Z0-9_-]{1,48})\s+label=([^\]\n]{1,40})\]\]/g;
const COMPLETE = /\[\[TONGAI_BLOCK\s+id=([a-zA-Z0-9_-]{1,48})\s+label=([^\]\n]{1,40})\]\]([\s\S]*?)\[\[\/TONGAI_BLOCK\]\]/g;

export function stripBlockMarkers(content: string) {
  return content
    .replace(/\[\[TONGAI_BLOCK[^\]\n]*(?:\]\])?/g, '')
    .replace(/\[\[\/TONGAI_BLOCK(?:\]\])?/g, '')
    .replace(/\[\[\/?TONGAI(?:_BLOCK)?[^\]\n]*$/g, '')
    .trim();
}

export function parseResponseBlocks(content: string): AnswerBlock[] {
  const structured: AnswerBlock[] = [];
  for (const match of content.matchAll(COMPLETE)) {
    const id = match[1]; const label = match[2]; const rawContent = match[3];
    if (!id || !label || !rawContent) continue;
    const blockContent = rawContent.trim();
    if (blockContent) structured.push({ id, label: label.trim(), content: blockContent });
  }
  const openCount = [...content.matchAll(OPEN)].length;
  if (structured.length && structured.length === openCount) return structured;

  const clean = stripBlockMarkers(content);
  if (!clean) return [];
  const chunks = clean.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
  return (chunks.length > 1 ? chunks : [clean]).map((part, index) => ({
    id: `part_${index + 1}`,
    label: chunks.length > 1 ? `片段 ${index + 1}` : '完整回答',
    content: part,
  }));
}
