/**
 * Main Worker Entry Point
 * 
 * This is the entry point for Cloudflare Workers. It handles:
 * - Routing incoming requests to appropriate channel adapters
 * - Managing sessions via Durable Objects
 * - Coordinating LLM providers and skills
 */

import { handleRequest } from './agent/handler';
import { getChannelAdapter } from './channels/adapter';
import { getSession } from './memory/session';
import { logger } from './utils/logger';

export interface Env {
  KV_SKILLS: KVNamespace;
  DB_MEMORY: D1Database;
  SESSION_DO: DurableObjectNamespace;
  OPENAI_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  DISCORD_BOT_TOKEN?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      logger.info({ request, env }, 'Incoming request');
      
      // Get channel adapter based on request
      const adapter = await getChannelAdapter(request, env);
      if (!adapter) {
        return new Response('Unsupported channel', { status: 400 });
      }
      
      // Verify request authenticity
      const verified = await adapter.verify(request);
      if (!verified) {
        logger.warn('Request verification failed');
        return new Response('Unauthorized', { status: 401 });
      }
      
      // Parse message
      const incoming = await adapter.parse(request);
      logger.info({ incoming }, 'Parsed message');
      
      // Get or create session
      const sessionId = `${incoming.chatId}:${incoming.userId}`;
      const sessionDO = env.SESSION_DO.get(sessionId);
      const session = await getSession(sessionDO, env);
      
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
        type: MessageType.TEXT,
        content: response,
        metadata: {},
        timestamp: Date.now(),
        channel: adapter.type,
        userId: incoming.userId,
        chatId: incoming.chatId,
      });
      
      // Save session (with TTL)
      await sessionDO.storage.put('session', session);
      ctx.waitUntil(
        sessionDO.storage.delete('session', { expirationTtl: 60 * 60 * 24 * 7 }) // 7 days
      );
      
      // Send response via adapter
      const outgoing = await adapter.send(incoming.chatId, {
        text: response,
      });
      
      return outgoing;
      
    } catch (error) {
      logger.error({ error }, 'Request failed');
      return new Response('Internal server error', { status: 500 });
    }
  },
};
