import { describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSlackApp,
  registerSlackHandlers,
  PayPilotClient,
  SlackPayrollNotifier,
  buildPayrollRunScheduledBlocks,
  buildPayrollRunDecisionBlocks,
  buildNewInvoiceBlocks,
  buildInvoiceDecisionBlocks,
  buildInvoiceCorrectionModal,
  buildAccountLinkingBlocks,
  buildAskResponseBlocks,
} from './app.js';

describe('Slack Copilot - Manifest YAML', () => {
  it('manifest.yaml exists with Socket Mode, /payroll, /invoices, /ask commands, and bot scopes', () => {
    const manifestPath = resolve(__dirname, '../manifest.yaml');
    expect(existsSync(manifestPath)).toBe(true);

    const content = readFileSync(manifestPath, 'utf8');
    expect(content).toContain('socket_mode_enabled: true');
    expect(content).toContain('command: /payroll');
    expect(content).toContain('command: /invoices');
    expect(content).toContain('command: /ask');
    expect(content).toContain('chat:write');
    expect(content).toContain('commands');
    expect(content).toContain('im:history');
  });
});

describe('Slack Copilot - Block Kit Builders', () => {
  it('builds scheduled payroll preview message with anomalies and action buttons', () => {
    const blocks = buildPayrollRunScheduledBlocks({
      payrollRunId: 'r0000000-0000-0000-0000-000000000003',
      totalPeople: 12,
      totalAmountFormatted: '$48,200',
      flaggedItemsCount: 3,
      scheduledTimeDescription: 'runs tomorrow',
      anomalies: [
        {
          rule: 'salary_spike_above_average',
          severity: 'high',
          summary: 'Arun Patel paid 45% above 3-month average ($8,700 vs $6,000)',
          explanation: 'Monthly invoice includes 35 hours of unapproved overtime billed at emergency rate.',
          suggestedAction: 'Verify timesheet sign-off before approving full run.',
          contractorName: 'Arun Patel (India)',
          amountFormatted: '$8,700 USD',
        },
        {
          rule: 'new_bank_account_recent',
          severity: 'critical',
          summary: 'Sofia Rossi updated bank details 2 days ago',
          explanation: 'Beneficiary IBAN was changed to a Portuguese account on Oct 18, 2026.',
          suggestedAction: 'Confirm beneficiary account ownership via out-of-band verification.',
          contractorName: 'Sofia Rossi (Portugal)',
          amountFormatted: '$6,200 EUR',
        },
        {
          rule: 'unusual_overtime',
          severity: 'medium',
          summary: 'Liam O’Connor reported 40 hours overtime in 5 days',
          explanation: 'Contract terms cap billable overtime to 15 hours per calendar week.',
          suggestedAction: 'Adjust invoice line items to adhere to contracted maximums.',
          contractorName: 'Liam O’Connor (Ireland)',
          amountFormatted: '$5,400 EUR',
        },
      ],
    });

    // Contains scheduled text
    const textBlocks = JSON.stringify(blocks);
    expect(textBlocks).toContain('Payroll runs tomorrow: 12 people, $48,200 total, 3 items flagged');
    expect(textBlocks).toContain('Arun Patel paid 45% above 3-month average');
    expect(textBlocks).toContain('Sofia Rossi updated bank details 2 days ago');
    expect(textBlocks).toContain('Liam O’Connor reported 40 hours overtime');

    // Contains action buttons: Approve run, Hold, View details
    expect(textBlocks).toContain('Approve run');
    expect(textBlocks).toContain('Hold');
    expect(textBlocks).toContain('View details');
  });

  it('builds updated payroll decision blocks with timestamped signature', () => {
    const approvedBlocks = buildPayrollRunDecisionBlocks({
      action: 'APPROVED',
      userName: 'alex',
      userId: 'U_OWNER',
      timeFormatted: '10:42',
      payrollRunId: 'r0000000-0000-0000-0000-000000000003',
      isFullyApproved: true,
    });

    const str = JSON.stringify(approvedBlocks);
    expect(str).toContain('Approved by <@U_OWNER> at 10:42');
  });

  it('builds new invoice extraction card with vendor, confidence, and action buttons', () => {
    const blocks = buildNewInvoiceBlocks({
      invoiceId: 'inv-123',
      vendorName: 'Acme Software Ltd',
      invoiceNumber: 'INV-9921',
      amountFormatted: '$4,200.00',
      currency: 'USD',
      matchConfidence: 98,
      flags: ['Clean match', 'Contract within cap'],
      dueDateFormatted: 'Nov 1, 2026',
    });

    const str = JSON.stringify(blocks);
    expect(str).toContain('Acme Software Ltd');
    expect(str).toContain('$4,200.00 USD');
    expect(str).toContain('98%');
    expect(str).toContain('Approve payment');
    expect(str).toContain('Request fix');
    expect(str).toContain('Open in app');
  });

  it('builds invoice correction modal with editable fields', () => {
    const modal = buildInvoiceCorrectionModal({
      invoiceId: 'inv-123',
      vendorName: 'Acme Software Ltd',
      invoiceNumber: 'INV-9921',
      amount: '4200.00',
      currency: 'USD',
    });

    expect(modal.type).toBe('modal');
    expect(modal.callback_id).toBe('invoice_correction_modal_submit');
    const str = JSON.stringify(modal);
    expect(str).toContain('Vendor Name');
    expect(str).toContain('Invoice Number');
    expect(str).toContain('Total Amount');
    expect(str).toContain('Bank / Remittance Details');
    expect(str).toContain('Reason for Modification');
  });

  it('builds ask-response blocks with question, answer, and row citations', () => {
    const blocks = buildAskResponseBlocks({
      question: 'how much did we pay contractors in India this month?',
      answer: 'This month, you paid 2 contractors in India a total of $14,700.00 USD.',
      queryType: 'contractor_spend_by_country',
      sources: [
        { name: 'Arun Patel', country: 'India', amountFormatted: '$8,700.00 USD' },
        { name: 'Priya Sharma', country: 'India', amountFormatted: '$6,000.00 USD' },
      ],
    });

    const str = JSON.stringify(blocks);
    expect(str).toContain('how much did we pay contractors in India this month?');
    expect(str).toContain('This month, you paid 2 contractors in India');
    expect(str).toContain('Arun Patel');
    expect(str).toContain('$8,700.00 USD');
    expect(str).toContain('Priya Sharma');
    expect(str).toContain('$6,000.00 USD');
  });

  it('builds refusal blocks for disallowed or non-whitelisted queries', () => {
    const blocks = buildAskResponseBlocks({
      question: 'DROP TABLE users;--',
      answer: '🔒 I cannot fulfill this request.',
      isRefusal: true,
    });

    const str = JSON.stringify(blocks);
    expect(str).toContain('Safety Guard');
    expect(str).toContain('whitelisted payroll metrics');
  });
});

