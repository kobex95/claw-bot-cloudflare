/**
 * Channel Adapter Factory
 * Returns the appropriate adapter for the incoming request
 */

import { ChannelAdapter, ChannelType, Env } from '../types';
import { TelegramAdapter } from './telegram';
import { DiscordAdapter } from './discord';
import { CloudflareAdapter } from './cloudflare';

export async function getChannelAdapter(
  request: Request,
  env: Env
): Promise<ChannelAdapter | null> {
  const url = new URL(request.url);
  const headers = request.headers;
  
  // Detect channel from headers or URL path
  
  // Telegram webhook
  if (headers.has('X-Telegram-Bot-Api-Secret-Token') ||
      url.pathname.startsWith('/telegram')) {
    return new TelegramAdapter(env);
  }
  
  // Discord interaction
  if (headers.has('X-Signature-Ed25519') && 
      headers.has('X-Signature-Timestamp')) {
    return new DiscordAdapter(env);
  }
  
  // Cloudflare AI Chat (direct)
  if (url.pathname.startsWith('/chat') ||
      headers.has('CF-Connecting-IP')) {
    return new CloudflareAdapter(env);
  }
  
  // Check custom header
  const channel = headers.get('X-Channel-Type');
  if (channel === 'telegram') {
    return new TelegramAdapter(env);
  }
  if (channel === 'discord') {
    return new DiscordAdapter(env);
  }
  if (channel === 'feishu') {
    return new FeishuAdapter(env);
  }
  
  return null;
}

// Placeholder for Feishu adapter (to be implemented)
class FeishuAdapter implements ChannelAdapter {
  type = 'feishu' as ChannelType;
  
  constructor(private env: Env) {}
  
  async verify(req: Request): Promise<boolean> {
    // TODO: Implement Feishu webhook verification
    return true;
  }
  
  async parse(req: Request): Promise<any> {
    throw new Error('Feishu adapter not implemented yet');
  }
  
  async send(chatId: string, message: any): Promise<Response> {
    throw new Error('Feishu adapter not implemented yet');
  }
  
  async setupWebhook(url: string): Promise<void> {
    throw new Error('Feishu adapter not implemented yet');
  }
}
