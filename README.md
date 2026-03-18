# claw-bot-cloudflare

A lightweight AI assistant built for Cloudflare Workers, inspired by nanobot-ts.

## Features

- **Multi-channel Support**: Telegram, Discord, Feishu, and direct API
- **Skill System**: Extensible plugin architecture with Markdown skills
- **Session Management**: Durable Objects for stateful conversations
- **Memory**: KV Store for short-term, D1 for long-term memory
- **LLM Providers**: Cloudflare AI, OpenAI, StepFun, and custom endpoints
- **Cron Tasks**: Built-in heartbeat and scheduled tasks
- **Gateway Mode**: Single worker handles all channels
- **Admin Panel**: Web-based administration interface
  - Dashboard with real-time statistics
  - Session management (view/delete)
  - Skill management (list/reload/remove)
  - Configuration viewer
- **Web Chat Interface**: Beautiful, responsive chat UI
  - Real-time conversation
  - Session persistence
  - Mobile-friendly design

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI
- Telegram bot token (optional)

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Cloudflare (first time)
npx wrangler kv:namespace create skills
npx wrangler d1 create claw-memory
# Copy the generated IDs to wrangler.toml

# Set secrets (admin panel)
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD

# Deploy
npm run deploy
```

### Environment Variables

```bash
# Required for LLM
OPENAI_API_KEY=sk-...          # StepFun or OpenAI API key

# Optional for channel adapters
TELEGRAM_BOT_TOKEN=123:ABC    # Telegram bot token
DISCORD_BOT_TOKEN=...         # Discord bot token

# Admin panel (set via wrangler secret)
ADMIN_USERNAME=admin          # Admin username
ADMIN_PASSWORD=secure123      # Admin password (strong!)
```

## Architecture

```
┌─────────────────┐
│   Channel       │ (Telegram, Discord, etc.)
│   Adapter       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Worker        │ Main entry point
│   (index.ts)    │
└────────┬────────┘
         │
         ├─────────────┐
         ▼             ▼
┌─────────────┐ ┌──────────────┐
│   Session   │ │   Skills     │
│   DO        │ │   Loader     │
└─────────────┘ └──────────────┘
         │
         ▼
┌─────────────────┐
│   LLM           │ Provider (Cloudflare AI,
│   Provider      │ StepFun, OpenAI)
└─────────────────┘
```

## Development

### Project Structure

```
claw-bot-cloudflare/
├── src/
│   ├── index.ts          # Worker entry (main router)
│   ├── types.ts          # TypeScript definitions
│   ├── agent/
│   │   └── handler.ts   # Request processing
│   ├── admin/            # Admin API & routes
│   │   ├── index.ts
│   │   ├── auth.ts       # HTTP Basic Auth
│   │   └── routes.ts     # Dashboard, sessions, skills, config
│   ├── channels/         # Channel adapters
│   │   ├── adapter.ts   # Factory
│   │   ├── telegram.ts  # Telegram Bot API
│   │   ├── discord.ts   # Discord interactions
│   │   └── cloudflare.ts # Direct API
│   ├── chat/
│   │   └── api.ts       # Chat web interface API
│   ├── memory/
│   │   ├── SessionDO.ts # Durable Object (session state)
│   │   └── memory.ts    # Memory API (KV + D1)
│   ├── providers/
│   │   └── cloudflare-ai.ts # LLM provider abstraction
│   └── skills/
│       ├── loader.ts    # Dynamic loading from KV
│       ├── echo.ts      # Example skill
│       └── calculator.ts
├── public/               # Static frontend files
│   ├── admin/
│   │   └── index.html   # Admin panel UI
│   └── chat/
│       └── index.html   # Web chat interface
├── tests/
├── examples/
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

### Adding a Skill

Skills are TypeScript modules with:
- `name`: unique identifier
- `description`: what it does
- `triggers`: array of keywords/commands
- `handler`: async function that returns a response

Example:

```typescript
export const mySkill = {
  name: 'my-skill',
  description: 'Does something useful',
  version: '1.0.0',
  triggers: ['/myskill', 'do thing'],
  handler: async (ctx) => {
    return `You said: ${ctx.message.text}`;
  },
};
```

## Configuration

### wrangler.toml

Key bindings:
- `KV_SKILLS`: Stores skill definitions
- `DB_MEMORY`: D1 database for long-term memory
- `SESSION_DO`: Durable Object for session state

Triggers:
- `crons`: Scheduled tasks (heartbeat, cleanup)

Environments:
- `dev`: Local development
- `production`: Live deployment

## Deployment

### First Deployment

```bash
# Login to Cloudflare
npx wrangler login

# Create KV namespace
npx wrangler kv:namespace create skills
# Copy the ID to wrangler.toml

# (Optional) Create D1 database
npx wrangler d1 create claw-memory

# Deploy
npm run deploy
```

### Set Secrets

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

## Monitoring

- **Logs**: `npx wrangler tail`
- **Analytics**: Cloudflare Dashboard → Workers & Pages
- **KV/D1**: Dashboard → Workers → Storage

## Admin Panel

Access the admin interface at: `https://your-worker.your-subdomain.workers.dev/admin`

**Features**:
- **Dashboard**: View statistics (sessions, messages, skills count)
- **Sessions**: List all active sessions, search by user/chat ID, delete sessions
- **Skills**: View loaded skills, reload skill cache, remove skills
- **Configuration**: View current configuration (sanitized, no secrets)

**Authentication**:
- HTTP Basic Auth
- Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` via `wrangler secret put`

**Example**:
```bash
npx wrangler secret put ADMIN_USERNAME
# Enter: admin

npx wrangler secret put ADMIN_PASSWORD
# Enter: your-strong-password
```

## Web Chat Interface

Access the chat UI at: `https://your-worker.your-subdomain.workers.dev/chat`

**Features**:
- Clean, modern chat interface
- Real-time messaging
- Session persistence (localStorage)
- Responsive design (mobile-friendly)
- Auto-scroll to latest messages

**How it works**:
1. Open `/chat` in browser
2. Type a message and press Enter
3. Messages are sent to `/chat/send` API
4. Responses stream back instantly
5. Session ID is saved in localStorage for continuity

**Customization**:
The UI is in `public/chat/index.html` - feel free to customize colors, branding, etc.

## Roadmap

- [x] Basic Worker with Telegram adapter
- [x] Session management via Durable Objects
- [x] Skill system with dynamic loading
- [x] Admin panel with dashboard
- [x] Web chat interface
- [ ] D1 long-term memory with semantic search
- [ ] Discord adapter (full implementation)
- [ ] Feishu adapter
- [ ] Subagent/Queue support for long tasks
- [ ] Multi-provider LLM routing (auto-fallback)
- [ ] Skills marketplace
- [ ] User management for admin panel
- [ ] API rate limiting
- [ ] Message queuing for high throughput

## License

MIT

## Credits

Inspired by [nanobot-ts](https://github.com/kobex95/nano-claw) and the OpenClaw ecosystem.
