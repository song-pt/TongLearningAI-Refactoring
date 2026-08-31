import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, KeyRound, MonitorSmartphone, Plus, Settings2, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { api } from '../../services/client';
import type { AdminData, AdminKey, Level, Subject } from '../../types';

type Tab = 'keys' | 'devices' | 'content' | 'settings';
type Action = (action: string, payload: Record<string, unknown>) => Promise<boolean>;

export default function AdminPanel({ onExit, onLogout }: { onExit: () => void; onLogout: () => void }) {
  const [data, setData] = useState<AdminData>();
  const [tab, setTab] = useState<Tab>('keys');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setBusy(true);
    setError('');
    try { setData(await api.admin()); }
    catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { if (!quiet) setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const act: Action = async (action, payload) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.adminAction(action, payload);
      setNotice(result.message || (result.code ? `已创建密钥：${result.code}` : '操作已完成'));
      await load(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
      return false;
    } finally { setBusy(false); }
  };

  return <div className="admin-page">
    <header className="admin-header"><div><button className="icon-text" onClick={onExit}><ArrowLeft size={17} />返回</button><h1>管理后台</h1></div><button className="text-button" onClick={onLogout}>退出登录</button></header>
    <nav className="admin-tabs"><button className={tab === 'keys' ? 'active' : ''} onClick={() => setTab('keys')}><KeyRound size={16} />访问密钥</button><button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')}><MonitorSmartphone size={16} />设备</button><button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}><SlidersHorizontal size={16} />学科与等级</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings2 size={16} />系统设置</button></nav>
    <div className="admin-feedback" aria-live="polite">{error && <p className="banner-error">{error}</p>}{notice && <p className="banner-success">{notice}</p>}</div>
    {busy && !data && <p className="empty-note">正在加载…</p>}
    {data && <main className="admin-content">
      {tab === 'keys' && <KeysTab data={data} act={act} busy={busy} />}
      {tab === 'devices' && <section className="admin-section"><h2>设备记录</h2><div className="table-wrap"><table><thead><tr><th>设备</th><th>最近活动</th><th>状态</th><th /></tr></thead><tbody>{data.devices.map((d) => <tr key={d.id}><td className="mono">{d.device_id}</td><td>{new Date(d.last_seen).toLocaleString()}</td><td>{d.is_banned ? '已停用' : '正常'}</td><td><button className="secondary" disabled={busy} onClick={() => void act('device.toggle', { id: d.id, banned: !d.is_banned })}>{d.is_banned ? '恢复' : '停用'}</button></td></tr>)}</tbody></table></div></section>}
      {tab === 'content' && <ContentTab data={data} act={act} busy={busy} />}
      {tab === 'settings' && <SettingsTab data={data} act={act} busy={busy} />}
    </main>}
  </div>;
}

function KeysTab({ data, act, busy }: { data: AdminData; act: Action; busy: boolean }) {
  const [newCode, setNewCode] = useState(''); const [newNote, setNewNote] = useState(''); const [editing, setEditing] = useState<AdminKey>();
  const create = async (event: FormEvent) => { event.preventDefault(); if (await act('key.create', { code: newCode, note: newNote })) { setNewCode(''); setNewNote(''); } };
  return <>
    <section className="admin-section"><h2>创建访问密钥</h2><form className="inline-form" onSubmit={(e) => void create(e)}><input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="新的访问密钥" required /><input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="备注" /><button className="primary" disabled={busy}>创建</button></form></section>
    <section className="admin-section"><h2>密钥与额度</h2><div className="key-grid">{data.keys.map((key) => <article className="key-card" key={key.id}><div><strong className="mono key-full">{key.code || `${key.code_hint}（旧记录需重置）`}</strong><span>{key.note || '无备注'}</span></div><dl><div><dt>Token</dt><dd>{key.total_tokens} / {key.token_limit ?? '∞'}</dd></div><div><dt>图片</dt><dd>{key.total_images} / {key.image_limit ?? '∞'}</dd></div></dl><div className="card-actions"><button className="secondary" onClick={() => setEditing(key)}>编辑</button><button className="secondary" disabled={busy} onClick={() => void act('key.update', { id: key.id, isActive: !key.is_active })}>{key.is_active ? '停用' : '启用'}</button><button className="danger-icon" disabled={busy} onClick={() => confirm('确定删除此密钥及其历史？') && void act('key.delete', { id: key.id })}><Trash2 size={15} /></button></div></article>)}</div></section>
    {editing && <KeyDialog item={editing} busy={busy} onClose={() => setEditing(undefined)} onSave={async (payload) => { if (await act('key.update', { id: editing.id, ...payload })) setEditing(undefined); }} />}
  </>;
}

