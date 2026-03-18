/**
 * Agent Request Handler
 * Core logic for processing messages and generating responses
 */

import { IncomingMessage, Session, Env, Skill, SkillContext } from '../types';
import { loadSkills } from '../skills/loader';
import { Memory } from '../memory/memory';

export async function handleRequest(
  message: IncomingMessage,
  session: Session,
  env: Env,
  ctx: ExecutionContext
): Promise<string> {
  // Initialize memory
  const memory = new Memory(env);
  
  // Load skills
  const skills = await loadSkills(env);
  
  // Build conversation context
  const conversation = buildConversation(session, message);
  
  // Check skill triggers
  for (const skill of skills) {
    if (matchesTrigger(message.text, skill.triggers)) {
      try {
        const skillCtx: SkillContext = {
          message,
          session,
          memory,
          respond: async (text: string) => {
            // Respond function is handled by the outer scope
          },
        };
        
        const response = await skill.handler(skillCtx);
        if (response) {
          return response;
        }
      } catch (error) {
        console.error(`Skill ${skill.name} failed:`, error);
      }
    }
  }
  
  // Default: use LLM
  return await generateResponse(conversation, env, ctx);
}

function buildConversation(
  session: Session, 
  incoming: IncomingMessage
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  
  // System prompt
  messages.push({
    role: 'system',
    content: `You are a helpful AI assistant running on Cloudflare Workers.
Be concise, friendly, and helpful.
Current time: ${new Date().toISOString()}`,
  });
  
  // Recent conversation history (up to 10 messages)
  const recentMessages = session.messages.slice(-10);
  for (const msg of recentMessages) {
    if (msg.direction === 'in') {
      messages.push({ role: 'user', content: msg.content });
    } else {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }
  
  // Current message
  messages.push({ role: 'user', content: incoming.text });
  
  return messages;
}

async function generateResponse(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  env: Env,
  ctx: ExecutionContext
): Promise<string> {
  // Try Cloudflare AI first
  try {
    const response = await callCloudflareAI(messages, env);
    return response;
  } catch (error) {
    console.error('Cloudflare AI failed:', error);
    
    // Fallback: simple echo
    return `I'm sorry, I'm having trouble connecting to the AI service right now.`;
  }
}

async function callCloudflareAI(
  messages: Array<{ role: string; content: string }>,
  env: Env
): Promise<string> {
  // For this demo, we'll use a simple fetch to OpenAI-compatible API
  // In production, use the @cloudflare/ai library
  
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('No LLM API key configured');
  }
  
  // Use StepFun API (already configured in OpenClaw)
  const response = await fetch('https://chatapi.stepfun.com/chatapi/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'step-3.5-flash',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

function matchesTrigger(text: string, triggers: string[]): boolean {
  const lowerText = text.toLowerCase();
  return triggers.some(trigger => {
    if (trigger.startsWith('/')) {
      // Command trigger
      return lowerText.startsWith(trigger.toLowerCase());
    } else {
      // Keyword trigger
      return lowerText.includes(trigger.toLowerCase());
    }
  });
}
