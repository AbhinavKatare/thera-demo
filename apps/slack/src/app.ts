import { App, LogLevel } from '@slack/bolt';
import { PayPilotClient } from './services/paypilot-client.js';
import { registerSlashCommands } from './handlers/commands.js';
import { registerActionHandlers } from './handlers/actions.js';
import { registerViewHandlers } from './handlers/views.js';
import { registerMessageHandlers } from './handlers/messages.js';

export interface PayPilotSlackConfig {
  botToken?: string;
  appToken?: string;
  signingSecret?: string;
  logLevel?: (typeof LogLevel)[keyof typeof LogLevel];
  client?: PayPilotClient;
}

/**
 * Builds a Bolt App for Socket Mode. Constructing the App never requires
 * credentials (routes are registered on a plain object), so tests can attach
 * handlers without a bot token; only `src/main.ts` connects to live Slack.
 */
export function buildSlackApp(config: PayPilotSlackConfig = {}): App {
  const app = new App({
    token: config.botToken,
    appToken: config.appToken,
    signingSecret: config.signingSecret,
    logLevel: config.logLevel ?? LogLevel.INFO,
  });

  const client = config.client ?? new PayPilotClient();

  registerSlackHandlers(app, client);
  return app;
}

/**
 * Registers all Slash Commands, Interactive Actions, Modals, and Direct Messages.
 */
export function registerSlackHandlers(app: App, client: PayPilotClient = new PayPilotClient()): void {
  // 1. Slash commands: /payroll, /invoices, /ask
  registerSlashCommands(app, client);

  // Backward compatibility legacy commands
  app.command('/paypilot', async ({ command, ack, respond }) => {
    await ack();
    await respond(`:chart_with_upwards_trend: PayPilot Monorepo Copilot active. Query: ${JSON.stringify(command.text)}`);
  });

  // 2. Interactivity: approve, reject/hold, request fix, modals
  registerActionHandlers(app, client);

  // 3. View submissions: invoice correction and account linking
  registerViewHandlers(app, client);

  // 4. In-thread DM answers for natural language queries
  registerMessageHandlers(app, client);
}

// Re-export services and builders for external integration
export { PayPilotClient } from './services/paypilot-client.js';
export { SlackPayrollNotifier } from './services/payroll-notifier.js';
export { buildPayrollRunScheduledBlocks, buildPayrollRunDecisionBlocks } from './blocks/payroll-run.blocks.js';
export { buildNewInvoiceBlocks, buildInvoiceDecisionBlocks } from './blocks/new-invoice.blocks.js';
export { buildInvoiceCorrectionModal } from './blocks/correction-modal.blocks.js';
export { buildAccountLinkingBlocks, buildAccountLinkModal } from './blocks/account-linking.blocks.js';
export { buildAskResponseBlocks } from './blocks/ask-response.blocks.js';
export { registerSlashCommands } from './handlers/commands.js';
export { registerActionHandlers } from './handlers/actions.js';
export { registerViewHandlers } from './handlers/views.js';
export { registerMessageHandlers } from './handlers/messages.js';
export { verifySlackSignature } from './services/signature-verifier.js';
