import { BookOpen, History as HistoryIcon, LogOut, MessageSquarePlus, PanelLeftClose, Settings } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import MathRenderer from './components/MathRenderer';
import Composer from './features/chat/Composer';
import HistoryPanel from './features/history/HistoryPanel';
import AdminPanel from './features/admin/AdminPanel';
import { useTongAI } from './features/app/useTongAI';
import type { Language } from './types';
import { copy } from './i18n';

export default function App() {
  const app = useTongAI();
  const { ready, role, setRole, config, startupError, language, changeLanguage, subject, changeSubject, conversationId, messages, busy, historyRefresh, mobileView, setMobileView, selectedBlock, setSelectedBlock, logout, newChat, openConversation, send, stop } = app;
  const t = copy[language];
  const lastAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;

  if (!ready) return <div className="boot-screen">TongAI</div>;
  if (!role) return <LoginScreen language={language} onLanguage={changeLanguage} onLogin={setRole} startupError={startupError} />;
  if (role === 'admin') return <AdminPanel onExit={() => void logout()} onLogout={() => void logout()} />;
  if (!config) return <div className="boot-screen">配置加载失败</div>;

  return <div className="app-shell">
    <header className="app-header"><div className="app-brand"><span><BookOpen size={18} /></span><strong>{config.config.app_title || 'TongAI'}</strong></div><div className="header-actions"><select aria-label="语言" value={language} onChange={(e) => changeLanguage(e.target.value as Language)}><option value="zh-cn">简中</option><option value="zh-tw">繁中</option><option value="en">EN</option></select><button className="icon-text admin-shortcut" onClick={() => alert('请退出后使用管理员入口登录。')}><Settings size={16} />设置</button><button className="icon-text" onClick={() => void logout()}><LogOut size={16} />{t.logout}</button></div></header>
    <nav className="subject-nav" aria-label="学科">{config.subjects.map((item) => <button key={item.code} className={subject === item.code ? 'active' : ''} onClick={() => changeSubject(item.code)}>{item.label}</button>)}</nav>
    <div className="mobile-switch"><button className={mobileView === 'chat' ? 'active' : ''} onClick={() => setMobileView('chat')}><PanelLeftClose size={16} />{t.chat}</button><button className={mobileView === 'history' ? 'active' : ''} onClick={() => setMobileView('history')}><HistoryIcon size={16} />{t.history}</button></div>
    <main className="workspace">
      <div className={mobileView === 'history' ? 'history-column mobile-visible' : 'history-column'}><HistoryPanel subject={subject} subjects={config.subjects} language={language} refreshKey={historyRefresh} onOpen={(item) => void openConversation(item).catch((error: unknown) => alert(error instanceof Error ? error.message : '无法打开会话'))} /></div>
      <section className={mobileView === 'chat' ? 'chat-column mobile-visible' : 'chat-column'}>
        <div className="chat-toolbar"><div><span className="eyebrow">{config.subjects.find((item) => item.code === subject)?.label}</span><h1>{conversationId ? messages.find((m) => m.role === 'user')?.content.slice(0, 48) || t.chat : t.newChat}</h1></div><button className="secondary" onClick={newChat}><MessageSquarePlus size={16} />{t.newChat}</button></div>
        <div className="messages" aria-live="polite">{!messages.length ? <div className="welcome"><BookOpen size={30} /><h2>{t.welcome}</h2><p>{t.welcomeSub}</p></div> : messages.map((message) => <article className={`message ${message.role}`} key={message.id}><div className="message-label">{message.role === 'user' ? '你' : 'TongAI'}</div>{message.role === 'assistant' ? (message.content ? <MathRenderer content={message.content} selectable={!busy && message.id === lastAssistantId} selectedId={selectedBlock?.id} onSelect={(block) => setSelectedBlock(selectedBlock?.id === block.id ? undefined : block)} /> : <p className="generating">{t.loading}</p>) : <>{message.metadata?.focusBlock && <div className="message-focus">追问片段 · {message.metadata.focusBlock.label}</div>}<p>{message.content}</p></>}</article>)}</div>
        <Composer language={language} levels={config.levels} busy={busy} searchAllowed={config.config.enable_web_search === 'true'} isFollowUp={!!conversationId} focusBlock={selectedBlock} onClearFocus={() => setSelectedBlock(undefined)} onSend={(value) => void send(value)} onStop={stop} />
      </section>
    </main>
  </div>;
}
