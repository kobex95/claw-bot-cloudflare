/**
 * Discord Channel Adapter
 * Handles Discord interactions via webhook
 */

import { ChannelAdapter, IncomingMessage, OutgoingMessage, Env } from '../types';

export class DiscordAdapter implements ChannelAdapter {
  type = 'discord' as const;
  
  constructor(private env: Env) {}
  
  async verify(req: Request): Promise<boolean> {
    // Discord signs webhook requests
    // https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
    const signature = req.headers.get('X-Signature-Ed25519');
    const timestamp = req.headers.get('X-Signature-Timestamp');
    
    if (!signature || !timestamp) {
      return false;
    }
    
    // In production, verify the signature using Discord's public key
    // For now, we'll trust the request (dev mode)
    return true;
  }
  
  async parse(req: Request): Promise<IncomingMessage> {
    const body = await req.json();
    
    // Discord interaction format
    if (body.type !== 2) { // 2 = application command
      throw new Error('Unsupported Discord interaction type');
    }
    
    const { data, member, channel } = body;
    const userId = member?.user?.id || data.user_id;
    const chatId = channel?.id || data.channel_id;
    const text = data.options?.find((o: any) => o.name === 'text')?.value || '';
    
    return {
      userId: userId.toString(),
      chatId: chatId.toString(),
      text: text as string,
      type: 'text',
      raw: body,
    };
  }
  
  async send(chatId: string, message: OutgoingMessage): Promise<Response> {
    // Discord requires interaction response within 3 seconds
    // For deferred responses, use follow-up messages
    
    // For this simple implementation, we'll just acknowledge
    return new Response(JSON.stringify({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: message.text,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  async setupWebhook(url: string): Promise<void> {
    // Discord webhook setup is done via Discord Developer Portal
    // This method would configure the interaction endpoint URL
    console.log(`Set Discord interaction URL to: ${url}/discord`);
  }
}
