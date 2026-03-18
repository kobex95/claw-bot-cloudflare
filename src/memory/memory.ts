/**
 * Memory API implementation using Durable Objects and KV
 */

import { EnvBindings, MemoryAPI, MemoryResult } from '../types';

export class Memory implements MemoryAPI {
  private env: EnvBindings;
  private sessionDO?: DurableObject;
  
  constructor(env: EnvBindings, sessionDO?: DurableObject) {
    this.env = env;
    this.sessionDO = sessionDO;
  }
  
  async get(key: string): Promise<string | null> {
    // Try session memory first (fast)
    if (this.sessionDO) {
      const value = await this.sessionDO.storage.get<string>(`mem:${key}`);
      if (value !== undefined) {
        return value;
      }
    }
    
    // Fall back to KV for cross-session memory
    try {
      const value = await this.env.KV_SKILLS.get(`memory:${key}`);
      return value;
    } catch {
      return null;
    }
  }
  
  async set(key: string, value: string, ttl?: number): Promise<void> {
    // Store in session memory
    if (this.sessionDO) {
      await this.sessionDO.storage.put(`mem:${key}`, value);
      if (ttl) {
        this.sessionDO.storage.delete(`mem:${key}`, { expirationTtl: ttl });
      }
    }
    
    // Also store in KV for persistence (optional, based on importance)
    // For now, we skip KV to reduce costs - only session memory used
  }
  
  async delete(key: string): Promise<void> {
    if (this.sessionDO) {
      await this.sessionDO.storage.delete(`mem:${key}`);
    }
  }
  
  async search(query: string, limit: number = 5): Promise<MemoryResult[]> {
    // Simple keyword search in session memory
    const results: MemoryResult[] = [];
    
    if (this.sessionDO) {
      const keys = await this.sessionDO.storage.list();
      for (const key of keys) {
        if (key.startsWith('mem:')) {
          const value = await this.sessionDO.storage.get<string>(key);
          if (value) {
            const score = this.calculateScore(query, value);
            if (score > 0) {
              results.push({
                key: key.slice(4), // remove 'mem:' prefix
                value,
                score,
              });
            }
          }
        }
      }
    }
    
    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  
  private calculateScore(query: string, value: string): number {
    // Simple BM25-like scoring
    const queryLower = query.toLowerCase();
    const valueLower = value.toLowerCase();
    
    if (valueLower.includes(queryLower)) {
      // Exact match bonus
      return valueLower === queryLower ? 1.0 : 0.8;
    }
    
    // Word-level matching
    const queryWords = queryLower.split(/\s+/);
    const valueWords = valueLower.split(/\s+/);
    
    let matchCount = 0;
    for (const qw of queryWords) {
      if (valueWords.includes(qw)) {
        matchCount++;
      }
    }
    
    if (matchCount > 0) {
      return matchCount / queryWords.length * 0.5;
    }
    
    return 0;
  }
}
