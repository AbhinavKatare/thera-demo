import { BaseLLMProvider } from './base-provider.js';
import { GenerateTextOptions, GenerateTextResult } from './types.js';

export type MockHandler = (options: GenerateTextOptions) => string | Promise<string>;

export class MockLLMProvider extends BaseLLMProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-model-v1';

  private customHandler?: MockHandler;

  constructor(customHandler?: MockHandler) {
    super({ maxRequestsPerMinute: 10_000, maxTokensPerMinute: 10_000_000 });
    this.customHandler = customHandler;
  }

  public setHandler(handler: MockHandler): void {
    this.customHandler = handler;
  }

  public hasCustomHandler(): boolean {
    return Boolean(this.customHandler);
  }

  async executeCompletion(options: GenerateTextOptions): Promise<GenerateTextResult> {
    if (this.customHandler) {
      const response = await this.customHandler(options);
      return {
        text: response,
        inputTokens: Math.ceil(options.prompt.length / 4),
        outputTokens: Math.ceil(response.length / 4),
      };
    }

    // Default mock response: returns JSON or plain text depending on prompt
    let defaultResponse = 'Mock LLM Response';
    if (options.systemPrompt?.includes('JSON') || options.prompt.includes('schema')) {
      defaultResponse = JSON.stringify({
        status: 'success',
        explanation: 'Mock generated explanation strictly derived from evidence.',
        suggestedAction: 'Review the flagged line items before final submission.',
      });
    }

    return {
      text: defaultResponse,
      inputTokens: Math.ceil(options.prompt.length / 4),
      outputTokens: Math.ceil(defaultResponse.length / 4),
    };
  }
}
