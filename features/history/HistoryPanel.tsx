import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { Clock3, Search, Trash2 } from 'lucide-react';
import { api } from '../../services/client';
import type { Conversation, Language, Subject } from '../../types';
import { copy } from '../../i18n';

export default function HistoryPanel({ subject, subjects, language, refreshKey, onOpen }: { subject: string; subjects: Subject[]; language: Language; refreshKey: number; onOpen: (item: Conversation) => void }) {
  const [items, setItems] = useState<Conversation[]>([]); const [query, setQuery] = useState(''); const [allSubjects, setAllSubjects] = useState(false); const [loading, setLoading] = useState(false); const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false); const [error, setError] = useState('');
  const t = copy[language];
  const load = useCallback(async (nextPage = 0) => { setLoading(true); setError(''); try { const result = await api.history(subject, nextPage); setItems((old) => nextPage ? [...old, ...result.items] : result.items); setPage(result.page); setHasMore(result.hasMore); } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); } finally { setLoading(false); } }, [subject]);
  useEffect(() => { void load(0); }, [load, refreshKey]);
  const search = async (event: FormEvent) => { event.preventDefault(); if (!query.trim()) return void load(0); setLoading(true); setError(''); try { const result = await api.searchHistory(query, subject, allSubjects); setItems(result.items); setHasMore(false); } catch (e) { setError(e instanceof Error ? e.message : '查找失败'); } finally { setLoading(false); } };
  const remove = async (event: MouseEvent, id: string) => { event.stopPropagation(); if (!confirm(t.delete + '?')) return; await api.deleteConversation(id); setItems((old) => old.filter((item) => item.id !== id)); };
  return <aside className="history-panel" aria-label={t.history}>
    <div className="history-heading"><div><span className="eyebrow">{subjects.find((s) => s.code === subject)?.label}</span><h2>{t.history}</h2></div><Clock3 size={18} /></div>
    <form className="history-search" onSubmit={search}><div><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchHint} /></div><label><input type="checkbox" checked={allSubjects} onChange={(e) => setAllSubjects(e.target.checked)} />{t.allSubjects}</label></form>
    {error && <p className="inline-error">{error}</p>}
    <div className="history-list">{!loading && !items.length && <p className="empty-note">{t.noHistory}</p>}{items.map((item) => <div className="history-item" key={item.id}><button className="history-open" onClick={() => onOpen(item)}><span className="history-title">{item.title}</span><span className="history-meta">{subjects.find((s) => s.code === item.subject_code)?.label || item.subject_code} · {new Date(item.updated_at).toLocaleDateString()}</span></button><button className="delete-history" aria-label={t.delete} onClick={(e) => void remove(e, item.id)}><Trash2 size={14} /></button></div>)}</div>
    {loading && <p className="empty-note">…</p>}{hasMore && <button className="secondary wide" onClick={() => void load(page + 1)}>{t.loadMore}</button>}
  </aside>;
}