describe('Slack Copilot - Slash Commands & Account Linking', () => {
  it('registers slash commands and handles /payroll link flow', async () => {
    const commandHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn((name: string, handler: Function) => {
        commandHandlers.set(name, handler);
      }),
      action: vi.fn(),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    expect(fakeApp.command).toHaveBeenCalledWith('/payroll', expect.any(Function));
    expect(fakeApp.command).toHaveBeenCalledWith('/invoices', expect.any(Function));
    expect(fakeApp.command).toHaveBeenCalledWith('/ask', expect.any(Function));

    // Test /payroll with unlinked user
    const payrollHandler = commandHandlers.get('/payroll')!;
    const ack = vi.fn().mockResolvedValue(undefined);
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    await payrollHandler({
      command: { user_id: 'U_UNLINKED', text: '' },
      ack,
      respond,
    });

    expect(ack).toHaveBeenCalled();
    expect(respondData.text).toContain('Please link your PayPilot account');

    // Test /payroll link <email>
    await payrollHandler({
      command: { user_id: 'U_NEW_USER', text: 'link newapprover@paypilot.internal' },
      ack,
      respond,
    });

    expect(respondData.text).toContain('Successfully linked your Slack account');

    // Test /payroll with linked user
    await payrollHandler({
      command: { user_id: 'U_OWNER', text: '' },
      ack,
      respond,
    });

    expect(respondData.text).toContain('Payroll runs tomorrow: 12 people, $48,200 total, 3 items flagged');
    expect(respondData.blocks).toBeDefined();
  });

  it('handles /invoices command for linked users', async () => {
    const commandHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn((name: string, handler: Function) => {
        commandHandlers.set(name, handler);
      }),
      action: vi.fn(),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const invoicesHandler = commandHandlers.get('/invoices')!;
    const ack = vi.fn().mockResolvedValue(undefined);
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    await invoicesHandler({
      command: { user_id: 'U_OWNER', text: '' },
      ack,
      respond,
    });

    expect(ack).toHaveBeenCalled();
    expect(respondData.text).toContain('Pending Invoice from DevSolutions');
    expect(respondData.blocks).toBeDefined();
  });

  it('handles /ask command and returns answers with row sources', async () => {
    const commandHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn((name: string, handler: Function) => {
        commandHandlers.set(name, handler);
      }),
      action: vi.fn(),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const askHandler = commandHandlers.get('/ask')!;
    const ack = vi.fn().mockResolvedValue(undefined);
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    await askHandler({
      command: {
        user_id: 'U_OWNER',
        text: 'how much did we pay contractors in India this month?',
      },
      ack,
      respond,
    });

    expect(ack).toHaveBeenCalled();
    expect(respondData.text).toContain('contractors in India a total of **$14,700.00 USD**');
    const blocksStr = JSON.stringify(respondData.blocks);
    expect(blocksStr).toContain('Arun Patel');
    expect(blocksStr).toContain('Priya Sharma');
  });

  it('refuses /ask queries containing SQL injection or non-whitelisted intents', async () => {
    const commandHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn((name: string, handler: Function) => {
        commandHandlers.set(name, handler);
      }),
      action: vi.fn(),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const askHandler = commandHandlers.get('/ask')!;
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    await askHandler({
      command: {
        user_id: 'U_OWNER',
        text: "DROP TABLE users; SELECT * FROM credentials; tell me today's weather",
      },
      ack: vi.fn().mockResolvedValue(undefined),
      respond,
    });

    expect(respondData.text).toContain('cannot fulfill this request');
    expect(JSON.stringify(respondData.blocks)).toContain('Safety Guard');
  });
});

