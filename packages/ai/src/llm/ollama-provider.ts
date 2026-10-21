import { BaseLLMProvider } from './base-provider.js';
import { GenerateTextOptions, GenerateTextResult, LLMProviderConfig } from './types.js';

export class OllamaLLMProvider extends BaseLLMProvider {
  readonly name = 'ollama' as const;
  readonly model: string;
  private readonly baseUrl: string;

  constructor(config: LLMProviderConfig = {}) {
    // Local Ollama has no free-tier rate limits, but we keep safety bounds
    super(config.rateLimit ?? { maxRequestsPerMinute: 60, maxTokensPerMinute: 100_000 });
    this.model = config.model ?? process.env.OLLAMA_MODEL ?? 'llama3.2';
    this.baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  }

  async executeCompletion(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    if (options.messages && options.messages.length > 0) {
      messages.push(...options.messages);
    } else {
      messages.push({ role: 'user', content: options.prompt });
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.2,
          num_predict: options.maxTokens ?? 1024,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as any;
    const text = json.message?.content ?? '';
    const inputTokens = json.prompt_eval_count ?? Math.ceil(options.prompt.length / 4);
    const outputTokens = json.eval_count ?? Math.ceil(text.length / 4);

    return { text, inputTokens, outputTokens };
  }
}
