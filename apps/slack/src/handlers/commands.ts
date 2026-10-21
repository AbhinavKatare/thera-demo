import type { App } from '@slack/bolt';
import { PayPilotClient } from '../services/paypilot-client.js';
import { buildPayrollRunScheduledBlocks } from '../blocks/payroll-run.blocks.js';
import { buildNewInvoiceBlocks } from '../blocks/new-invoice.blocks.js';
import { buildAskResponseBlocks } from '../blocks/ask-response.blocks.js';
import { buildAccountLinkingBlocks } from '../blocks/account-linking.blocks.js';

export function registerSlashCommands(app: App, client: PayPilotClient = new PayPilotClient()): void {
  // /payroll command
  app.command('/payroll', async ({ command, ack, respond }) => {
    await ack();

    const slackUserId = command.user_id;
    const text = command.text.trim();

    // Check account-linking argument: /payroll link you@company.com
    if (text.startsWith('link ')) {
      const email = text.replace('link ', '').trim();
      const linkResult = await client.linkSlackUserByEmail(email, slackUserId);
      if (linkResult.success) {
        await respond({
          response_type: 'ephemeral',
          text: `✅ Successfully linked your Slack account to PayPilot user *${linkResult.user.name}* (${linkResult.user.email}) with role *${linkResult.user.role}*.`,
        });
        return;
      }
    }

    // Verify user mapping
    const user = await client.getUserBySlackId(slackUserId);
    if (!user) {
      await respond({
        response_type: 'ephemeral',
        blocks: buildAccountLinkingBlocks(slackUserId) as any,
        text: 'Please link your PayPilot account.',
      });
      return;
    }

    // Fetch upcoming payroll
    const summary = await client.getUpcomingPayrollSummary(user.companyId);
    const blocks = buildPayrollRunScheduledBlocks({
      payrollRunId: summary.runId,
      approvalId: summary.approvalId,
      totalPeople: summary.totalPeople,
      totalAmountFormatted: summary.totalAmountFormatted,
      flaggedItemsCount: summary.flaggedItemsCount,
      scheduledTimeDescription: 'runs tomorrow',
      anomalies: summary.anomalies,
    });

    await respond({
      response_type: 'in_channel',
      text: `Payroll runs tomorrow: ${summary.totalPeople} people, ${summary.totalAmountFormatted} total, ${summary.flaggedItemsCount} items flagged`,
      blocks: blocks as any,
    });
  });

  // /invoices command
  app.command('/invoices', async ({ command, ack, respond }) => {
    await ack();

    const slackUserId = command.user_id;
    const user = await client.getUserBySlackId(slackUserId);

    if (!user) {
      await respond({
        response_type: 'ephemeral',
        blocks: buildAccountLinkingBlocks(slackUserId) as any,
        text: 'Please link your PayPilot account.',
      });
      return;
    }

    const invoices = await client.getPendingInvoices(user.companyId);
    if (invoices.length === 0) {
      await respond({
        response_type: 'ephemeral',
        text: '✅ All incoming invoices are reviewed and settled. No invoices currently pending.',
      });
      return;
    }

    // Post first pending invoice card
    const first = invoices[0]!;
    const blocks = buildNewInvoiceBlocks({
      invoiceId: first.id,
      approvalId: first.approvalId,
      vendorName: first.vendorName,
      invoiceNumber: first.invoiceNumber,
      amountFormatted: first.amountFormatted,
      currency: first.currency,
      matchConfidence: first.matchConfidence,
      flags: first.flags,
      dueDateFormatted: first.dueDateFormatted,
    });

    await respond({
      response_type: 'in_channel',
      text: `Pending Invoice from ${first.vendorName}: ${first.amountFormatted}`,
      blocks: blocks as any,
    });
  });

  // /ask command
  app.command('/ask', async ({ command, ack, respond }) => {
    await ack();

    const slackUserId = command.user_id;
    const question = command.text.trim();

    if (!question) {
      await respond({
        response_type: 'ephemeral',
        text: '💡 *Usage:* `/ask how much did we pay contractors in India this month?`',
      });
      return;
    }

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

    await respond({
      response_type: 'in_channel',
      text: result.answer,
      blocks: blocks as any,
    });
  });
}
