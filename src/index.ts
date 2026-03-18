/**
 * Main Worker Entry Point
 * 
 * This is the entry point for Cloudflare Workers. It handles:
 * - Routing incoming requests to appropriate channel adapters
 * - Managing sessions via Durable Objects (or memory fallback)
 * - Coordinating LLM providers and skills
 */

import { handleRequest } from './agent/handler';
import { getChannelAdapter } from './channels/adapter';
import { getSession } from './memory/SessionDO';
import { getSessionMemory, saveSessionMemory } from './memory/MemorySession';
import { handleAdminRequest } from './admin/index';
import { handleChatRequest } from './chat/api';
import { getSessionD1, saveSessionD1, listSessionsD1, countAllSessionsD1, countAllMessagesD1, initD1Schema } from './memory/D1Session';

export { SessionDO };

export interface Env {
  KV_SKILLS: KVNamespace;
  DB_MEMORY: D1Database;
  SESSION_DO?: DurableObjectNamespace;  // Optional - fallback to memory if undefined
  OPENAI_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  DISCORD_BOT_TOKEN?: string;
  FEISHU_APP_ID?: string;
  FEISHU_APP_SECRET?: string;
  FEISHU_ENCRYPT_KEY?: string;
  // New providers
  IFLLOW_API_KEY?: string;
  MODELSCOPE_API_KEY?: string;
  LLM_PROVIDER?: 'cloudflare' | 'iflow' | 'modelscope' | 'openai-compatible';
  LLM_MODEL?: string;
  LLM_BASE_URL?: string;
}

// Initialize D1 schema on first invocation (lazy init)
let d1Initialized = false;
async function ensureD1Initialized(env: Env): Promise<void> {
  if (!d1Initialized && env.DB_MEMORY) {
    try {
      await initD1Schema(env);
      d1Initialized = true;
    } catch (error) {
      console.warn('[Worker] D1 initialization skipped:', error);
    }
  }
}

// Helper: Get session with DO, D1, or memory fallback
async function getSessionWithFallback(sessionId: string, env: Env): Promise<any> {
  // Try Durable Object first
  if (env.SESSION_DO) {
    const sessionDO = env.SESSION_DO.get(sessionId);
    return await getSession(sessionDO, env);
  }
  
  // Try D1 database
  if (env.DB_MEMORY) {
    try {
      const session = await getSessionD1(sessionId, env);
      if (session) {
        return session;
      }
    } catch (error) {
      console.warn('[Session] D1 not available, falling back to memory:', error);
    }
  }
  
  // Fallback to memory
  return await getSessionMemory(sessionId, env);
}

// Helper: Save session with DO, D1, or memory fallback
async function saveSessionWithFallback(sessionId: string, session: any, env: Env): Promise<void> {
  // Save to Durable Object if available
  if (env.SESSION_DO) {
    try {
      const sessionDO = env.SESSION_DO.get(sessionId);
      const res = await sessionDO.fetch(new Request('http://session/session', {
        method: 'POST',
        body: JSON.stringify(session),
        headers: { 'Content-Type': 'application/json' }
      }));
      if (res.ok) {
        return;
      } else {
        console.warn('[Session] DO save failed, trying fallback:', await res.text());
      }
    } catch (error) {
      console.warn('[Session] DO error, falling back:', error);
    }
  }
  
  // Save to D1 if available
  if (env.DB_MEMORY) {
    try {
      await saveSessionD1(sessionId, session, env);
      return;
    } catch (error) {
      console.warn('[Session] D1 save failed, falling back to memory:', error);
    }
  }
  
  // Fallback to memory
  await saveSessionMemory(sessionId, session);
}

// Helper: List all sessions (for admin)
export async function listAllSessions(env: Env, limit: number = 100): Promise<any[]> {
  if (env.DB_MEMORY) {
    try {
      return await listSessionsD1(env, limit);
    } catch (error) {
      console.warn('[Admin] D1 list failed:', error);
    }
  }
  
  if (env.SESSION_DO) {
    try {
      const sessionList = await env.SESSION_DO.list();
      const sessions = await Promise.all(
        sessionList.map(async (id) => {
          try {
            const sessionDO = env.SESSION_DO.get(id);
            const res = await sessionDO.fetch(new Request('http://session/session'));
            if (res.ok) {
              const session = await res.json();
              return {
                id: session.id,
                userId: session.userId,
                chatId: session.chatId,
                messageCount: session.messages?.length || 0,
                updatedAt: session.updatedAt,
              };
            }
          } catch (e) {
            // Ignore individual session errors
          }
          return null;
        })
      );
      return sessions.filter(Boolean);
    } catch (error) {
      console.warn('[Admin] DO list failed:', error);
    }
  }
  
  return [];
}

