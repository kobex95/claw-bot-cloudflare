/**
 * Cloudflare AI Chat Adapter
 * Direct chat interface (for testing or Cloudflare AI integration)
 */

import { ChannelAdapter, IncomingMessage, OutgoingMessage } from '../types';

export class CloudflareAdapter implements ChannelAdapter {
  type = 'cloudflare' as const;
  
  constructor(private env: Env) {}
  
  async verify(req: Request): Promise<boolean> {
    // For direct chat, accept all requests (use other auth in production)
    // Could check for API key header
    const auth = req.headers.get('Authorization');
    // If you set an API key, validate it here
    return true;
  }
  
  async parse(req: Request): Promise<IncomingMessage> {
    const body = await req.json();
    
    // Simple chat format
    const { message, userId = 'cloudflare', chatId = 'default' } = body;
    
    if (!message || typeof message !== 'string') {
      throw new Error('Missing or invalid message');
    }
    
    return {
      userId,
      chatId,
      text: message,
      type: 'text',
      raw: body,
    };
  }
  
  async send(chatId: string, message: OutgoingMessage): Promise<Response> {
    return new Response(JSON.stringify({
      reply: message.text,
      chatId,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  async setupWebhook(url: string): Promise<void> {
    // No webhook needed for direct API
    console.log(`Cloudflare adapter ready at: ${url}/chat`);
  }
}
