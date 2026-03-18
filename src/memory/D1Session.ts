/**
 * D1 Session Storage
 * Persists sessions to D1 database for durability and admin visibility
 */

import { Session } from '../types';

// Initialize table schema (call once on startup)
export async function initD1Schema(env: any): Promise<void> {
  try {
    await env.DB_MEMORY.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        channel TEXT,
        user_id TEXT,
        chat_id TEXT,
        messages TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        metadata TEXT
      )
    `);
    console.log('[D1Session] Schema initialized');
  } catch (error) {
    console.error('[D1Session] Schema init failed:', error);
  }
}

// Table structure:
// sessions: id (TEXT PK), channel (TEXT), user_id (TEXT), chat_id (TEXT),
//          messages (JSON TEXT), created_at (INTEGER), updated_at (INTEGER), metadata (JSON TEXT)

export async function getSessionD1(sessionId: string, env: any): Promise<Session | null> {
  try {
    const result = await env.DB_MEMORY.prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).bind(sessionId).first();
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      channel: result.channel,
      userId: result.user_id,
      chatId: result.chat_id,
      messages: JSON.parse(result.messages),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      metadata: result.metadata ? JSON.parse(result.metadata) : {},
    };
  } catch (error) {
    console.error('[D1Session] Error fetching session:', error);
    return null;
  }
}

export async function saveSessionD1(sessionId: string, session: Session, env: any): Promise<void> {
  try {
    // Ensure timestamps
    const now = Date.now();
    session.updatedAt = now;
    if (!session.createdAt) {
      session.createdAt = now;
    }
    
    // Upsert session
    await env.DB_MEMORY.prepare(`
      INSERT OR REPLACE INTO sessions (id, channel, user_id, chat_id, messages, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      session.id,
      session.channel || 'web',
      session.userId,
      session.chatId,
      JSON.stringify(session.messages),
      session.createdAt,
      session.updatedAt,
      JSON.stringify(session.metadata || {})
    ).run();
  } catch (error) {
    console.error('[D1Session] Error saving session:', error);
    throw error;
  }
}

export async function deleteSessionD1(sessionId: string, env: any): Promise<void> {
  try {
    await env.DB_MEMORY.prepare(
      'DELETE FROM sessions WHERE id = ?'
    ).bind(sessionId).run();
  } catch (error) {
    console.error('[D1Session] Error deleting session:', error);
    throw error;
  }
}

export async function listSessionsD1(env: any, limit: number = 100): Promise<{ id: string; userId: string; chatId: string; messageCount: number; updatedAt: number }[]> {
  try {
    const result = await env.DB_MEMORY.prepare(`
      SELECT id, user_id, chat_id, updated_at, messages
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT ?
    `).bind(limit).all();
    
    return result.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      chatId: row.chat_id,
      messageCount: JSON.parse(row.messages).length,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('[D1Session] Error listing sessions:', error);
    return [];
  }
}

export async function countAllSessionsD1(env: any): Promise<number> {
  try {
    const result = await env.DB_MEMORY.prepare(
      'SELECT COUNT(*) as count FROM sessions'
    ).first();
    
    return result?.count || 0;
  } catch (error) {
    console.error('[D1Session] Error counting sessions:', error);
    return 0;
  }
}

export async function countAllMessagesD1(env: any): Promise<number> {
  try {
    // Sum the length of all messages arrays
    const result = await env.DB_MEMORY.prepare(
      'SELECT messages FROM sessions'
    ).all();
    
    let total = 0;
    for (const row of result) {
      const messages = JSON.parse(row.messages);
      total += messages.length;
    }
    
    return total;
  } catch (error) {
    console.error('[D1Session] Error counting messages:', error);
    return 0;
  }
}
