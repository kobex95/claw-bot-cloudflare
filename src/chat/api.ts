/**
 * Chat API Handler
 * Handles /chat/* endpoints for the web chat interface
 */

import { Env, IncomingMessage, Session, Memory } from '../types';
import { getSession } from '../memory/session';
import { handleRequest } from '../agent/handler';

export async function handleChatRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/chat/, '');
  
  if (path === '' || path === '/') {
    // Serve chat UI
    return await fetchChatUI();
  }
  
  if (path === '/send' && request.method === 'POST') {
    // Handle chat message
    return await handleChatMessage(request, env, ctx);
  }
  
  if (path === '/session' && request.method === 'GET') {
    // Get session info
    const { sessionId } = url.searchParams;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const sessionDO = env.SESSION_DO.get(sessionId);
    const sessionRes = await sessionDO.fetch(new Request('http://session/session'));
    return sessionRes;
  }
  
  return new Response('Not found', { status: 404 });
}

async function fetchChatUI(): Promise<Response> {
  // In production with Sites, this would serve from public/chat/
  // For now, we'll serve the HTML directly
  const html = `
<!DOCTYPE html>
<html>
<head><title>Claw Bot Chat</title></head>
<body>
  <h1>Chat UI would be served here</h1>
  <p>Configure Sites binding in wrangler.toml to serve static files.</p>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleChatMessage(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const { message, sessionId } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Build incoming message
    const incoming: IncomingMessage = {
      userId: 'web-user',
      chatId: sessionId || 'web',
      text: message,
      type: 'text',
      raw: {},
    };
    
    // Get or create session
    const sessionDO = env.SESSION_DO.get(sessionId || `web-${Date.now()}`);
    let session = await getSession(sessionDO, env);
    
    // Add incoming message to session
    session.messages.push({
      id: `msg-${Date.now()}`,
      direction: 'in',
      type: 'text',
      content: message,
      metadata: {},
      timestamp: Date.now(),
      channel: 'web',
      userId: incoming.userId,
      chatId: incoming.chatId,
    });
    
    // Trim if needed
    const MAX_MESSAGES = 50;
    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }
    
    // Process with agent
    const response = await handleRequest(incoming, session, env, ctx);
    
    // Add outgoing message
    session.messages.push({
      id: `out-${Date.now()}`,
      direction: 'out',
      type: 'text',
      content: response,
      metadata: {},
      timestamp: Date.now(),
      channel: 'web',
      userId: incoming.userId,
      chatId: incoming.chatId,
    });
    
    // Save session
    await sessionDO.storage.put('session', session);
    ctx.waitUntil(
      sessionDO.storage.delete('session', { expirationTtl: 60 * 60 * 24 * 7 })
    );
    
    return new Response(JSON.stringify({
      reply: response,
      sessionId: session.id,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
