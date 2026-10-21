import type { App } from '@slack/bolt';
import { PayPilotClient } from '../services/paypilot-client.js';
import { buildInvoiceDecisionBlocks } from '../blocks/new-invoice.blocks.js';
import { formatTimeHM } from './actions.js';

export function registerViewHandlers(app: App, client: PayPilotClient = new PayPilotClient()): void {
  // 1. Invoice Correction Modal Submission
  app.view('invoice_correction_modal_submit', async ({ ack, view, body, client: slackClient }) => {
    await ack();

    const values = view.state.values;
    const vendorName = values['vendor_name_block']?.['vendor_name_input']?.value ?? 'Vendor';
    const invoiceNumber = values['invoice_number_block']?.['invoice_number_input']?.value ?? 'Invoice';
    const amount = values['amount_block']?.['amount_input']?.value ?? '0.00';
    const currency = values['currency_block']?.['currency_input']?.value ?? 'USD';
    const reason = values['correction_reason_block']?.['correction_reason_input']?.value ?? '';

    let metadata: { invoiceId?: string; channelId?: string; messageTs?: string } = {};
    try {
      if (view.private_metadata) {
        metadata = JSON.parse(view.private_metadata);
      }
    } catch {
      // Ignored
    }

    const slackUserId = body.user.id;
    const userAny = body.user as any;
    const slackUserName = userAny.username ?? userAny.name ?? 'user';
    const timeFormatted = formatTimeHM();

    // If channel and messageTs are present, update original message in-place
    if (metadata.channelId && metadata.messageTs && slackClient?.chat?.update) {
      const updateBlocks = buildInvoiceDecisionBlocks({
        action: 'FIX_REQUESTED',
        userName: slackUserName,
        userId: slackUserId,
        timeFormatted,
        invoiceId: metadata.invoiceId ?? 'inv-001',
        vendorName,
        invoiceNumber,
        amountFormatted: `${amount} ${currency}`,
        note: reason,
      });

      await slackClient.chat.update({
        channel: metadata.channelId,
        ts: metadata.messageTs,
        text: `✏️ Corrected by @${slackUserName} at ${timeFormatted}: ${vendorName} #${invoiceNumber} for ${amount} ${currency}`,
        blocks: updateBlocks as any,
      });
    }
  });

  // 2. Account Link Modal Submission
  app.view('account_link_modal_submit', async ({ ack, view, body, client: slackClient }) => {
    await ack();

    const values = view.state.values;
    const email = values['email_block']?.['email_input']?.value?.trim() ?? '';
    const slackUserId = body.user.id;

    if (email) {
      const result = await client.linkSlackUserByEmail(email, slackUserId);
      if (slackClient?.chat?.postMessage) {
        await slackClient.chat.postMessage({
          channel: slackUserId,
          text: `🎉 You are now linked to PayPilot account *${result.user.name}* (${result.user.email}) with role *${result.user.role}*. You can now approve payroll runs and invoices directly in Slack.`,
        });
      }
    }
  });
}