function KeyDialog({ item, busy, onClose, onSave }: { item: AdminKey; busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [code, setCode] = useState(item.code || ''); const [note, setNote] = useState(item.note || ''); const [tokenLimit, setTokenLimit] = useState(item.token_limit?.toString() || ''); const [imageLimit, setImageLimit] = useState(item.image_limit?.toString() || '');
  return <Dialog title="编辑访问密钥" onClose={onClose}><form className="dialog-form" onSubmit={(e) => { e.preventDefault(); void onSave({ code, note, tokenLimit: tokenLimit ? Number(tokenLimit) : null, imageLimit: imageLimit ? Number(imageLimit) : null }); }}><label>完整密钥<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="为旧记录设置新密钥" required /></label><label>备注<input value={note} onChange={(e) => setNote(e.target.value)} /></label><div className="dialog-grid"><label>Token 上限<input type="number" min="0" value={tokenLimit} onChange={(e) => setTokenLimit(e.target.value)} placeholder="留空表示无限" /></label><label>图片上限<input type="number" min="0" value={imageLimit} onChange={(e) => setImageLimit(e.target.value)} placeholder="留空表示无限" /></label></div><DialogActions busy={busy} onClose={onClose} /></form></Dialog>;
}

function ContentTab({ data, act, busy }: { data: AdminData; act: Action; busy: boolean }) {
  const [subject, setSubject] = useState<Subject | 'new'>(); const [level, setLevel] = useState<Level | 'new'>();
  return <div className="admin-two-column">
    <section className="admin-section"><div className="section-heading"><h2>学科</h2><button className="secondary" onClick={() => setSubject('new')}><Plus size={15} />新增</button></div><div className="simple-list">{data.subjects.map((s) => <div key={s.code}><span><strong>{s.label}</strong><small>{s.code}</small></span><span><button className="secondary" onClick={() => setSubject(s)}>编辑</button><button className="danger-icon" disabled={busy} onClick={() => confirm('删除学科？') && void act('subject.delete', { code: s.code })}><Trash2 size={15} /></button></span></div>)}</div></section>
    <section className="admin-section"><div className="section-heading"><h2>等级</h2><button className="secondary" onClick={() => setLevel('new')}><Plus size={15} />新增</button></div><div className="simple-list">{data.levels.map((l) => <div key={l.code}><span><strong>{l.label}</strong><small>{l.code}</small></span><span><button className="secondary" onClick={() => setLevel(l)}>编辑</button><button className="danger-icon" disabled={busy} onClick={() => confirm('删除等级？') && void act('level.delete', { code: l.code })}><Trash2 size={15} /></button></span></div>)}</div></section>
    {subject && <SubjectDialog item={subject === 'new' ? undefined : subject} nextOrder={data.subjects.length + 1} busy={busy} onClose={() => setSubject(undefined)} onSave={async (payload) => { if (await act('subject.upsert', payload)) setSubject(undefined); }} />}
    {level && <LevelDialog item={level === 'new' ? undefined : level} nextOrder={data.levels.length + 1} busy={busy} onClose={() => setLevel(undefined)} onSave={async (payload) => { if (await act('level.upsert', payload)) setLevel(undefined); }} />}
  </div>;
}

function SubjectDialog({ item, nextOrder, busy, onClose, onSave }: { item?: Subject; nextOrder: number; busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [code, setCode] = useState(item?.code || ''); const [label, setLabel] = useState(item?.label || ''); const [promptPrefix, setPromptPrefix] = useState(item?.prompt_prefix || ''); const [backgroundChars, setBackgroundChars] = useState(item?.background_chars || ''); const [sortOrder, setSortOrder] = useState(item?.sort_order ?? nextOrder); const [active, setActive] = useState(item?.is_active !== false);
  return <Dialog title={item ? '编辑学科' : '新增学科'} onClose={onClose}><form className="dialog-form" onSubmit={(e) => { e.preventDefault(); void onSave({ code, label, promptPrefix, backgroundChars, color: item?.color || 'slate', icon: item?.icon || 'book', sortOrder, isActive: active }); }}><div className="dialog-grid"><label>学科编码<input value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9_-]/gi, '').toLowerCase())} placeholder="例如 physics" disabled={!!item} required /></label><label>显示名称<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例如 物理" required /></label></div><label>学科提示词<textarea rows={7} value={promptPrefix} onChange={(e) => setPromptPrefix(e.target.value)} placeholder="描述该学科的回答要求" /></label><div className="dialog-grid"><label>背景字符<input value={backgroundChars} onChange={(e) => setBackgroundChars(e.target.value)} /></label><label>排序<input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></label></div><label className="check-row"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />启用该学科</label><DialogActions busy={busy} onClose={onClose} /></form></Dialog>;
}

