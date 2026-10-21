import { BaseLLMProvider } from './base-provider.js';
import { GenerateTextOptions, GenerateTextResult, LLMProviderConfig } from './types.js';

export class GeminiLLMProvider extends BaseLLMProvider {
  readonly name = 'gemini' as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: LLMProviderConfig = {}) {
    super(config.rateLimit ?? { maxRequestsPerMinute: 15, maxTokensPerMinute: 32_000 });
    this.apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.model = config.model ?? process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  async executeCompletion(options: GenerateTextOptions): Promise<GenerateTextResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const contents: any[] = [];
    if (options.systemPrompt) {
      // In Gemini 1.5, system instruction is passed via system_instruction
    }

    contents.push({
      role: 'user',
      parts: [
        {
          text: options.systemPrompt ? `${options.systemPrompt}\n\n${options.prompt}` : options.prompt,
        },
      ],
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxTokens ?? 1024,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as any;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const inputTokens = json.usageMetadata?.promptTokenCount ?? Math.ceil(options.prompt.length / 4);
    const outputTokens = json.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);

    return { text, inputTokens, outputTokens };
  }
}
