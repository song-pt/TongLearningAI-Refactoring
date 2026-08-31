# TongAI — RefactoringBetaVersion1

> This project was originally prototyped with Google AI Studio. RefactoringBetaVersion1 keeps the multi-subject learning experience while rebuilding authentication, history, quota accounting and deployment boundaries for Supabase + Vercel.

TongAI 是一个多学科 AI 学习平台，支持文字解题、图片识别、追问、历史记录、密钥与额度管理以及管理后台。

## Beta V1 新功能

- 历史记录按“当前用户 + 学科”隔离。
- 首次问答与追问统一保存为 Conversation/Message。
- 历史题目描述查找：默认使用数据库文本相似度；配置 Embedding 模型后自动使用混合向量搜索。
- 搜索索引只使用题目、学科、等级和短摘要，不逐行读取完整回答。
- 滚动保留：每学科 50 个会话、每用户 200 个会话、每用户 20 张图片、全站 1000 张或 500MB（先达到者为准）。
- 图片在浏览器压缩至 500KB 内，再保存到私有 Supabase Storage。
- AI 请求、管理员操作、数据库访问和计费全部迁移到 Vercel 服务端函数。
- 服务端额度预留/结算，追问和图片均参与计费。
- `/api/v1` 兼容设计及 `/api/bootstrap` 引导配置，为 Android 客户端预留稳定接口。
- 低饱和、少渐变、统一小圆角的响应式界面，适配手机竖屏、平板和电脑横屏。
- 管理后台使用站内编辑框管理学科、等级和密钥，并对保存成功或失败给出明确反馈。
- 管理员可持续查看完整访问密钥；升级前已仅保存哈希的密钥可在“编辑”中设置新值。
- 系统设置显示当前生效的 AI Base URL/模型，并提供“测试 AI 连接”。

## 重要勘误

- `VITE_ADMIN_PASSWORD`、前端 AI Key 和 Supabase Service Role 都会泄漏到浏览器，Beta V1 已停止使用这些配置。
- Supabase anon key 不是数据库管理凭证。Beta V1 浏览器不再直接管理数据库。
- 旧版 `using(true)` 全开放 RLS 策略不具备隔离效果；新版 SQL 会删除这些策略。
- 管理后台中的 AI API Key 输入框已移除。AI Key 只能通过 Vercel 环境变量配置。

## 1. Supabase 数据库

1. 先备份现有数据库。
2. 在 Supabase SQL Editor 执行 `supabase_schema.sql`。
3. 脚本会迁移旧 `access_keys` 和 `chat_history`，并创建：
   - `conversations`
   - `messages`
   - `attachments`
   - `usage_ledger`
   - `public_config` / `private_config`
4. 脚本会启用 `pgcrypto`、`pg_trgm`、`vector`，并创建私有 `chat-images` bucket。
5. 旧表暂时保留用于核对；确认迁移后再单独归档，不要在第一次升级时直接删除。

## 2. Vercel 环境变量

复制 `.env.example` 中的键到 Vercel → Settings → Environment Variables：

| Key | 说明 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端使用的 Service Role Key |
| `AI_API_KEY` | OpenAI-compatible 服务商密钥 |
| `AI_BASE_URL` | 例如 `https://api.openrouter.ai/api/v1` |
| `SESSION_SECRET` | 至少 32 位随机字符串 |
| `ADMIN_PASSWORD` | 首次管理员登录密码；数据库密码设置成功后不再作为主密码使用 |
| `AI_TEXT_MODEL` | 可选文本模型默认值 |
| `AI_VISION_MODEL` | 可选视觉模型默认值 |
| `AI_EMBEDDING_MODEL` | 可选；留空时使用无额外模型费用的文本相似度搜索 |
| `PUBLIC_API_BASE_URL` | 未来 Android 引导配置返回的稳定 API 地址 |

不要配置任何包含管理员密码或 AI Key 的 `VITE_*` 变量。

`AI_BASE_URL` 可填写 API 根地址（如 `https://api.openrouter.ai/api/v1`），也可填写完整的 `/chat/completions` 地址；服务端会自动规范化。Vercel 中的 `AI_TEXT_MODEL` / `AI_VISION_MODEL` 优先于管理后台数据库值。

## 3. 本地运行

```bash
npm ci
cp .env.example .env.local
npx vercel dev
```

仅检查前端布局时可运行 `npm run dev:vite`，但 Vite 单独运行不会提供 `/api/*` 服务。

## 4. 检查与构建

```bash
npm run typecheck
npm run lint
npm run build
# 或一次运行
npm run check
```

## 5. 部署到 Vercel

1. 将此目录上传到 GitHub。
2. 在 Vercel 导入仓库。
3. Framework 选择 Vite，Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
4. 配置上述环境变量。
5. 部署后检查 `/api/config` 和 `/api/bootstrap`。

## 6. Android 兼容策略

Android 客户端应连接稳定的 Vercel API，而不是直接连接 Supabase。数据库更换时只需要修改服务端 Repository/环境配置，不需要重新发布 APK。如果 API 域名也需要迁移，客户端可从稳定地址读取 `/api/bootstrap`，验证后缓存新的 `apiBaseUrl`。

## 7. 免费额度建议

- Supabase 数据库采用问题摘要索引，不复制完整回答作为搜索文档。
- 原图不长期保存；压缩图最大 500KB。
- 每个学科最多 50 个会话，每个用户最多 200 个会话。
- 每用户最多 20 张图片，全站最多 1000 张或 500MB；新增时删除最旧记录。
- 未配置 Embedding 模型时不会产生历史语义向量调用费用。

## 8. 当前 Beta 注意事项

- 部署前必须执行新 SQL；旧数据库结构无法直接支持 Beta API。
- 免费 Supabase 项目长时间无访问可能暂停。
- 不同 AI 服务商的联网搜索工具格式可能不同，开启前应测试所选模型。
- 若 AI 请求失败，先在“管理后台 → 系统设置”查看当前服务端配置并点击“测试 AI 连接”；错误提示会包含上游 HTTP 状态和服务商返回信息。
- Beta 版本上线前应先在独立 Supabase 项目或备份副本完成迁移演练。
