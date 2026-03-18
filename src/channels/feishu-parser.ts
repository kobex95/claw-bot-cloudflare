/**
 * Feishu event parser
 * Converts Feishu webhook payload to standardized IncomingMessage format
 */

import { IncomingMessage } from '../types';

/**
 * Parse Feishu event into standardized format
 */
export function parseFeishuEvent(body: any): Partial<IncomingMessage> | null {
  // Handle Feishu v3 event format
  const event = body.event || body;
  
  if (!event) {
    return null;
  }
  
  // Check event type
  const eventType = event.type || event.event_type;
  
  if (eventType === 'message' || eventType === 'im.message.received_v1') {
    return parseMessageEvent(event);
  }
  
  // Could add card action, user mention, etc.
  return null;
}

/**
 * Parse message event from Feishu
 */
function parseMessageEvent(event: any): Partial<IncomingMessage> {
  const message = event.message || event;
  const messageType = message.message_type || 'text';
  
  // Extract sender ID
  let userId = '';
  if (event.sender) {
    userId = event.sender.sender_id?.open_id || event.sender_id || '';
  } else if (message.sender) {
    userId = message.sender.sender_id?.open_id || message.sender_id || '';
  }
  
  // Extract chat ID
  const chatId = message.chat_id || event.chat_id || '';
  
  // Extract text content based on message type
  let text = '';
  switch (messageType) {
    case 'text':
      text = message.content?.text || '';
      break;
      
    case 'post':
      // Rich text post - extract all text content
      text = extractTextFromPost(message.content);
      break;
      
    case 'image':
      text = '[Image]';
      break;
      
    case 'file':
      text = '[File]';
      break;
      
    case 'audio':
      text = '[Audio]';
      break;
      
    case 'video':
      text = '[Video]';
      break;
      
    case 'share_chat':
      text = '[Shared Chat]';
      break;
      
    case 'share_user':
      text = '[Shared User]';
      break;
      
    default:
      text = `[${messageType}]`;
  }
  
  return {
    userId,
    chatId,
    text,
    type: 'text',
    raw: event,
  };
}

/**
 * Extract plain text from Feishu post (rich text) content
 * Feishu post structure: { content: [{ type: 'text', text: { content: '...' } }, ...] }
 */
function extractTextFromPost(content: any): string {
  if (!content || !content.content) {
    return '';
  }
  
  const texts: string[] = [];
  
  function traverse(elements: any[]) {
    for (const element of elements) {
      if (element.type === 'text') {
        const textContent = element.text?.content || element.content || '';
        if (textContent) {
          texts.push(textContent);
        }
      } else if (element.type === 'paragraph' && element.content) {
        traverse(element.content);
      } else if (element.type === 'rich_text' && element.content) {
        traverse(element.content);
      } else if (element.type === 'at') {
        // Mention - could extract user info
        texts.push('@');
      } else if (element.type === 'link') {
        // Link - extract URL or text
        const linkText = element.rich_text?.[0]?.text?.content || element.url || '';
        texts.push(linkText);
      } else if (element.type === 'image') {
        texts.push('[Image]');
      } else if (element.type === 'md') {
        // Markdown content
        texts.push(element.md?.content || '');
      }
    }
  }
  
  traverse(content.content);
  
  return texts.join('\n').trim();
}
