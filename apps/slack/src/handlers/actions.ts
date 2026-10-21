import type { App, BlockAction, ButtonAction } from '@slack/bolt';
import { PayPilotClient } from '../services/paypilot-client.js';
import { buildPayrollRunDecisionBlocks } from '../blocks/payroll-run.blocks.js';
import { buildInvoiceDecisionBlocks } from '../blocks/new-invoice.blocks.js';
import { buildInvoiceCorrectionModal } from '../blocks/correction-modal.blocks.js';
import { buildAccountLinkModal } from '../blocks/account-linking.blocks.js';

export function formatTimeHM(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function registerActionHandlers(app: App, client: PayPilotClient = new PayPilotClient()): void {
  // 1. Approve Payroll Run
  app.action('approve_payroll_run', async ({ body, ack, respond }) => {
    await ack();

    const actionBody = body as BlockAction<ButtonAction>;
    const slackUserId = actionBody.user.id;
    const slackUserName = actionBody.user.username ?? actionBody.user.name ?? 'user';
    const actionVal = actionBody.actions[0]?.value ? JSON.parse(actionBody.actions[0].value) : {};

    const user = await client.getUserBySlackId(slackUserId);
    if (!user) {
      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: '⚠️ You must link your PayPilot account before approving payroll. Run `/payroll link you@company.com`.',
      });
      return;
    }

    if (user.role === 'VIEWER') {
      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: '⛔ Permission denied: Only account Owners and Approvers can approve payroll runs.',
      });
      return;
    }

    const timeFormatted = formatTimeHM();
    const result = await client.approvePayrollRun({
      approvalId: actionVal.approvalId ?? `appr-${actionVal.runId ?? 'run'}`,
      approverId: user.id,
      approverName: user.name ?? slackUserName,
      amountMinor: actionVal.amountMinor ?? 4_820_000,
      userRole: user.role,
    });

    const isFullyApproved = result.isFullyApproved;
    const updateBlocks = buildPayrollRunDecisionBlocks({
      action: isFullyApproved ? 'APPROVED' : 'PARTIALLY_APPROVED',
      userName: slackUserName,
      userId: slackUserId,
      timeFormatted,
      payrollRunId: actionVal.runId ?? 'r0000000-0000-0000-0000-000000000003',
      totalPeople: 12,
      totalAmountFormatted: '$48,200',
      isFullyApproved,
    });

    const replacedText = isFullyApproved
      ? `Approved by @${slackUserName} at ${timeFormatted}`
      : `Partially approved (1/2) by @${slackUserName} at ${timeFormatted}`;

    await respond({
      replace_original: true,
      text: replacedText,
      blocks: updateBlocks as any,
    });
  });

  // 2. Reject / Hold Payroll Run
  app.action('reject_payroll_run', async ({ body, ack, respond }) => {
    await ack();

    const actionBody = body as BlockAction<ButtonAction>;
    const slackUserId = actionBody.user.id;
    const slackUserName = actionBody.user.username ?? actionBody.user.name ?? 'user';
    const actionVal = actionBody.actions[0]?.value ? JSON.parse(actionBody.actions[0].value) : {};

    const user = await client.getUserBySlackId(slackUserId);
    if (!user) {
      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: '⚠️ You must link your PayPilot account before taking actions.',
      });
      return;
    }

    if (user.role === 'VIEWER') {
      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: '⛔ Permission denied: Only account Owners and Approvers can place payroll on hold.',
      });
      return;
    }

    const timeFormatted = formatTimeHM();
    await client.rejectPayrollRun({
      approvalId: actionVal.approvalId ?? `appr-${actionVal.runId ?? 'run'}`,
      approverId: user.id,
      approverName: user.name ?? slackUserName,
      userRole: user.role,
    });

    const updateBlocks = buildPayrollRunDecisionBlocks({
      action: 'HELD',
      userName: slackUserName,
      userId: slackUserId,
      timeFormatted,
      payrollRunId: actionVal.runId ?? 'r0000000-0000-0000-0000-000000000003',
      totalPeople: 12,
      totalAmountFormatted: '$48,200',
      isFullyApproved: false,
    });

    await respond({
      replace_original: true,
      text: `Held by @${slackUserName} at ${timeFormatted}`,
      blocks: updateBlocks as any,
    });
  });

  // 3. Approve Invoice
  app.action('approve_invoice', async ({ body, ack, respond }) => {
    await ack();

    const actionBody = body as BlockAction<ButtonAction>;
    const slackUserId = actionBody.user.id;
    const slackUserName = actionBody.user.username ?? actionBody.user.name ?? 'user';
    const actionVal = actionBody.actions[0]?.value ? JSON.parse(actionBody.actions[0].value) : {};

    const user = await client.getUserBySlackId(slackUserId);
    if (!user) {
      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: '⚠️ You must link your PayPilot account before approving invoices.',
      });
      return;
    }

    if (user.role === 'VIEWER') {
      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: '⛔ Permission denied: Only account Owners and Approvers can approve invoice payments.',
      });
      return;
    }

    const timeFormatted = formatTimeHM();
    await client.approveInvoice({
      invoiceId: actionVal.invoiceId ?? 'inv-001',
      approvalId: actionVal.approvalId,
      approverId: user.id,
      approverName: user.name ?? slackUserName,
      userRole: user.role,
    });

    const updateBlocks = buildInvoiceDecisionBlocks({
      action: 'APPROVED',
      userName: slackUserName,
      userId: slackUserId,
      timeFormatted,
      invoiceId: actionVal.invoiceId ?? 'inv-001',
      vendorName: actionVal.vendorName ?? 'Vendor',
      amountFormatted: actionVal.amountFormatted ?? '$4,500.00',
    });

    await respond({
      replace_original: true,
      text: `Approved by @${slackUserName} at ${timeFormatted}`,
      blocks: updateBlocks as any,
    });
  });

  // 4. Open Correction Modal
  app.action('open_correction_modal', async ({ body, ack, client: slackClient }) => {
    await ack();

    const actionBody = body as BlockAction<ButtonAction>;
    const actionVal = actionBody.actions[0]?.value ? JSON.parse(actionBody.actions[0].value) : {};

    const modal = buildInvoiceCorrectionModal({
      invoiceId: actionVal.invoiceId ?? 'inv-001',
      vendorName: actionVal.vendorName,
      invoiceNumber: actionVal.invoiceNumber,
      amount: actionVal.amount,
      currency: actionVal.currency,
      dueDate: actionVal.dueDate,
      channelId: actionBody.channel?.id,
      messageTs: actionBody.message?.ts,
    });

    if (actionBody.trigger_id && slackClient?.views?.open) {
      await slackClient.views.open({
        trigger_id: actionBody.trigger_id,
        view: modal as any,
      });
    }
  });

  // 5. Open Account Link Modal
  app.action('open_account_link_modal', async ({ body, ack, client: slackClient }) => {
    await ack();

    const actionBody = body as BlockAction<ButtonAction>;
    const modal = buildAccountLinkModal(actionBody.user.id);

    if (actionBody.trigger_id && slackClient?.views?.open) {
      await slackClient.views.open({
        trigger_id: actionBody.trigger_id,
        view: modal as any,
      });
    }
  });

  // 6. View Payroll Details action (informational)
  app.action('view_payroll_details', async ({ body, ack, respond }) => {
    await ack();
    const actionBody = body as BlockAction<ButtonAction>;
    const actionVal = actionBody.actions[0]?.value ? JSON.parse(actionBody.actions[0].value) : {};

    await respond({
      replace_original: false,
      response_type: 'ephemeral',
      text: `🔍 Detailed audit logs and timesheet attachments for Run \`${actionVal.runId ?? 'upcoming'}\` are accessible at https://app.paypilot.internal/payroll/${actionVal.runId ?? 'upcoming'}.`,
    });
  });
}
