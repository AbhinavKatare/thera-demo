export type SlackBlock = Record<string, unknown>;

export interface AskResponseBlockOptions {
  question: string;
  answer: string;
  queryType?: string;
  parameters?: Record<string, unknown>;
  sources?: Array<Record<string, unknown>>;
  isRefusal?: boolean;
}

export function buildAskResponseBlocks(options: AskResponseBlockOptions): SlackBlock[] {
  const { question, answer, queryType, sources = [], isRefusal = false } = options;

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Q:* _"${question}"_\n\n${answer}`,
      },
    },
  ];

  if (isRefusal) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🛡️ *PayPilot Safety Guard:* Questions are strictly restricted to whitelisted payroll metrics. Prompt injections and schema probing are blocked.`,
        },
      ],
    });
    return blocks;
  }

  if (sources.length > 0) {
    const formattedSources = sources.slice(0, 8).map((s) => {
      // Format row nicely
      const parts: string[] = [];
      if (s.name) parts.push(`*${s.name}*`);
      if (s.contractorName) parts.push(`*${s.contractorName}*`);
      if (s.country) parts.push(`(${s.country})`);
      if (s.amountFormatted) parts.push(String(s.amountFormatted));
      else if (s.netMinor !== undefined) {
        const amt = Number(s.netMinor) / 100;
        const curr = s.currency ?? 'USD';
        parts.push(`$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${curr}`);
      } else if (s.totalMinor !== undefined) {
        const amt = Number(s.totalMinor) / 100;
        const curr = s.currency ?? 'USD';
        parts.push(`$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${curr}`);
      }
      if (s.period) parts.push(`[${s.period}]`);
      if (s.dueDate) parts.push(`Due: ${String(s.dueDate).slice(0, 10)}`);
      return `• ${parts.join(' ')}`;
    });

    blocks.push(
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📊 Data Sources & Verified Records (${sources.length}):*\n${formattedSources.join('\n')}`,
        },
      },
    );
  }

  if (queryType) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🔍 Parameterized Query: \`${queryType}\` • Zero raw SQL executed`,
        },
      ],
    });
  }

  return blocks;
}
