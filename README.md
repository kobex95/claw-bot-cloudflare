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

# Copy environment configuration
cp .env.example .env
# Edit .env with your tokens

# Develop locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...          # For LLM (StepFun/OpenAI)
TELEGRAM_BOT_TOKEN=123:ABC    # For Telegram channel

# Optional
DISCORD_BOT_TOKEN=...         # For Discord channel
KV_NAMESPACE_ID=...           # Auto-created on first deploy
D1_DATABASE_ID=...            # Optional long-term memory
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
src/
├── index.ts          # Worker entry
├── types.ts          # TypeScript definitions
├── agent/
│   └── handler.ts   # Request processing
├── channels/
│   ├── adapter.ts   # Factory
│   ├── telegram.ts  # Telegram adapter
│   ├── discord.ts   # Discord adapter
│   └── cloudflare.ts # Direct API
├── memory/
│   ├── SessionDO.ts # Durable Object
│   └── memory.ts    # Memory API
├── providers/
│   └── cloudflare-ai.ts
├── skills/
│   ├── loader.ts    # Dynamic loading
│   ├── echo.ts      # Example skill
│   └── calculator.ts
└── utils/
    └── logger.ts
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

## Roadmap

- [x] Basic Worker with Telegram adapter
- [x] Session management via Durable Objects
- [x] Skill system with dynamic loading
- [ ] D1 long-term memory with semantic search
- [ ] Discord adapter (full implementation)
- [ ] Feishu adapter
- [ ] Subagent/Queue support
- [ ] Multi-provider LLM routing
- [ ] Skills marketplace

## License

MIT

## Credits

Inspired by [nanobot-ts](https://github.com/kobex95/nano-claw) and the OpenClaw ecosystem.
