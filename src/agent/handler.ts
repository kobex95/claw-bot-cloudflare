/**
 * Agent Request Handler
 * Core logic for processing messages and generating responses
 */

import { IncomingMessage, Session, Env, Skill, SkillContext } from '../types';
import { loadSkills } from '../skills/loader';
import { Memory } from '../memory/memory';
import { 
  OpenAICompatibleProvider, 
  createModelScopeProvider, 
  createIFlowProvider 
} from '../providers/openai-compatible';

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
  // Determine provider based on env vars
  const providerType = env.LLM_PROVIDER || 'cloudflare';
  const model = env.LLM_MODEL;

  try {
    switch (providerType) {
      case 'iflow':
        return await callIFlow(messages, env, model);
      case 'modelscope':
        return await callModelScope(messages, env, model);
      case 'openai-compatible':
        return await callOpenAICompatible(messages, env, model);
      case 'cloudflare':
      default:
        return await callCloudflareAI(messages, env);
    }
  } catch (error) {
    console.error(`LLM provider ${providerType} failed:`, error);
    return `I'm sorry, I'm having trouble connecting to the AI service right now. Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function callCloudflareAI(
  messages: Array<{ role: string; content: string }>,
  env: Env
): Promise<string> {
  // Use Cloudflare Workers AI binding if available
  // This is a placeholder - in actual Cloudflare Workers, use @cloudflare/ai
  throw new Error('Cloudflare AI provider not implemented in this custom build. Use iflow or modelscope instead.');
}

async function callIFlow(
  messages: Array<{ role: string; content: string }>,
  env: Env,
  model?: string
): Promise<string> {
  const apiKey = env.IFLLOW_API_KEY;
  if (!apiKey) {
    throw new Error('IFLLOW_API_KEY not set');
  }

  const provider = createIFlowProvider(apiKey, model || 'gpt-4');
  return await provider.chat(messages, { model });
}

async function callModelScope(
  messages: Array<{ role: string; content: string }>,
  env: Env,
  model?: string
): Promise<string> {
  const apiKey = env.MODELSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('MODELSCOPE_API_KEY not set');
  }

  const provider = createModelScopeProvider(apiKey, model || 'qwen-turbo');
  return await provider.chat(messages, { model });
}

async function callOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  env: Env,
  model?: string
): Promise<string> {
  const apiKey = env.OPENAI_API_KEY;
  const baseURL = env.LLM_BASE_URL;
  
  if (!apiKey || !baseURL) {
    throw new Error('OPENAI_API_KEY and LLM_BASE_URL must be set for openai-compatible provider');
  }

  const provider = new OpenAICompatibleProvider('custom', {
    baseURL,
    apiKey,
    model: model || 'gpt-3.5-turbo',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  });
  
  return await provider.chat(messages, { model });
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
