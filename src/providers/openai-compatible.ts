/**
 * OpenAI-Compatible Provider
 * Supports multiple platforms with OpenAI-compatible API:
 * - ModelScope (dashscope)
 * - iFlow (iflow.cn)
 * - Any other OpenAI-compatible endpoint
 */

import { LLMProvider, ChatMessage, LLMOptions } from '../types';

export interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export class OpenAICompatibleProvider implements LLMProvider {
  name: string;
  config: OpenAICompatibleConfig;

  constructor(name: string, config: OpenAICompatibleConfig) {
    this.name = name;
    this.config = config;
  }

  async chat(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): Promise<string> {
    const {
      temperature = this.config.defaultTemperature ?? 0.7,
      maxTokens = this.config.defaultMaxTokens ?? 1000,
      model = this.config.model,
    } = options;

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} error: ${response.status} ${response.statusText}\n${error}`);
    }

    const data = await response.json();
    
    // Safely extract content
    if (!data.choices || !data.choices[0] || !data.choices[0].message || data.choices[0].message.content === undefined) {
      throw new Error(`Invalid response format: ${JSON.stringify(data)}`);
    }
    
    return data.choices[0].message.content;
  }

  async *stream(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const {
      temperature = this.config.defaultTemperature ?? 0.7,
      maxTokens = this.config.defaultMaxTokens ?? 1000,
      model = this.config.model,
    } = options;

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} error: ${response.status} ${response.statusText}\n${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

// Factory functions for common providers
export function createModelScopeProvider(apiKey: string, model: string = 'qwen-turbo'): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider('modelscope', {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey,
    model,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  });
}

export function createIFlowProvider(apiKey: string, model: string = 'gpt-4'): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider('iflow', {
    baseURL: 'https://iflow.cn/api/v1', // 请根据实际文档调整
    apiKey,
    model,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  });
}
