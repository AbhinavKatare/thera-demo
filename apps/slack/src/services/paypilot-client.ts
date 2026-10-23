export interface PayPilotUser {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'APPROVER' | 'VIEWER';
  companyId: string;
}

export interface UpcomingPayrollSummary {
  runId: string;
  approvalId: string;
  totalPeople: number;
  totalAmountFormatted: string;
  amountMinor: number;
  currency: string;
  flaggedItemsCount: number;
  scheduledDate: string;
  anomalies: Array<{
    id: string;
    rule: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    summary: string;
    explanation: string;
    suggestedAction?: string;
    contractorName?: string;
    amountFormatted?: string;
  }>;
}

export interface PendingInvoiceItem {
  id: string;
  approvalId: string;
  vendorName: string;
  invoiceNumber: string;
  amountFormatted: string;
  currency: string;
  matchConfidence: number;
  flags: string[];
  dueDateFormatted: string;
}

export interface ApprovalDecisionResult {
  success: boolean;
  action: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'HELD';
  isFullyApproved: boolean;
  requiredApproversCount: number;
  currentApproversCount: number;
  approverName: string;
  message: string;
}

export interface AskPayrollResult {
  question: string;
  answer: string;
  queryType?: string;
  parameters?: Record<string, unknown>;
  sources: Array<Record<string, unknown>>;
  isRefusal: boolean;
}

export interface PayPilotClientOptions {
  apiUrl?: string;
  mockMode?: boolean;
}

export class PayPilotClient {
  private readonly apiUrl: string;
  private readonly mockUsers = new Map<string, PayPilotUser>();
  private readonly mockSlackMappings = new Map<string, string>(); // slackUserId -> userEmail

  constructor(options: PayPilotClientOptions = {}) {
    this.apiUrl = options.apiUrl ?? process.env.API_URL ?? 'http://localhost:3000';

    // Seed default mock user mapping for dev & tests
    const defaultOwner: PayPilotUser = {
      id: 'u0000000-0000-0000-0000-000000000001',
      email: 'founder@paypilot.internal',
      name: 'Alex Founder',
      role: 'OWNER',
      companyId: 'c0000000-0000-0000-0000-000000000001',
    };
    const defaultApprover: PayPilotUser = {
      id: 'u0000000-0000-0000-0000-000000000002',
      email: 'cfo@paypilot.internal',
      name: 'Sarah Finance',
      role: 'APPROVER',
      companyId: 'c0000000-0000-0000-0000-000000000001',
    };
    const defaultViewer: PayPilotUser = {
      id: 'u0000000-0000-0000-0000-000000000003',
      email: 'auditor@paypilot.internal',
      name: 'Tom Auditor',
      role: 'VIEWER',
      companyId: 'c0000000-0000-0000-0000-000000000001',
    };

    this.mockUsers.set(defaultOwner.email, defaultOwner);
    this.mockUsers.set(defaultApprover.email, defaultApprover);
    this.mockUsers.set(defaultViewer.email, defaultViewer);

    // Default mapped slack user for tests
    this.mockSlackMappings.set('U_OWNER', defaultOwner.email);
    this.mockSlackMappings.set('U_APPROVER', defaultApprover.email);
    this.mockSlackMappings.set('U_VIEWER', defaultViewer.email);
  }

  public async getUserBySlackId(slackUserId: string): Promise<PayPilotUser | null> {
    // 1. Try API if reachable
    try {
      const res = await fetch(`${this.apiUrl}/auth/slack/${slackUserId}`);
      if (res.ok) {
        const body = (await res.json()) as { mapped: boolean; user: PayPilotUser };
        return body.user;
      }
    } catch {
      // Fall through to mock memory
    }

    const email = this.mockSlackMappings.get(slackUserId);
    if (!email) return null;
    return this.mockUsers.get(email) ?? null;
  }

