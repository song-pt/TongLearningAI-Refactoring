import type { Language } from './types';

const zh = {
  login: '登录', accessKey: '访问密钥', admin: '管理员', adminPassword: '管理员密码', switchAdmin: '管理员登录', switchUser: '返回用户登录',
  history: '历史记录', chat: '对话', newChat: '新对话', searchHistory: '描述你要找的题目', searchHint: '例如：一道初中数列题目', search: '查找', allSubjects: '全部学科', noHistory: '这个学科还没有历史记录',
  ask: '输入你的问题', send: '发送', stop: '停止', upload: '添加图片', webSearch: '联网', level: '不限等级', logout: '退出',
  welcome: '从一个具体问题开始', welcomeSub: '选择学科和等级，答案会保存在对应学科的历史中。', loading: '正在生成回答…', loadMore: '加载更多', delete: '删除',
};
const en = { ...zh, login: 'Sign in', accessKey: 'Access key', admin: 'Admin', adminPassword: 'Admin password', switchAdmin: 'Admin sign in', switchUser: 'User sign in', history: 'History', chat: 'Chat', newChat: 'New chat', searchHistory: 'Describe the problem you want to find', searchHint: 'e.g. a middle-school sequence problem', search: 'Search', allSubjects: 'All subjects', noHistory: 'No history for this subject', ask: 'Ask a question', send: 'Send', stop: 'Stop', upload: 'Add image', webSearch: 'Web', level: 'Any level', logout: 'Sign out', welcome: 'Start with a specific question', welcomeSub: 'Choose a subject and level. The answer will be saved to that subject.', loading: 'Generating…', loadMore: 'Load more', delete: 'Delete' };
const tw = { ...zh, history: '歷史記錄', chat: '對話', newChat: '新對話', searchHistory: '描述你要找的題目', noHistory: '這個學科還沒有歷史記錄', ask: '輸入你的問題', send: '傳送', stop: '停止', upload: '新增圖片', webSearch: '聯網', level: '不限等級', logout: '登出', welcome: '從一個具體問題開始', welcomeSub: '選擇學科和等級，答案會保存在對應學科的歷史中。', loading: '正在產生回答…', loadMore: '載入更多', delete: '刪除' };
export const copy = { 'zh-cn': zh, 'zh-tw': tw, en } satisfies Record<Language, typeof zh>;
