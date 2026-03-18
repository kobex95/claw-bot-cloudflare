# claw-bot-cloudflare

一个基于 Cloudflare Workers 构建的轻量级 AI 助手，灵感来自 nanobot-ts。

## ✨ 功能特性

- **多平台支持**：Telegram、Discord、飞书、以及直接 API 访问
- **技能系统**：可扩展的插件架构，使用 Markdown 编写技能
- **会话管理**：使用 Durable Objects 实现有状态的对话
- **记忆存储**：KV 存储短期记忆，D1 数据库长期记忆
- **多 LLM 提供商**：支持 Cloudflare AI、OpenAI、StepFun 及自定义端点
- **定时任务**：内置心跳检测和定时任务系统
- **网关模式**：单个 Worker 处理所有渠道消息
- **管理后台**：Web 可视化管理系统
  - 📊 实时数据统计面板
  - 📱 会话管理（查看/删除）
  - 🔧 技能管理（列表/重载/移除）
  - ⚙️ 配置查看器
- **Web 聊天界面**：美观、响应式的聊天 UI
  - 💬 实时对话
  - 💾 会话持久化
  - 📱 移动端友好

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Cloudflare 账号
- Wrangler CLI
- Telegram bot token（可选）

### 安装配置

```bash
# 1. 克隆项目
git clone https://github.com/kobex95/claw-bot-cloudflare.git
cd claw-bot-cloudflare

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 配置 Cloudflare 资源
npx wrangler kv:namespace create skills
npx wrangler d1 create claw-memory
# 复制生成的 ID 到 wrangler.toml

# 5. 设置密钥（管理后台用）
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put OPENAI_API_KEY

# 6. 部署
npm run deploy
```

### 环境变量配置

在 `wrangler.toml` 中配置：

```toml
[vars]
# LLM 提供商配置
LLM_PROVIDER = "openai-compatible"  # 可选: cloudflare, iflow, modelscope, openai-compatible
LLM_MODEL = "qwen3-coder-plus"       # 模型名称
LLM_BASE_URL = "https://apis.iflow.cn/v1"  # API 地址（仅 openai-compatible 需要）
OPENAI_API_KEY = "sk-..."            # API Key

# 管理后台账号
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "your_secure_password"
```

也可通过 `npx wrangler secret put` 设置敏感信息：

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ADMIN_PASSWORD
```

## 🌐 访问地址

部署成功后，可通过以下地址访问：

- **聊天主页**: `https://your-worker.your-subdomain.workers.dev/`
- **管理后台**: `https://your-worker.your-subdomain.workers.dev/admin`
  - 默认账号: `admin`
  - 默认密码: 你在 wrangler secret 中设置的 `ADMIN_PASSWORD`

## 📊 管理后台功能

### 数据概览
- 总会话数
- 活跃会话（24小时内）
- 总消息数
- 已加载技能数

### 会话管理
- 查看所有会话列表
- 查看会话详情（消息记录）
- 删除单个或全部会话

### 技能管理
- 查看已加载技能
- 重新加载技能
- 移除技能

### 配置查看
- 查看当前环境变量（敏感信息已掩码）
- 检查绑定资源状态

## 🔧 开发说明

### 项目结构

```
src/
├── admin/           # 管理后台
│   ├── index.ts    # UI + 路由
│   ├── routes.ts   # API 处理
│   └── auth.ts     # 认证中间件
├── agent/          # AI 代理核心
│   ├── handler.ts  # 请求处理
│   ├── context.ts  # 技能上下文
│   └── skills/     # 技能定义
├── channels/       # 渠道适配器
│   ├── adapter.ts  # 适配器接口
│   ├── feishu.ts   # 飞书适配器
│   ├── telegram.ts # Telegram 适配器
│   └── discord.ts  # Discord 适配器
├── memory/         # 存储层
│   ├── SessionDO.ts    # Durable Object 会话
│   ├── MemorySession.ts # 内存回退
│   └── D1Session.ts    # D1 持久化
├── providers/      # LLM 提供商
│   ├── openai-compatible.ts
│   ├── iflow.ts
│   └── modelscope.ts
├── chat/           # Web 聊天界面
│   └── api.ts      # 聊天 API + UI
├── types.ts        # TypeScript 类型定义
└── index.ts        # Worker 入口
```

### 添加新技能

创建 `src/agent/skills/your-skill.ts`：

```typescript
import { SkillContext } from '../context';

export const skill = {
  name: 'your-skill',
  description: '技能描述',
  version: '1.0.0',
  triggers: ['/yourcommand', '关键词'],
  
  handler: async (ctx: SkillContext): Promise<string> => {
    // 你的逻辑
    return '响应内容';
  }
};
```

### 自定义 LLM 提供商

在 `src/providers/` 添加新文件，实现 `LLMProvider` 接口。

## 🐛 故障排除

### 管理后台无法登录

- 检查 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 是否已设置
- 使用 `npx wrangler secret list` 查看已设置的密钥
- 确保浏览器已清除缓存和登录状态

### 聊天无响应

- 检查 LLM 配置（`LLM_PROVIDER`、`LLM_BASE_URL`、`OPENAI_API_KEY`）
- 查看 Cloudflare Workers 日志：`npx wrangler tail`
- 确认 API Key 有效且有额度

### D1 数据库错误

- 确保已在 wrangler.toml 中配置 `DB_MEMORY` binding
- 表结构会在首次写入时自动创建

### 会话不持久

- 当前使用 D1 持久化（之前是内存存储）
- Worker 重启不会丢失数据
- 如需清理，在管理后台"会话管理"中删除

## 📝 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Made with ❤️ by Claw Team**
