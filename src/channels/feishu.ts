/**
 * Feishu (Lark) Channel Adapter
 * Handles incoming webhook events and outgoing messages
 */

import { ChannelAdapter, Env, IncomingMessage } from '../types';
import { verifyFeishuSignature } from './feishu-verification';
import { parseFeishuEvent } from './feishu-parser';

export class FeishuAdapter implements ChannelAdapter {
  type = 'feishu' as const;
  
  constructor(private env: Env) {}
  
  /**
   * Verify Feishu webhook signature
   */
  async verify(req: Request): Promise<boolean> {
    try {
      const signature = req.headers.get('X-Lark-Signature');
      const timestamp = req.headers.get('X-Lark-Request-Timestamp');
      const body = await req.clone().text();
      
      if (!signature || !timestamp) {
        return false;
      }
      
      const encryptKey = this.env.FEISHU_ENCRYPT_KEY;
      if (!encryptKey) {
        console.warn('FEISHU_ENCRYPT_KEY not set, skipping verification');
        return true; // Allow in dev mode
      }
      
      return verifyFeishuSignature(
        body,
        signature,
        timestamp,
        encryptKey
      );
    } catch (error) {
      console.error('Feishu verification error:', error);
      return false;
    }
  }
  
  /**
   * Parse incoming Feishu event into standard message format
   */
  async parse(req: Request): Promise<IncomingMessage | null> {
    try {
      const body = await req.clone().json();
      const event = parseFeishuEvent(body);
      
      if (!event) {
        return null;
      }
      
      // Build standard incoming message
      const message: IncomingMessage = {
        userId: event.userId,
        chatId: event.chatId,
        text: event.text,
        type: 'text',
        raw: event.raw,
      };
      
      return message;
    } catch (error) {
      console.error('Feishu parse error:', error);
      return null;
    }
  }
  
  /**
   * Send message to Feishu chat
   */
  async send(chatId: string, message: any): Promise<Response> {
    try {
      const accessToken = await this.getAccessToken();
      
      // Build message content based on type
      const content = this.buildMessageContent(message);
      
      // Send to Feishu API
      const response = await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receive_id: chatId,
            content: JSON.stringify(content),
            msg_type: content.msg_type,
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Feishu API error: ${error}`);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Feishu send error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  /**
   * Setup webhook (not needed for Cloudflare, URL is configured in Feishu admin)
   */
  async setupWebhook(url: string): Promise<void> {
    // Feishu webhook is configured in the Feishu admin console
    // This method is a no-op but kept for interface compatibility
    console.log(`Feishu webhook should be set to: ${url}/feishu/webhook`);
  }
  
  /**
   * Get Feishu tenant access token
   */
  private async getAccessToken(): Promise<string> {
    const appId = this.env.FEISHU_APP_ID;
    const appSecret = this.env.FEISHU_APP_SECRET;
    
    if (!appId || !appSecret) {
      throw new Error('FEISHU_APP_ID and FEISHU_APP_SECRET are required');
    }
    
    // Try to get cached token first
    const cacheKey = `feishu_token:${appId}`;
    const cached = await this.env.KV_SKILLS.get(cacheKey, 'json');
    if (cached && cached.access_token && cached.expires_at > Date.now()) {
      return cached.access_token;
    }
    
    // Request new token
    const response = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to get Feishu access token');
    }
    
    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`Feishu token error: ${data.msg}`);
    }
    
    const tokenData = {
      access_token: data.tenant_access_token,
      expires_at: Date.now() + (data.expire - 60) * 1000, // Buffer 60s
    };
    
    // Cache token
    await this.env.KV_SKILLS.put(
      cacheKey,
      JSON.stringify(tokenData),
      { expirationTtl: 60 * 60 } // 1 hour cache
    );
    
    return tokenData.access_token;
  }
  
  /**
   * Build Feishu message content from standard format
   */
  private buildMessageContent(message: any): any {
    const msgType = message.msg_type || 'text';
    
    switch (msgType) {
      case 'text':
        return {
          msg_type: 'text',
          content: {
            text: message.content,
          },
        };
        
      case 'image':
        return {
          msg_type: 'image',
          content: {
            image_key: message.image_key,
          },
        };
        
      case 'file':
        return {
          msg_type: 'file',
          content: {
            file_key: message.file_key,
          },
        };
        
      case 'interactive':
        return {
          msg_type: 'interactive',
          content: {
            // Feishu card JSON
            ...message.content,
          },
        };
        
      default:
        return {
          msg_type: 'text',
          content: {
            text: String(message.content),
          },
        };
    }
  }
}

// Helper functions for Feishu integration

/**
 * Verify Feishu webhook signature (HMAC-SHA256)
 */
export function verifyFeishuSignature(
  body: string,
  signature: string,
  timestamp: string,
  encryptKey: string
): boolean {
  const crypto = require('crypto');
  const stringToSign = `${timestamp}\n${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', encryptKey)
    .update(stringToSign, 'utf8')
    .digest('base64');
  
  return signature === expectedSignature;
}

/**
 * Parse Feishu event into standardized format
 */
export function parseFeishuEvent(body: any): any | null {
  // Feishu v3 event format
  const event = body.event;
  
  if (!event) {
    return null;
  }
  
  // Handle different event types
  const eventType = event.type;
  
  if (eventType === 'message') {
    // Message event
    const message = event.message;
    const messageType = message.message_type;
    
    // Extract text content
    let text = '';
    if (messageType === 'text') {
      text = message.content?.text || '';
    } else if (messageType === 'post') {
      // Rich text post - extract plain text
      text = extractTextFromPost(message.content);
    } else if (messageType === 'image') {
      text = '[Image]';
    } else if (messageType === 'file') {
      text = '[File]';
    }
    
    return {
      userId: event.sender?.sender_id?.open_id || event.sender_id,
      chatId: event.message?.chat_id || event.chat_id,
      text,
      messageId: event.message?.message_id,
      raw: event,
    };
  }
  
  // Handle other event types (card action, etc.)
  return null;
}

/**
 * Extract plain text from Feishu post (rich text) content
 */
function extractTextFromPost(content: any): string {
  if (!content || !content.content) {
    return '';
  }
  
  const texts: string[] = [];
  for (const element of content.content) {
    if (element.type === 'text') {
      texts.push(element.text?.content || '');
    } else if (element.type === 'paragraph') {
      texts.push(extractTextFromPost({ content: element.content }));
    }
  }
  
  return texts.join('\n');
}
