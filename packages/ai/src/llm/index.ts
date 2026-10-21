import { LLMProvider, LLMProviderConfig, LLMProviderType } from './types.js';
import { GeminiLLMProvider } from './gemini-provider.js';
import { GroqLLMProvider } from './groq-provider.js';
import { OllamaLLMProvider } from './ollama-provider.js';
import { MockLLMProvider } from './mock-provider.js';

export * from './types.js';
export * from './rate-limiter.js';
export * from './base-provider.js';
export * from './gemini-provider.js';
export * from './groq-provider.js';
export * from './ollama-provider.js';
export * from './mock-provider.js';

export function createLLMProvider(
  providerType?: LLMProviderType | string,
  config: LLMProviderConfig = {},
): LLMProvider {
  const chosenType = (providerType ?? process.env.LLM_PROVIDER ?? 'mock').toLowerCase();

  switch (chosenType) {
    case 'gemini':
      return new GeminiLLMProvider(config);
    case 'groq':
      return new GroqLLMProvider(config);
    case 'ollama':
      return new OllamaLLMProvider(config);
    case 'mock':
    default:
      return new MockLLMProvider();
  }
}