// Helper: Count sessions (for admin stats)
export async function countAllSessions(env: Env): Promise<number> {
  if (env.DB_MEMORY) {
    try {
      return await countAllSessionsD1(env);
    } catch (error) {
      console.warn('[Admin] D1 count sessions failed:', error);
    }
  }
  
  if (env.SESSION_DO) {
    try {
      const sessionList = await env.SESSION_DO.list();
      return sessionList.length;
    } catch (error) {
      console.warn('[Admin] DO count failed:', error);
    }
  }
  
  return 0;
}

// Helper: Count messages (for admin stats)
export async function countAllMessages(env: Env): Promise<number> {
  if (env.DB_MEMORY) {
    try {
      return await countAllMessagesD1(env);
    } catch (error) {
      console.warn('[Admin] D1 count messages failed:', error);
    }
  }
  
  // For DO, we'd need to iterate and sum (expensive)
  // For now, return 0 if not using D1
  return 0;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Initialize D1 schema on first request
      await ensureD1Initialized(env);
      
      // Handle favicon.ico (return empty to avoid 404 errors)
      if (path === '/favicon.ico') {
        return new Response('', { status: 204 });
      }
      
      // Route: Admin Panel
      if (path.startsWith('/admin')) {
        return handleAdminRequest(request, env);
      }
      
      // Route: Chat Web UI
      if (path.startsWith('/chat')) {
        return handleChatRequest(request, env, ctx);
      }
      
      // Route: Feishu webhook
      if (path.startsWith('/feishu')) {
        const adapter = new (await import('./channels/feishu')).FeishuAdapter(env);
        const verified = await adapter.verify(request);
        if (!verified) {
          return new Response('Invalid signature', { status: 401 });
        }
        const incoming = await adapter.parse(request);
        if (!incoming) {
          return new Response('Bad request', { status: 400 });
        }
        // Get or create session
        const sessionId = `${incoming.chatId}:${incoming.userId}`;
        const session = await getSessionWithFallback(sessionId, env);
        
        // Add incoming message
        session.messages.push({
          id: incoming.userId + Date.now(),
          direction: 'in',
          type: incoming.type,
          content: incoming.text,
          metadata: {},
          timestamp: Date.now(),
          channel: 'feishu',
          userId: incoming.userId,
          chatId: incoming.chatId,
        });
        const MAX_MESSAGES = 50;
        if (session.messages.length > MAX_MESSAGES) {
          session.messages = session.messages.slice(-MAX_MESSAGES);
        }
        
        // Process
        const response = await handleRequest(incoming, session, env, ctx);
        
        // Add outgoing
        session.messages.push({
          id: 'out-' + Date.now(),
          direction: 'out',
          type: 'text',
          content: response,
          metadata: {},
          timestamp: Date.now(),
          channel: 'feishu',
          userId: incoming.userId,
          chatId: incoming.chatId,
        });
        
        // Save session
        await saveSessionWithFallback(sessionId, session, env);
        
        // Send
        const sendAdapter = adapter as any;
        return await sendAdapter.send(incoming.chatId, { text: response });
      }
      
      // Route: Bot API (Telegram, Discord, etc.)
      const adapter = await getChannelAdapter(request, env);
      if (adapter) {
        // Verify request authenticity
        const verified = await adapter.verify(request);
        if (!verified) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        // Parse message
        const incoming = await adapter.parse(request);
        
        // Get or create session
        const sessionId = `${incoming.chatId}:${incoming.userId}`;
        const session = await getSessionWithFallback(sessionId, env);
        
        // Update session with incoming message
        session.messages.push({
          id: incoming.userId + Date.now(),
          direction: 'in',
          type: incoming.type,
          content: incoming.text,
          metadata: {},
          timestamp: Date.now(),
          channel: adapter.type,
          userId: incoming.userId,
          chatId: incoming.chatId,
        });
        
        // Trim messages if exceeding limit
        const MAX_MESSAGES = 50;
        if (session.messages.length > MAX_MESSAGES) {
          session.messages = session.messages.slice(-MAX_MESSAGES);
        }
        
        // Handle message with agent
        const response = await handleRequest(incoming, session, env, ctx);
        
        // Store outgoing message
        session.messages.push({
          id: 'out-' + Date.now(),
          direction: 'out',
          type: 'text',
          content: response,
          metadata: {},
          timestamp: Date.now(),
          channel: adapter.type,
          userId: incoming.userId,
          chatId: incoming.chatId,
        });
        
        // Save session (with TTL)
        await saveSessionWithFallback(sessionId, session, env);
        
        // Send response via adapter
        const outgoing = await adapter.send(incoming.chatId, {
          text: response,
        });
        
        return outgoing;
      }
      
      // Default: serve chat UI directly (root path and any unmatched path)
      return handleChatRequest(request, env, ctx);
      
    } catch (error) {
      console.error('Request failed:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
