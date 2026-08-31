import { useState, type FormEvent } from 'react';
import { BookOpen, Shield } from 'lucide-react';
import { api, getDeviceId } from '../services/client';
import type { Language, Role } from '../types';
import { copy } from '../i18n';

export default function LoginScreen({ language, onLanguage, onLogin, startupError = '' }: { language: Language; onLanguage: (value: Language) => void; onLogin: (role: Role) => void; startupError?: string }) {
  const [adminMode, setAdminMode] = useState(false); const [credential, setCredential] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const t = copy[language];
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!credential.trim()) return; setLoading(true); setError(''); try { const result = await api.login(adminMode ? 'admin' : 'user', credential, getDeviceId()); onLogin(result.role); } catch (e) { setError(e instanceof Error ? e.message : '登录失败'); } finally { setLoading(false); } };
  return <main className="login-page">
    <div className="login-top"><select aria-label="Language" value={language} onChange={(e) => onLanguage(e.target.value as Language)}><option value="zh-cn">简体中文</option><option value="zh-tw">繁體中文</option><option value="en">English</option></select></div>
    <section className="login-card">
      <div className="brand-mark">{adminMode ? <Shield size={22} /> : <BookOpen size={22} />}</div>
      <h1>TongAI</h1><p>{adminMode ? t.admin : t.accessKey}</p>
      <form onSubmit={submit}><label>{adminMode ? t.adminPassword : t.accessKey}</label><input type={adminMode ? 'password' : 'text'} autoComplete={adminMode ? 'current-password' : 'off'} value={credential} onChange={(e) => setCredential(e.target.value)} /><button className="primary" disabled={loading}>{loading ? '…' : t.login}</button></form>
      {(error || startupError) && <p className="form-error" role="alert">{error || startupError}</p>}
      <button className="text-button" onClick={() => { setAdminMode(!adminMode); setCredential(''); setError(''); }}>{adminMode ? t.switchUser : t.switchAdmin}</button>
    </section>
  </main>;
}
