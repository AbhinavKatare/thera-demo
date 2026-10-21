export type SlackBlock = Record<string, unknown>;
export type SlackModalView = Record<string, unknown>;

export function buildAccountLinkingBlocks(slackUserId: string, linkUrl?: string): SlackBlock[] {
  const url = linkUrl ?? `https://app.paypilot.internal/auth/slack/link?slackUserId=${slackUserId}`;

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔗 Link Your PayPilot Account',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hello <@${slackUserId}>! Your Slack account is not yet linked to PayPilot.\n\nTo view sensitive payroll data, approve payments, or query contractor records, you must connect your PayPilot workspace account.`,
      },
    },
    {
      type: 'actions',
      block_id: 'account_link_actions',
      elements: [
        {
          type: 'button',
          action_id: 'open_account_link_modal',
          text: {
            type: 'plain_text',
            text: 'Link Account via Email',
            emoji: true,
          },
          style: 'primary',
          value: JSON.stringify({ slackUserId }),
        },
        {
          type: 'button',
          action_id: 'open_account_link_web',
          text: {
            type: 'plain_text',
            text: 'Open Link Portal',
            emoji: true,
          },
          url,
          value: JSON.stringify({ slackUserId }),
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `💡 *Tip:* You can also run \`/payroll link you@company.com\` to link instantly.`,
        },
      ],
    },
  ];
}

export function buildAccountLinkModal(slackUserId: string): SlackModalView {
  return {
    type: 'modal',
    callback_id: 'account_link_modal_submit',
    private_metadata: JSON.stringify({ slackUserId }),
    title: {
      type: 'plain_text',
      text: 'Link PayPilot Account',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Link Now',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Enter the email address registered with your PayPilot organization. We will verify your permissions and grant role-based Slack access immediately.`,
        },
      },
      {
        type: 'input',
        block_id: 'email_block',
        element: {
          type: 'plain_text_input',
          action_id: 'email_input',
          placeholder: {
            type: 'plain_text',
            text: 'e.g. founder@company.com',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Work Email Address',
        },
      },
    ],
  };
}