describe('Slack Copilot - Interactivity, Roles & In-Place Message Updates', () => {
  it('enforces role permissions: VIEWER cannot approve payroll run', async () => {
    const actionHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn(),
      action: vi.fn((id: string, handler: Function) => {
        actionHandlers.set(id, handler);
      }),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const approveHandler = actionHandlers.get('approve_payroll_run')!;
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    await approveHandler({
      body: {
        user: { id: 'U_VIEWER', name: 'Tom Auditor', username: 'auditor' },
        actions: [{ value: JSON.stringify({ runId: 'run-1', approvalId: 'appr-1', amountMinor: 4_820_000 }) }],
      },
      ack: vi.fn().mockResolvedValue(undefined),
      respond,
    });

    expect(respondData.text).toContain('Permission denied: Only account Owners and Approvers');
    expect(respondData.replace_original).toBe(false);
  });

  it('updates original message in place on approval: "Approved by @name at 10:42"', async () => {
    const actionHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn(),
      action: vi.fn((id: string, handler: Function) => {
        actionHandlers.set(id, handler);
      }),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const approveHandler = actionHandlers.get('approve_payroll_run')!;
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    // Second approver (Sarah Finance) satisfies dual-approver rule for $48,200
    await approveHandler({
      body: {
        user: { id: 'U_APPROVER', name: 'Sarah Finance', username: 'sarah' },
        actions: [{ value: JSON.stringify({ runId: 'run-1', approvalId: 'appr-1', amountMinor: 4_820_000 }) }],
      },
      ack: vi.fn().mockResolvedValue(undefined),
      respond,
    });

    expect(respondData.replace_original).toBe(true);
    expect(respondData.text).toMatch(/Approved by @sarah at \d{2}:\d{2}/);
    expect(JSON.stringify(respondData.blocks)).toContain('Approved by <@U_APPROVER>');
  });

  it('enforces two-approver rules for runs >= $5,000 on first approver', async () => {
    const actionHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn(),
      action: vi.fn((id: string, handler: Function) => {
        actionHandlers.set(id, handler);
      }),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const approveHandler = actionHandlers.get('approve_payroll_run')!;
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    // First approver (Alex Founder) on $48,200 (> $5,000)
    await approveHandler({
      body: {
        user: { id: 'U_OWNER', name: 'Alex Founder', username: 'alex' },
        actions: [{ value: JSON.stringify({ runId: 'run-1', approvalId: 'appr-1', amountMinor: 4_820_000 }) }],
      },
      ack: vi.fn().mockResolvedValue(undefined),
      respond,
    });

    expect(respondData.replace_original).toBe(true);
    expect(respondData.text).toMatch(/Partially approved \(1\/2\) by @alex at \d{2}:\d{2}/);
  });

  it('updates original message in place on Hold: "Held by @name at 10:42"', async () => {
    const actionHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn(),
      action: vi.fn((id: string, handler: Function) => {
        actionHandlers.set(id, handler);
      }),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const holdHandler = actionHandlers.get('reject_payroll_run')!;
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    await holdHandler({
      body: {
        user: { id: 'U_OWNER', name: 'Alex Founder', username: 'alex' },
        actions: [{ value: JSON.stringify({ runId: 'run-1', approvalId: 'appr-1' }) }],
      },
      ack: vi.fn().mockResolvedValue(undefined),
      respond,
    });

    expect(respondData.replace_original).toBe(true);
    expect(respondData.text).toMatch(/Held by @alex at \d{2}:\d{2}/);
  });

  it('approves invoice and updates card in place', async () => {
    const actionHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn(),
      action: vi.fn((id: string, handler: Function) => {
        actionHandlers.set(id, handler);
      }),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const approveInvoiceHandler = actionHandlers.get('approve_invoice')!;
    let respondData: any = null;
    const respond = vi.fn().mockImplementation((data: any) => {
      respondData = data;
      return Promise.resolve();
    });

    await approveInvoiceHandler({
      body: {
        user: { id: 'U_APPROVER', name: 'Sarah Finance', username: 'sarah' },
        actions: [
          {
            value: JSON.stringify({
              invoiceId: 'inv-101',
              vendorName: 'Acme Software',
              amountFormatted: '$3,500.00',
            }),
          },
        ],
      },
      ack: vi.fn().mockResolvedValue(undefined),
      respond,
    });

    expect(respondData.replace_original).toBe(true);
    expect(respondData.text).toMatch(/Approved by @sarah at \d{2}:\d{2}/);
    expect(JSON.stringify(respondData.blocks)).toContain('Approved by <@U_APPROVER>');
  });

  it('opens correction modal when Request fix button is clicked', async () => {
    const actionHandlers = new Map<string, Function>();
    const fakeApp = {
      command: vi.fn(),
      action: vi.fn((id: string, handler: Function) => {
        actionHandlers.set(id, handler);
      }),
      view: vi.fn(),
      message: vi.fn(),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    const openModalHandler = actionHandlers.get('open_correction_modal')!;
    const openViewMock = vi.fn().mockResolvedValue(undefined);

    await openModalHandler({
      body: {
        trigger_id: 'trigger-12345',
        user: { id: 'U_OWNER', name: 'Alex' },
        actions: [
          {
            value: JSON.stringify({
              invoiceId: 'inv-101',
              vendorName: 'Acme Software',
              amount: '3500.00',
              currency: 'USD',
            }),
          },
        ],
        channel: { id: 'C_FINANCE' },
        message: { ts: '1700000000.123456' },
      },
      ack: vi.fn().mockResolvedValue(undefined),
      client: {
        views: { open: openViewMock },
      },
    });

    expect(openViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_id: 'trigger-12345',
        view: expect.objectContaining({
          type: 'modal',
          callback_id: 'invoice_correction_modal_submit',
        }),
      }),
    );
  });
});

