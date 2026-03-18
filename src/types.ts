/**
 * Core types for Cloudflare AI Assistant
 */

// Message direction
export enum MessageDirection {
  IN = 'in',
  OUT = 'out',
}

// Message types
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  COMMAND = 'command',
}

// Unified message format
export interface Message {
  id: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: number;
  channel: string;
  userId: string;
  chatId: string;
}

// Channel types
export enum ChannelType {
  TELEGRAM = 'telegram',
  DISCORD = 'discord',
  FEISHU = 'feishu',
  CLOUDFLARE = 'cloudflare',
}

// Channel-specific message
export interface IncomingMessage {
  userId: string;
  chatId: string;
  text: string;
  type: MessageType;
  raw: unknown; // Original payload
}

export interface OutgoingMessage {
  text: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
}

// Session state
export interface Session {
  id: string;
  channel: ChannelType;
  userId: string;
  chatId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

// Skill definition
export interface Skill {
  name: string;
  description: string;
  version: string;
  triggers: string[];
  handler: (ctx: SkillContext) => Promise<string>;
}

export interface SkillContext {
  message: IncomingMessage;
  session: Session;
  memory: MemoryAPI;
  respond: (text: string) => Promise<void>;
}

// Memory API
export interface MemoryAPI {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  search(query: string, limit?: number): Promise<MemoryResult[]>;
}

export interface MemoryResult {
  key: string;
  value: string;
  score: number;
}

// LLM Provider
export interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  stream?(messages: ChatMessage[], options?: LLMOptions): ReadableStream<string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
}

// Channel Adapter
export interface ChannelAdapter {
  type: ChannelType;
  
  // Verify incoming request
  verify(req: Request): Promise<boolean>;
  
  // Parse request to unified message
  parse(req: Request): Promise<IncomingMessage>;
  
  // Send message to channel
  send(chatId: string, message: OutgoingMessage): Promise<Response>;
  
  // Setup webhook (if needed)
  setupWebhook(url: string): Promise<void>;
}

// Agent configuration
export interface AgentConfig {
  defaultProvider: string;
  maxSessionMessages: number;
  autoCapture: boolean;
  autoRecall: boolean;
  skillsPath: string;
}

// Worker environment bindings
export interface EnvBindings {
  KV_SKILLS: KVNamespace;
  DB_MEMORY: D1Database;
  SESSION_DO: DurableObjectNamespace;
  OPENAI_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  DISCORD_BOT_TOKEN?: string;
  [key: string]: any;
}
