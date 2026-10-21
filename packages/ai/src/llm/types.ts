import { z } from 'zod';

export type LLMProviderType = 'gemini' | 'groq' | 'ollama' | 'mock';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  messages?: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateStructuredOptions<T> extends GenerateTextOptions {
  schema: z.ZodType<T>;
  schemaName?: string;
  maxRetries?: number;
}

export interface LLMMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerateTextResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  rawJson: string;
  inputTokens: number;
  outputTokens: number;
  retryCount: number;
}

export interface RateLimiterOptions {
  /** Maximum requests allowed in the time window */
  maxRequestsPerMinute?: number;
  /** Maximum tokens allowed in the time window */
  maxTokensPerMinute?: number;
}

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  rateLimit?: RateLimiterOptions;
}

export interface LLMProvider {
  readonly name: LLMProviderType;
  readonly model: string;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<GenerateStructuredResult<T>>;
  getMetrics(): LLMMetrics;
}