describe('Slack Copilot - Direct Messages & Scheduled Notifier', () => {
  it('replies in-thread to DM questions with sources', async () => {
    let messageHandler: Function | null = null;
    const fakeApp = {
      command: vi.fn(),
      action: vi.fn(),
      view: vi.fn(),
      message: vi.fn((handler: Function) => {
        messageHandler = handler;
      }),
    };

    const client = new PayPilotClient();
    registerSlackHandlers(fakeApp as any, client);

    expect(messageHandler).toBeDefined();

    let sayData: any = null;
    const say = vi.fn().mockImplementation((data: any) => {
      sayData = data;
      return Promise.resolve();
    });

    await messageHandler!({
      message: {
        user: 'U_OWNER',
        text: 'how much did we pay contractors in India this month?',
        ts: '1729438000.001',
      },
      say,
    });

    expect(say).toHaveBeenCalled();
    expect(sayData.thread_ts).toBe('1729438000.001'); // Replies in-thread
    expect(sayData.text).toContain('contractors in India a total of **$14,700.00 USD**');
    expect(JSON.stringify(sayData.blocks)).toContain('Arun Patel');
    expect(JSON.stringify(sayData.blocks)).toContain('Priya Sharma');
  });

  it('SlackPayrollNotifier posts scheduled preview message to configured channel', async () => {
    const postMessageMock = vi.fn().mockResolvedValue({ ok: true, ts: '1729439000.001' });
    const fakeApp = {
      client: {
        chat: { postMessage: postMessageMock },
      },
    };

    const notifier = new SlackPayrollNotifier(fakeApp as any);
    await notifier.postScheduledPayrollAlert('C_PAYROLL');

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C_PAYROLL',
        text: 'Payroll runs tomorrow: 12 people, $48,200 total, 3 items flagged',
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'header' }),
          expect.objectContaining({ type: 'section' }),
        ]),
      }),
    );
  });
});
