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

// Helper: Get session with DO or memory fallback
async function getSessionWithFallback(sessionId: string, env: Env): Promise<any> {
  if (env.SESSION_DO) {
    // Use Durable Object
    const sessionDO = env.SESSION_DO.get(sessionId);
    return await getSession(sessionDO, env);
  } else {
    // Use memory fallback
    return await getSessionMemory(sessionId, env);
  }
}

// Helper: Save session with DO or memory fallback
async function saveSessionWithFallback(sessionId: string, session: any, env: Env): Promise<void> {
  if (env.SESSION_DO) {
    // Use Durable Object
    const sessionDO = env.SESSION_DO.get(sessionId);
    // We need to call the DO's fetch to save
    const res = await sessionDO.fetch(new Request('http://session/session', {
      method: 'POST',
      body: JSON.stringify(session),
      headers: { 'Content-Type': 'application/json' }
    }));
    if (!res.ok) {
      throw new Error(`Failed to save session: ${await res.text()}`);
    }
  } else {
    // Use memory fallback
    await saveSessionMemory(sessionId, session);
  }
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
      
      // Default: redirect to chat UI
      return Response.redirect('/chat', 302);
      
    } catch (error) {
      console.error('Request failed:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
