import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { AnswerBlock } from '../types';
import { parseResponseBlocks, stripBlockMarkers } from '../features/chat/responseBlocks';

function Markdown({ content }: { content: string }) {
  const normalized = content.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  return <div className="prose prose-slate max-w-none break-words"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { output: 'html', strict: false }]]}>{normalized}</ReactMarkdown></div>;
}

export default function MathRenderer({ content, selectable = false, selectedId, onSelect }: { content: string; selectable?: boolean; selectedId?: string; onSelect?: (block: AnswerBlock) => void }) {
  if (!selectable) return <Markdown content={stripBlockMarkers(content)} />;
  const blocks = parseResponseBlocks(content);
  return <div className="answer-blocks">{blocks.map((block) => <button
    type="button"
    className={`answer-block${selectedId === block.id ? ' selected' : ''}`}
    key={block.id}
    aria-pressed={selectedId === block.id}
    onClick={() => onSelect?.(block)}
  ><span className="answer-block-label">{block.label}</span><Markdown content={block.content} /></button>)}</div>;
}
