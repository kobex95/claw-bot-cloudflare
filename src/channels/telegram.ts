/**
 * Telegram Channel Adapter
 * Handles Telegram Bot API webhooks
 */

import { ChannelAdapter, IncomingMessage, OutgoingMessage, Env } from '../types';

export class TelegramAdapter implements ChannelAdapter {
  type = 'telegram' as const;
  
  constructor(private env: Env) {}
  
  async verify(req: Request): Promise<boolean> {
    // Telegram doesn't sign webhooks, but we can validate the token
    // In production, you'd validate the IP ranges from Telegram
    // https://core.telegram.org/bots/webhooks#validating-webhook-requests
    
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const expectedToken = this.env.TELEGRAM_BOT_TOKEN;
    
    if (!expectedToken) {
      console.warn('TELEGRAM_BOT_TOKEN not set');
      return false;
    }
    
    return token === expectedToken;
  }
  
  async parse(req: Request): Promise<IncomingMessage> {
    const body = await req.json();
    
    // Telegram webhook format
    // https://core.telegram.org/bots/api#update
    const message = body.message || body.edited_message;
    
    if (!message || !message.text) {
      throw new Error('Invalid Telegram message');
    }
    
    return {
      userId: message.from.id.toString(),
      chatId: message.chat.id.toString(),
      text: message.text,
      type: 'text',
      raw: body,
    };
  }
  
  async send(chatId: string, message: OutgoingMessage): Promise<Response> {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }
    
    const response = await fetch(
      `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.text,
          parse_mode: 'Markdown',
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }
    
    // Return empty response to Workers (Telegram already sent)
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  async setupWebhook(url: string): Promise<void> {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }
    
    const webhookUrl = `${url}/telegram?token=${this.env.TELEGRAM_BOT_TOKEN}`;
    
    const response = await fetch(
      `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to set Telegram webhook: ${error}`);
    }
    
    console.log(`Telegram webhook set to: ${webhookUrl}`);
  }
}
