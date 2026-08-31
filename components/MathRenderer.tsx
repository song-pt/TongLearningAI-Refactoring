import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default function MathRenderer({ content }: { content: string }) {
  const normalized = content.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  return <div className="prose prose-slate max-w-none break-words"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { output: 'html', strict: false }]]}>{normalized}</ReactMarkdown></div>;
}
