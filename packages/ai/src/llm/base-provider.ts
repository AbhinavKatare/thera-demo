import {
  GenerateStructuredOptions,
  GenerateStructuredResult,
  GenerateTextOptions,
  GenerateTextResult,
  LLMMetrics,
  LLMProvider,
  LLMProviderType,
  RateLimiterOptions,
} from './types.js';
import { RateLimiter } from './rate-limiter.js';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: LLMProviderType;
  abstract readonly model: string;

  protected rateLimiter: RateLimiter;
  protected metrics: LLMMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  constructor(rateLimitOptions?: RateLimiterOptions) {
    this.rateLimiter = new RateLimiter(rateLimitOptions);
  }

  public getMetrics(): LLMMetrics {
    return { ...this.metrics };
  }

  protected updateMetrics(inputTokens: number, outputTokens: number, success: boolean): void {
    this.metrics.totalRequests += 1;
    if (success) {
      this.metrics.successfulRequests += 1;
    } else {
      this.metrics.failedRequests += 1;
    }
    this.metrics.inputTokens += inputTokens;
    this.metrics.outputTokens += outputTokens;
    this.metrics.totalTokens += inputTokens + outputTokens;
  }

  abstract executeCompletion(options: GenerateTextOptions): Promise<GenerateTextResult>;

  public async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const estimatedTokens = Math.max(50, Math.ceil((options.prompt.length + (options.systemPrompt?.length ?? 0)) / 4));
    await this.rateLimiter.acquire(estimatedTokens);

    try {
      const result = await this.executeCompletion(options);
      this.rateLimiter.recordActualUsage(estimatedTokens, result.inputTokens + result.outputTokens);
      this.updateMetrics(result.inputTokens, result.outputTokens, true);
      return result;
    } catch (err) {
      this.updateMetrics(estimatedTokens, 0, false);
      throw err;
    }
  }

  public async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<GenerateStructuredResult<T>> {
    const maxRetries = options.maxRetries ?? 3;
    let attempts = 0;
    let lastError = '';
    let accumulatedInputTokens = 0;
    let accumulatedOutputTokens = 0;

    const baseSystemPrompt = options.systemPrompt ?? '';
    const jsonInstructions = `
IMPORTANT: You MUST respond ONLY with valid, minified or indented RFC 8259 compliant JSON.
Do NOT include markdown formatting like \`\`\`json or \`\`\`. Do not include conversational text or explanations.
`;

    while (attempts < maxRetries) {
      attempts++;

      let prompt = options.prompt;
      if (attempts > 1) {
        prompt = `
Previous attempt failed validation:
${lastError}

Please correct the response and return ONLY valid JSON matching the required schema.
Original request:
${options.prompt}
`;
      }

      const textResult = await this.generateText({
        ...options,
        prompt,
        systemPrompt: `${baseSystemPrompt}\n${jsonInstructions}`.trim(),
      });

      accumulatedInputTokens += textResult.inputTokens;
      accumulatedOutputTokens += textResult.outputTokens;

      const cleanedText = this.cleanJsonString(textResult.text);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(cleanedText);
      } catch (parseErr: any) {
        lastError = `JSON syntax parse error: ${parseErr.message}. Raw output received: ${cleanedText.slice(0, 200)}`;
        continue;
      }

      const validation = options.schema.safeParse(parsedJson);
      if (validation.success) {
        return {
          data: validation.data,
          rawJson: cleanedText,
          inputTokens: accumulatedInputTokens,
          outputTokens: accumulatedOutputTokens,
          retryCount: attempts - 1,
        };
      } else {
        const issues = validation.error.issues
          .map((i) => `Path "${i.path.join('.')}": ${i.message}`)
          .join('; ');
        lastError = `Schema validation failed: ${issues}`;
      }
    }

    throw new Error(
      `Failed to generate valid structured JSON conforming to schema after ${maxRetries} attempts. Last error: ${lastError}`,
    );
  }

  private cleanJsonString(str: string): string {
    let trimmed = str.trim();
    // Strip markdown code fences if model returned ```json ... ```
    if (trimmed.startsWith('```')) {
      trimmed = trimmed.replace(/^```(?:json)?\s*/i, '');
      trimmed = trimmed.replace(/\s*```$/, '');
    }
    return trimmed.trim();
  }
}
