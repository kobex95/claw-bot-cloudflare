/**
 * Durable Object for Session Management
 * 
 * Stores and manages conversation sessions with TTL
 */

import { Session } from '../types';

export class SessionDO {
  state: DurableObjectState;
  
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = this.state.id.toString();
    
    try {
      switch (url.pathname) {
        case '/':
        case '/session':
          return this.handleSession(request);
        case '/memory':
          return this.handleMemory(request);
        case '/heartbeat':
          return this.handleHeartbeat();
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  private async handleSession(request: Request): Promise<Response> {
    const method = request.method;
    
    if (method === 'GET') {
      // Get current session
      const session = await this.state.storage.get<Session>('session');
      return new Response(JSON.stringify(session || null), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (method === 'POST' || method === 'PUT') {
      // Update session
      const body = await request.json();
      const session: Session = body;
      
      // Validate
      if (!session.id || !session.chatId || !session.userId) {
        return new Response('Invalid session data', { status: 400 });
      }
      
      // Store with TTL (7 days)
      await this.state.storage.put('session', session);
      this.state.storage.delete('session', { expirationTtl: 60 * 60 * 24 * 7 });
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (method === 'DELETE') {
      // Clear session
      await this.state.storage.delete('session');
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
  
  private async handleMemory(request: Request): Promise<Response> {
    const method = request.method;
    
    if (method === 'GET') {
      // Get memory keys
      const keys = await this.state.storage.list();
      const memory: Record<string, unknown> = {};
      
      for (const key of keys) {
        if (key !== 'session') {
          memory[key] = await this.state.storage.get(key);
        }
      }
      
      return new Response(JSON.stringify(memory), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (method === 'POST' || method === 'PUT') {
      const body = await request.json();
      const { key, value, ttl } = body;
      
      if (!key || value === undefined) {
        return new Response('Missing key or value', { status: 400 });
      }
      
      await this.state.storage.put(key, value);
      if (ttl) {
        this.state.storage.delete(key, { expirationTtl: ttl });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (method === 'DELETE') {
      const { key } = await request.json();
      if (key) {
        await this.state.storage.delete(key);
      } else {
        // Clear all memory except session
        const keys = await this.state.storage.list();
        for (const key of keys) {
          if (key !== 'session') {
            await this.state.storage.delete(key);
          }
        }
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
  
  private async handleHeartbeat(): Promise<Response> {
    // Update heartbeat timestamp
    const session = await this.state.storage.get<Session>('session');
    if (session) {
      session.updatedAt = Date.now();
      await this.state.storage.put('session', session);
    }
    
    return new Response(JSON.stringify({
      timestamp: Date.now(),
      sessionId: this.state.id.toString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Helper function to get or create session
export async function getSession(sessionDO: DurableObject, env: any): Promise<Session> {
  const res = await sessionDO.fetch(new Request('http://session/session'));
  if (res.ok) {
    const session = await res.json();
    if (session && session.id) {
      return session;
    }
  }
  
  // Create new session
  const newSession: Session = {
    id: sessionDO.id.toString(),
    channel: 'web',
    userId: 'unknown',
    chatId: sessionDO.id.toString(),
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {},
  };
  
  return newSession;
}
