/**
 * In-Memory Session Storage (fallback when DO is not available)
 */

import { Session } from '../types';

class MemorySession {
  data: Map<string, Session>;
  
  constructor() {
    this.data = new Map();
  }
  
  async get(sessionId: string): Promise<Session | null> {
    const session = this.data.get(sessionId);
    if (!session) return null;
    
    // Check TTL (7 days)
    if (Date.now() - session.updatedAt > 7 * 24 * 60 * 60 * 1000) {
      this.data.delete(sessionId);
      return null;
    }
    
    return session;
  }
  
  async put(sessionId: string, session: Session): Promise<void> {
    session.updatedAt = Date.now();
    this.data.set(sessionId, session);
  }
  
  async delete(sessionId: string): Promise<void> {
    this.data.delete(sessionId);
  }
}

// Global singleton
const memorySession = new MemorySession();

export async function getSessionMemory(sessionId: string, env?: any): Promise<Session> {
  let session = await memorySession.get(sessionId);
  
  if (!session) {
    session = {
      id: sessionId,
      channel: 'web',
      userId: sessionId.split(':')[1] || 'unknown',
      chatId: sessionId.split(':')[0] || sessionId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {},
    };
  }
  
  return session;
}

export async function saveSessionMemory(sessionId: string, session: Session): Promise<void> {
  await memorySession.put(sessionId, session);
}
