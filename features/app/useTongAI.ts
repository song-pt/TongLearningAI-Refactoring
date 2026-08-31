import { useEffect, useRef, useState } from 'react';
import { api, streamChat } from '../../services/client';
import type { AppConfig, Conversation, Language, Message, Role } from '../../types';

export function useTongAI() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role>();
  const [config, setConfig] = useState<AppConfig>();
  const [startupError, setStartupError] = useState('');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('tongai_language') as Language) || 'zh-cn');
  const [subject, setSubject] = useState('math');
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [mobileView, setMobileView] = useState<'chat' | 'history'>('chat');
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    void Promise.all([api.session(), api.config()])
      .then(([session, appConfig]) => {
        setConfig(appConfig);
        setRole(session.session?.role);
        const firstSubject = appConfig.subjects[0];
        if (firstSubject) setSubject(firstSubject.code);
        document.title = appConfig.config.app_title || 'TongAI';
      })
      .catch((error: unknown) => setStartupError(error instanceof Error ? error.message : '配置加载失败'))
      .finally(() => setReady(true));
  }, []);

  const changeLanguage = (value: Language) => { setLanguage(value); localStorage.setItem('tongai_language', value); };
  const logout = async () => { await api.logout(); setRole(undefined); setConversationId(undefined); setMessages([]); };
  const newChat = () => { abortRef.current?.abort(); setConversationId(undefined); setMessages([]); setBusy(false); setMobileView('chat'); };
  const changeSubject = (code: string) => { setSubject(code); newChat(); };
  const openConversation = async (item: Conversation) => {
    const detail = await api.conversation(item.id);
    setSubject(detail.conversation.subject_code);
    setConversationId(detail.conversation.id);
    setMessages(detail.messages);
    setMobileView('chat');
  };
  const send = async ({ text, level, image, search }: { text: string; level: string; image?: string; search: boolean }) => {
    if (busy) return;
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((old) => [...old, { id: userId, role: 'user', content: text }, { id: assistantId, role: 'assistant', content: '' }]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat({ question: text, subjectCode: subject, levelCode: level || undefined, conversationId, imageData: image, useSearch: search }, {
        signal: controller.signal,
        onDelta: (content) => setMessages((old) => old.map((message) => message.id === assistantId ? { ...message, content: message.content + content } : message)),
        onMeta: (meta) => { if (meta.conversationId) setConversationId(meta.conversationId); setHistoryRefresh((value) => value + 1); },
      });
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError' ? '已停止生成。' : error instanceof Error ? error.message : '生成失败';
      setMessages((old) => old.map((item) => item.id === assistantId ? { ...item, content: item.content || message } : item));
    } finally {
      setBusy(false);
      abortRef.current = undefined;
    }
  };

  return {
    ready, role, setRole, config, startupError, language, changeLanguage, subject, changeSubject,
    conversationId, messages, busy, historyRefresh, mobileView, setMobileView,
    logout, newChat, openConversation, send, stop: () => abortRef.current?.abort(),
  };
}
