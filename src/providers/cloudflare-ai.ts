/**
 * Cloudflare AI Provider Implementation
 * Uses Cloudflare's built-in AI models
 */

import { LLMProvider, ChatMessage, LLMOptions } from '../types';

export class CloudflareAIProvider implements LLMProvider {
  name = 'cloudflare-ai';
  
  async chat(
    messages: ChatMessage[], 
    options: LLMOptions = {}
  ): Promise<string> {
    const { 
      temperature = 0.7, 
      maxTokens = 1000, 
      model = '@cf/meta/llama-3.1-8b-instruct' 
    } = options;
    
    // Use Cloudflare AI binding (if available)
    // For now, call the AI directly via fetch
    // In production, use @cloudflare/ai library
    
    const response = await fetch(
      'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/' + model,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Cloudflare AI error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.result.response;
  }
  
  async *stream(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const { 
      temperature = 0.7, 
      maxTokens = 1000, 
      model = '@cf/meta/llama-3.1-8b-instruct' 
    } = options;
    
    const response = await fetch(
      'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/' + model,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Cloudflare AI error: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }
    
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      // Parse SSE format (data: {...})
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            yield parsed.response;
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

function getAuthToken(): string {
  // In Workers, you'd use the AI binding instead
  // This is a placeholder
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN not set');
  }
  return token;
}
