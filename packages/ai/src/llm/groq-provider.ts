import { BaseLLMProvider } from './base-provider.js';
import { GenerateTextOptions, GenerateTextResult, LLMProviderConfig } from './types.js';

export class GroqLLMProvider extends BaseLLMProvider {
  readonly name = 'groq' as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: LLMProviderConfig = {}) {
    // Groq free tier: ~30 RPM, ~6,000 to 14,400 TPM
    super(config.rateLimit ?? { maxRequestsPerMinute: 25, maxTokensPerMinute: 12_000 });
    this.apiKey = config.apiKey ?? process.env.GROQ_API_KEY ?? '';
    this.model = config.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    this.baseUrl = config.baseUrl ?? 'https://api.groq.com/openai/v1';
  }

  async executeCompletion(options: GenerateTextOptions): Promise<GenerateTextResult> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    if (options.messages && options.messages.length > 0) {
      messages.push(...options.messages);
    } else {
      messages.push({ role: 'user', content: options.prompt });
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as any;
    const text = json.choices?.[0]?.message?.content ?? '';
    const inputTokens = json.usage?.prompt_tokens ?? Math.ceil(options.prompt.length / 4);
    const outputTokens = json.usage?.completion_tokens ?? Math.ceil(text.length / 4);

    return { text, inputTokens, outputTokens };
  }
}
