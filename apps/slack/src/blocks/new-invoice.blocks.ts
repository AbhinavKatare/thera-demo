export type SlackBlock = Record<string, unknown>;

export interface NewInvoiceCardOptions {
  invoiceId: string;
  approvalId?: string;
  vendorName: string;
  invoiceNumber: string;
  amountFormatted: string;
  currency: string;
  matchConfidence: number; // 0 to 1 or 0 to 100
  flags: string[];
  dueDateFormatted?: string;
  appUrl?: string;
}

export function buildNewInvoiceBlocks(options: NewInvoiceCardOptions): SlackBlock[] {
  const {
    invoiceId,
    approvalId = `appr-inv-${invoiceId}`,
    vendorName,
    invoiceNumber,
    amountFormatted,
    currency,
    matchConfidence,
    flags,
    dueDateFormatted = 'In 14 days',
    appUrl = `https://app.paypilot.internal/invoices/${invoiceId}`,
  } = options;

  const normalizedConfidence = matchConfidence > 1 ? matchConfidence : Math.round(matchConfidence * 100);
  const confidenceBadge =
    normalizedConfidence >= 90
      ? `🟢 *${normalizedConfidence}%* (High)`
      : normalizedConfidence >= 75
        ? `🟡 *${normalizedConfidence}%* (Medium)`
        : `🔴 *${normalizedConfidence}%* (Low - Review required)`;

  const flagsSection =
    flags.length > 0
      ? flags.map((f) => `• ⚠️ ${f}`).join('\n')
      : '• ✅ Deterministic line-item arithmetic verified\n• ✅ Valid contractor & contract match';

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📄 New Invoice Extracted',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${vendorName}* submitted invoice *#${invoiceNumber}*`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Vendor:*\n${vendorName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Amount:*\n${amountFormatted} ${currency}`,
        },
        {
          type: 'mrkdwn',
          text: `*Match Confidence:*\n${confidenceBadge}`,
        },
        {
          type: 'mrkdwn',
          text: `*Due Date:*\n${dueDateFormatted}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Intake & Extraction Status:*\n${flagsSection}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'actions',
      block_id: 'invoice_actions',
      elements: [
        {
          type: 'button',
          action_id: 'approve_invoice',
          text: {
            type: 'plain_text',
            text: 'Approve payment',
            emoji: true,
          },
          style: 'primary',
          value: JSON.stringify({
            invoiceId,
            approvalId,
            vendorName,
            amountFormatted,
          }),
        },
        {
          type: 'button',
          action_id: 'open_correction_modal',
          text: {
            type: 'plain_text',
            text: 'Request fix',
            emoji: true,
          },
          value: JSON.stringify({
            invoiceId,
            vendorName,
            invoiceNumber,
            amount: amountFormatted.replace(/[^0-9.]/g, ''),
            currency,
            dueDate: dueDateFormatted,
          }),
        },
        {
          type: 'button',
          action_id: 'open_in_app',
          text: {
            type: 'plain_text',
            text: 'Open in app',
            emoji: true,
          },
          url: appUrl,
          value: JSON.stringify({ invoiceId }),
        },
      ],
    },
  ];

  return blocks;
}

export interface InvoiceDecisionUpdateOptions {
  action: 'APPROVED' | 'FIX_REQUESTED' | 'REJECTED';
  userName: string;
  userId: string;
  timeFormatted: string;
  invoiceId: string;
  vendorName: string;
  invoiceNumber?: string;
  amountFormatted: string;
  note?: string;
}

export function buildInvoiceDecisionBlocks(options: InvoiceDecisionUpdateOptions): SlackBlock[] {
  const {
    action,
    userName,
    userId,
    timeFormatted,
    invoiceId,
    vendorName,
    invoiceNumber = 'Invoice',
    amountFormatted,
    note,
  } = options;

  let statusBadge = '';
  if (action === 'APPROVED') {
    statusBadge = `✅ *Approved by <@${userId}> at ${timeFormatted}*`;
  } else if (action === 'FIX_REQUESTED') {
    statusBadge = `✏️ *Fix requested / fields updated by <@${userId}> at ${timeFormatted}*`;
  } else {
    statusBadge = `❌ *Rejected by <@${userId}> at ${timeFormatted}*`;
  }

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📄 Invoice Processed',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${vendorName}* (${invoiceNumber}) • *${amountFormatted}*`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: statusBadge,
      },
    },
  ];

  if (note) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📝 *Note:* ${note}`,
        },
      ],
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `🆔 Invoice ID: \`${invoiceId.slice(0, 8)}\` • Recorded in PayPilot Audit Log`,
      },
    ],
  });

  return blocks;
}