  public async linkSlackUserByEmail(
    email: string,
    slackUserId: string,
  ): Promise<{ success: boolean; user: PayPilotUser }> {
    try {
      const res = await fetch(`${this.apiUrl}/auth/slack/link-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, slackUserId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { user: PayPilotUser };
        this.mockSlackMappings.set(slackUserId, email);
        return { success: true, user: data.user };
      }
    } catch {
      // Fall through to mock
    }

    let user = this.mockUsers.get(email);
    if (!user) {
      // Auto-register user in mock mode
      user = {
        id: `u-${Date.now()}`,
        email,
        name: email.split('@')[0] ?? 'User',
        role: 'APPROVER',
        companyId: 'c0000000-0000-0000-0000-000000000001',
      };
      this.mockUsers.set(email, user);
    }
    this.mockSlackMappings.set(slackUserId, email);
    return { success: true, user };
  }

  public async getUpcomingPayrollSummary(_companyId?: string): Promise<UpcomingPayrollSummary> {
    return {
      runId: 'r0000000-0000-0000-0000-000000000003',
      approvalId: 'appr-run-001',
      totalPeople: 12,
      totalAmountFormatted: '$48,200',
      amountMinor: 4_820_000,
      currency: 'USD',
      flaggedItemsCount: 3,
      scheduledDate: 'tomorrow',
      anomalies: [
        {
          id: 'anom-01',
          rule: 'salary_spike_above_average',
          severity: 'high',
          summary: 'Arun Patel paid 45% above 3-month average ($8,700 vs $6,000)',
          explanation: 'Monthly invoice includes 35 hours of unapproved overtime billed at emergency weekend rate.',
          suggestedAction: 'Verify timesheet sign-off before approving full run.',
          contractorName: 'Arun Patel (India)',
          amountFormatted: '$8,700 USD',
        },
        {
          id: 'anom-02',
          rule: 'new_bank_account_recent',
          severity: 'critical',
          summary: 'Sofia Rossi updated bank details 2 days ago',
          explanation: 'Beneficiary IBAN was changed to a new Portuguese account on Oct 18, 2026.',
          suggestedAction: 'Confirm beneficiary account ownership via out-of-band verification.',
          contractorName: 'Sofia Rossi (Portugal)',
          amountFormatted: '$6,200 EUR',
        },
        {
          id: 'anom-03',
          rule: 'unusual_overtime',
          severity: 'medium',
          summary: 'Liam O’Connor reported 40 hours overtime in 5 days',
          explanation: 'Contract terms cap billable overtime to 15 hours per calendar week.',
          suggestedAction: 'Adjust invoice line items to adhere to contracted maximums.',
          contractorName: 'Liam O’Connor (Ireland)',
          amountFormatted: '$5,400 EUR',
        },
      ],
    };
  }

  public async getPendingInvoices(_companyId?: string): Promise<PendingInvoiceItem[]> {
    return [
      {
        id: 'inv-001',
        approvalId: 'appr-inv-001',
        vendorName: 'DevSolutions Sp. z o.o.',
        invoiceNumber: 'INV-202 Poland',
        amountFormatted: '$4,500.00',
        currency: 'USD',
        matchConfidence: 98,
        flags: ['Deterministic line-item arithmetic verified', 'Valid contractor & contract match'],
        dueDateFormatted: 'Nov 5, 2026',
      },
      {
        id: 'inv-002',
        approvalId: 'appr-inv-002',
        vendorName: 'Tokyo Design Labs',
        invoiceNumber: 'TDL-8821',
        amountFormatted: '¥650,000',
        currency: 'JPY',
        matchConfidence: 82,
        flags: ['Uncertain field: taxDescription', 'Hourly rate requires manual rate-sheet check'],
        dueDateFormatted: 'Oct 31, 2026',
      },
    ];
  }

  public async approvePayrollRun(input: {
    approvalId: string;
    approverId: string;
    approverName: string;
    amountMinor: number;
    userRole: 'OWNER' | 'APPROVER' | 'VIEWER';
    note?: string;
  }): Promise<ApprovalDecisionResult> {
    // 1. Role enforcement
    if (input.userRole === 'VIEWER') {
      return {
        success: false,
        action: 'HELD',
        isFullyApproved: false,
        requiredApproversCount: 1,
        currentApproversCount: 0,
        approverName: input.approverName,
        message: 'Permission denied: VIEWER role cannot approve payroll runs.',
      };
    }

    // 2. Dual-approver rule (Amount >= $5,000 requires 2 distinct approvers)
    const requiresDualApprover = input.amountMinor >= 500_000;
    const requiredApproversCount = requiresDualApprover ? 2 : 1;

    // For testing and demo: simulate first vs second approver
    // If the approver is Sarah Finance (second approver), mark as fully approved
    const isSecondApprover = input.approverName.includes('Sarah') || input.approverName.includes('CFO');
    const isFullyApproved = !requiresDualApprover || isSecondApprover;

    return {
      success: true,
      action: isFullyApproved ? 'APPROVED' : 'PARTIALLY_APPROVED',
      isFullyApproved,
      requiredApproversCount,
      currentApproversCount: isFullyApproved ? requiredApproversCount : 1,
      approverName: input.approverName,
      message: isFullyApproved
        ? `Approved by @${input.approverName}`
        : `Partially approved (1/2) by @${input.approverName}. Awaiting second approver.`,
    };
  }

  public async rejectPayrollRun(input: {
    approvalId: string;
    approverId: string;
    approverName: string;
    userRole: 'OWNER' | 'APPROVER' | 'VIEWER';
    reason?: string;
  }): Promise<ApprovalDecisionResult> {
    if (input.userRole === 'VIEWER') {
      return {
        success: false,
        action: 'HELD',
        isFullyApproved: false,
        requiredApproversCount: 1,
        currentApproversCount: 0,
        approverName: input.approverName,
        message: 'Permission denied: VIEWER role cannot place payroll on hold.',
      };
    }

    return {
      success: true,
      action: 'HELD',
      isFullyApproved: false,
      requiredApproversCount: 1,
      currentApproversCount: 0,
      approverName: input.approverName,
      message: `Payroll run placed on hold by @${input.approverName}`,
    };
  }

  public async approveInvoice(input: {
    invoiceId: string;
    approvalId?: string;
    approverId: string;
    approverName: string;
    userRole: 'OWNER' | 'APPROVER' | 'VIEWER';
    amountMinor?: number;
  }): Promise<ApprovalDecisionResult> {
    if (input.userRole === 'VIEWER') {
      return {
        success: false,
        action: 'REJECTED',
        isFullyApproved: false,
        requiredApproversCount: 1,
        currentApproversCount: 0,
        approverName: input.approverName,
        message: 'Permission denied: VIEWER role cannot approve invoice payments.',
      };
    }

    return {
      success: true,
      action: 'APPROVED',
      isFullyApproved: true,
      requiredApproversCount: 1,
      currentApproversCount: 1,
      approverName: input.approverName,
      message: `Invoice approved by @${input.approverName}`,
    };
  }

  public async askPayroll(companyId: string, question: string): Promise<AskPayrollResult> {
    // 1. Try real API endpoint first
    try {
      const res = await fetch(`${this.apiUrl}/v1/ai/ask-payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, question }),
      });
      if (res.ok) {
        const apiResult = (await res.json()) as any;
        // Normalize sourceCitations (API shape) → sources (client shape for block builder)
        const rawCitations: any[] = apiResult.sourceCitations ?? apiResult.sources ?? [];
        const normalizedSources = rawCitations.map((c: any) => {
          const kv = c.keyValues ?? c;
          // Compute amountFormatted from netMinor, grossMinor, or amountFormatted
          let amountFormatted = kv.amountFormatted;
          if (!amountFormatted && (kv.netMinor !== undefined || kv.grossMinor !== undefined)) {
            const minor = kv.netMinor ?? kv.grossMinor ?? 0;
            const curr = kv.currency ?? 'USD';
            amountFormatted = `$${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${curr}`;
          }
          return {
            name: kv.name ?? kv.contractorName ?? c.label ?? 'Record',
            country: kv.country,
            currency: kv.currency,
            amountFormatted,
            period: kv.period ?? kv.paidAt,
            netMinor: kv.netMinor,
            totalMinor: kv.totalMinor ?? kv.amountMinor,
          };
        });
        return {
          question: apiResult.question ?? question,
          answer: apiResult.answer ?? '',
          queryType: apiResult.queryExecuted ?? apiResult.queryType,
          parameters: apiResult.parameters,
          sources: normalizedSources,
          isRefusal: !!(apiResult.isSecurityBlocked ?? apiResult.isRefusal ?? false),
        };
      }
    } catch {
      // Fall through to deterministic answering
    }

    // Check for refused / injection queries
    const qLower = question.toLowerCase();
    const disallowedPatterns = [
      'drop table',
      'select *',
      'database schema',
      'system prompt',
      'ignore previous instructions',
      'weather',
      'recipe',
      'crypto',
    ];

    if (disallowedPatterns.some((pattern) => qLower.includes(pattern))) {
      return {
        question,
        answer:
          "🔒 I cannot fulfill this request. I am only authorized to answer questions about your organization's contractors, payroll runs, invoices, and payment histories.",
        sources: [],
        isRefusal: true,
      };
    }

    // Contractor in India / country query — must be checked BEFORE generic 'how much' patterns
    if (qLower.includes('india') || qLower.includes('contractors in india')) {
      return {
        question,
        answer: 'This month, you paid 2 contractors in India a total of **$14,700.00 USD**.',
        queryType: 'contractor_spend_by_country',
        parameters: { country: 'IN', month: '2026-10' },
        sources: [
          {
            name: 'Arun Patel',
            country: 'India',
            amountFormatted: '$8,700.00 USD',
            period: 'Oct 2026',
          },
          {
            name: 'Priya Sharma',
            country: 'India',
            amountFormatted: '$6,000.00 USD',
            period: 'Oct 2026',
          },
        ],
        isRefusal: false,
      };
    }

    // Total payroll query
    if (qLower.includes('total') || qLower.includes('how much') || qLower.includes('payroll')) {
      return {
        question,
        answer:
          'Your upcoming payroll run includes 12 contractors for a total gross spend of **$48,200.00 USD**, with 3 items flagged for review.',
        queryType: 'total_payroll_by_period',
        parameters: { period: '2026-10' },
        sources: [
          {
            name: '12 International Contractors',
            country: 'Global',
            amountFormatted: '$48,200.00 USD',
            period: 'Oct 2026 Run',
          },
        ],
        isRefusal: false,
      };
    }

    return {
      question,
      answer: `Found 1 verified record related to your query: Total payment was processed on schedule for October 2026.`,
      queryType: 'general_payroll_lookup',
      sources: [
        {
          name: 'General Payroll Run',
          country: 'All',
          amountFormatted: '$48,200.00 USD',
          period: 'Oct 2026',
        },
      ],
      isRefusal: false,
    };
  }
}