function LevelDialog({ item, nextOrder, busy, onClose, onSave }: { item?: Level; nextOrder: number; busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [code, setCode] = useState(item?.code || ''); const [label, setLabel] = useState(item?.label || ''); const [sortOrder, setSortOrder] = useState(item?.sort_order ?? nextOrder); const [active, setActive] = useState(item?.is_active !== false);
  return <Dialog title={item ? '编辑等级' : '新增等级'} onClose={onClose}><form className="dialog-form" onSubmit={(e) => { e.preventDefault(); void onSave({ code, label, sortOrder, isActive: active }); }}><div className="dialog-grid"><label>等级编码<input value={code} onChange={(e) => setCode(e.target.value)} disabled={!!item} required /></label><label>等级名称<input value={label} onChange={(e) => setLabel(e.target.value)} required /></label></div><label>排序<input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></label><label className="check-row"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />启用该等级</label><DialogActions busy={busy} onClose={onClose} /></form></Dialog>;
}

function SettingsTab({ data, act, busy }: { data: AdminData; act: Action; busy: boolean }) {
  const [title, setTitle] = useState(data.config.app_title || 'TongAI'); const [textModel, setTextModel] = useState(data.models.text_model || ''); const [visionModel, setVisionModel] = useState(data.models.vision_model || ''); const [embeddingModel, setEmbeddingModel] = useState(data.models.embedding_model || ''); const [password, setPassword] = useState(''); const [web, setWeb] = useState(data.config.enable_web_search === 'true');
  const save = async (event: FormEvent) => { event.preventDefault(); if (await act('config.update', { public: { app_title: title, enable_web_search: String(web) }, models: { text_model: textModel, vision_model: visionModel, embedding_model: embeddingModel }, adminPassword: password || undefined })) setPassword(''); };
  return <section className="admin-section settings-form"><h2>系统设置</h2><form className="settings-fields" onSubmit={(e) => void save(e)}><label>网站标题<input value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>文本模型<input value={textModel} onChange={(e) => setTextModel(e.target.value)} /></label><label>视觉模型<input value={visionModel} onChange={(e) => setVisionModel(e.target.value)} /></label><label>Embedding 模型（留空使用全文搜索）<input value={embeddingModel} onChange={(e) => setEmbeddingModel(e.target.value)} /></label><label className="check-row"><input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />允许联网搜索</label><label>新管理员密码（至少10位）<input type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} /></label><div className="settings-actions"><button className="primary" disabled={busy}>{busy ? '保存中…' : '保存设置'}</button><button type="button" className="secondary" disabled={busy} onClick={() => void act('ai.test', {})}>测试 AI 连接</button></div></form><div className="runtime-card"><strong>当前服务端配置</strong><span>API Key：{data.runtime.apiConfigured ? '已配置' : '未配置'}</span><span>Base URL：<code>{data.runtime.baseUrl}</code></span><span>文本模型：<code>{data.runtime.textModel}</code></span></div><p className="field-note">Vercel 中的 AI_TEXT_MODEL / AI_VISION_MODEL 优先于数据库设置；API Key 只从 Vercel 环境变量读取。</p></section>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="dialog-card" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18} /></button></header>{children}</section></div>;
}

function DialogActions({ busy, onClose }: { busy: boolean; onClose: () => void }) {
  return <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button></div>;
}
