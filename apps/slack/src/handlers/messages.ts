import type { App } from '@slack/bolt';
import { PayPilotClient } from '../services/paypilot-client.js';
import { buildAskResponseBlocks } from '../blocks/ask-response.blocks.js';

export function registerMessageHandlers(app: App, client: PayPilotClient = new PayPilotClient()): void {
  // Listen for direct messages or mentions
  app.message(async ({ message, say }) => {
    const msg = message as { text?: string; user?: string; ts?: string; subtype?: string };

    // Ignore bot messages, message updates, or deletions
    if (msg.subtype || !msg.text) {
      return;
    }

    const question = msg.text.trim();
    if (!question) {
      return;
    }

    const slackUserId = msg.user ?? '';
    const user = await client.getUserBySlackId(slackUserId);
    const companyId = user?.companyId ?? 'c0000000-0000-0000-0000-000000000001';

    const result = await client.askPayroll(companyId, question);

    const blocks = buildAskResponseBlocks({
      question,
      answer: result.answer,
      queryType: result.queryType,
      parameters: result.parameters,
      sources: result.sources,
      isRefusal: result.isRefusal,
    });

    // Reply in-thread as required
    await say({
      thread_ts: msg.ts,
      text: result.answer,
      blocks: blocks as any,
    });
  });
}
