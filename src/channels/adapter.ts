/**
 * Channel Adapter Factory
 * Returns the appropriate adapter for the incoming request
 */

import { ChannelAdapter, ChannelType, Env } from '../types';
import { TelegramAdapter } from './telegram';
import { DiscordAdapter } from './discord';
import { CloudflareAdapter } from './cloudflare';
import { FeishuAdapter } from './feishu';

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
  
  // Feishu webhook
  if (headers.has('X-Lark-Signature') ||
      headers.has('X-Lark-Request-Timestamp') ||
      url.pathname.startsWith('/feishu')) {
    return new FeishuAdapter(env);
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
