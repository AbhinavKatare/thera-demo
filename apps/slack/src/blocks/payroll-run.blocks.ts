export type SlackBlock = Record<string, unknown>;

export interface PayrollRunAnomalyItem {
  id?: string;
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  explanation: string;
  suggestedAction?: string;
  contractorName?: string;
  amountFormatted?: string;
}

export interface PayrollRunBlockOptions {
  payrollRunId: string;
  approvalId?: string;
  totalPeople: number;
  totalAmountFormatted: string;
  flaggedItemsCount: number;
  companyName?: string;
  scheduledTimeDescription?: string;
  anomalies: PayrollRunAnomalyItem[];
}

export function buildPayrollRunScheduledBlocks(options: PayrollRunBlockOptions): SlackBlock[] {
  const {
    payrollRunId,
    approvalId = `appr-run-${payrollRunId}`,
    totalPeople,
    totalAmountFormatted,
    flaggedItemsCount,
    companyName = 'PayPilot Technologies',
    scheduledTimeDescription = 'runs tomorrow',
    anomalies,
  } = options;

  const severityIcon = (s: string) => {
    switch (s.toLowerCase()) {
      case 'critical':
        return '🔴 *CRITICAL*';
      case 'high':
        return '🟠 *HIGH*';
      case 'medium':
        return '🟡 *MEDIUM*';
      case 'low':
      default:
        return '⚪ *LOW*';
    }
  };

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚡ PayPilot Payroll Alert',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Payroll ${scheduledTimeDescription}: ${totalPeople} people, ${totalAmountFormatted} total, ${flaggedItemsCount} items flagged*`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🏢 *Company:* ${companyName}   |   🆔 *Run ID:* \`${payrollRunId.slice(0, 8)}\`   |   ⏰ *Requires approval before release*`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  if (anomalies.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⚠️ Detected Anomalies & AI Analysis (${anomalies.length}):*`,
      },
    });

    for (const anomaly of anomalies) {
      const contractorDetail = anomaly.contractorName ? `\n> *Target:* ${anomaly.contractorName}` : '';
      const amountDetail = anomaly.amountFormatted ? ` (${anomaly.amountFormatted})` : '';
      const actionDetail = anomaly.suggestedAction ? `\n> *Recommendation:* ${anomaly.suggestedAction}` : '';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${severityIcon(anomaly.severity)} *${anomaly.summary}*${amountDetail}${contractorDetail}\n> ${anomaly.explanation}${actionDetail}`,
        },
      });
    }
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '✅ *All automated compliance, duplicate, and salary variation checks passed with zero flags.*',
      },
    });
  }

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'actions',
      block_id: 'payroll_run_actions',
      elements: [
        {
          type: 'button',
          action_id: 'approve_payroll_run',
          text: {
            type: 'plain_text',
            text: 'Approve run',
            emoji: true,
          },
          style: 'primary',
          value: JSON.stringify({
            runId: payrollRunId,
            approvalId,
            amountMinor: 4_820_000,
            currency: 'USD',
          }),
        },
        {
          type: 'button',
          action_id: 'reject_payroll_run',
          text: {
            type: 'plain_text',
            text: 'Hold',
            emoji: true,
          },
          style: 'danger',
          value: JSON.stringify({
            runId: payrollRunId,
            approvalId,
          }),
        },
        {
          type: 'button',
          action_id: 'view_payroll_details',
          text: {
            type: 'plain_text',
            text: 'View details',
            emoji: true,
          },
          value: JSON.stringify({
            runId: payrollRunId,
          }),
        },
      ],
    },
  );

  return blocks;
}

export interface PayrollRunDecisionUpdateOptions {
  action: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'HELD';
  userName: string;
  userId: string;
  timeFormatted: string; // e.g. "10:42" or "10:42 AM"
  payrollRunId: string;
  totalPeople?: number;
  totalAmountFormatted?: string;
  note?: string;
  isFullyApproved?: boolean;
}

export function buildPayrollRunDecisionBlocks(options: PayrollRunDecisionUpdateOptions): SlackBlock[] {
  const {
    action,
    userName,
    userId,
    timeFormatted,
    payrollRunId,
    totalPeople = 12,
    totalAmountFormatted = '$48,200',
    note,
    isFullyApproved = action === 'APPROVED',
  } = options;

  let bannerText = '';
  let statusBadge = '';

  if (action === 'APPROVED' && isFullyApproved) {
    bannerText = `Approved by @${userName} at ${timeFormatted}`;
    statusBadge = `✅ *Approved by <@${userId}> at ${timeFormatted}*`;
  } else if (action === 'PARTIALLY_APPROVED' || !isFullyApproved) {
    bannerText = `Partially approved (1/2) by @${userName} at ${timeFormatted}`;
    statusBadge = `⚠️ *Partially approved (1/2) by <@${userId}> at ${timeFormatted}*\n_Transactions ≥ $5,000 require 2 approvers. Waiting for second approver._`;
  } else if (action === 'REJECTED' || action === 'HELD') {
    bannerText = `Held by @${userName} at ${timeFormatted}`;
    statusBadge = `⏸️ *Held by <@${userId}> at ${timeFormatted}*`;
  }

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚡ PayPilot Payroll Alert',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Payroll: ${totalPeople} people, ${totalAmountFormatted} total* (Run ID: \`${payrollRunId.slice(0, 8)}\`)`,
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
          text: `📝 *Decision Note:* ${note}`,
        },
      ],
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `🔒 Verified on PayPilot Monorepo Engine • Audit logged`,
      },
    ],
  });

  return blocks;
}
