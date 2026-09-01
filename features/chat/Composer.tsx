import { useRef, useState } from 'react';
import { Globe2, ImagePlus, Send, Square, X } from 'lucide-react';
import { compressImage } from '../../services/client';
import type { AnswerBlock, Language, Level } from '../../types';
import { copy } from '../../i18n';

export default function Composer({ language, levels, busy, searchAllowed, isFollowUp, focusBlock, onClearFocus, onSend, onStop }: { language: Language; levels: Level[]; busy: boolean; searchAllowed: boolean; isFollowUp: boolean; focusBlock?: AnswerBlock; onClearFocus: () => void; onSend: (value: { text: string; level: string; image?: string; search: boolean }) => void; onStop: () => void }) {
  const [text, setText] = useState(''); const [level, setLevel] = useState(''); const [image, setImage] = useState<string>(); const [search, setSearch] = useState(false); const [error, setError] = useState(''); const fileRef = useRef<HTMLInputElement>(null); const t = copy[language];
  const submit = () => { if ((!text.trim() && !image) || busy) return; onSend({ text: text.trim() || '请分析这张图片。', level, image, search }); setText(''); setImage(undefined); };
  const chooseFile = async (file?: File) => { if (!file) return; try { setError(''); setImage(await compressImage(file)); setSearch(false); } catch (e) { setError(e instanceof Error ? e.message : '图片处理失败'); } };
  return <div className="composer-wrap"><div className="composer-context"><strong>{isFollowUp ? t.followUpInput : t.newProblemInput}</strong>{isFollowUp && <span>{t.followUpHint}</span>}</div><div className="composer">
    {focusBlock && <div className="focus-chip"><div><span>{t.selectedPart} · {focusBlock.label}</span><p>{focusBlock.content.replace(/\s+/g, ' ').slice(0, 100)}</p></div><button type="button" aria-label="取消选中片段" onClick={onClearFocus}><X size={15} /></button></div>}
    {image && <div className="image-chip"><img src={image} alt="待上传" /><button aria-label="移除图片" onClick={() => setImage(undefined)}><X size={14} /></button></div>}
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isFollowUp ? t.followUpPlaceholder : t.newProblemPlaceholder} rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
    <div className="composer-actions"><div className="composer-options">{!isFollowUp && <select value={level} onChange={(e) => setLevel(e.target.value)}><option value="">{t.level}</option>{levels.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select>}<input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => void chooseFile(e.target.files?.[0])} /><button title={t.upload} onClick={() => fileRef.current?.click()}><ImagePlus size={18} /></button>{searchAllowed && <button className={search ? 'active-tool' : ''} title={t.webSearch} onClick={() => setSearch(!search)}><Globe2 size={18} /></button>}</div>{busy ? <button className="send-button" onClick={onStop} title={t.stop}><Square size={16} /></button> : <button className="send-button" onClick={submit} title={t.send}><Send size={17} /></button>}</div>
  </div>{error && <p className="inline-error">{error}</p>}</div>;
}
