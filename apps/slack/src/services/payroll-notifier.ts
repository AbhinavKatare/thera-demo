import type { App } from '@slack/bolt';
import { PayPilotClient, type UpcomingPayrollSummary, type PendingInvoiceItem } from './paypilot-client.js';
import { buildPayrollRunScheduledBlocks } from '../blocks/payroll-run.blocks.js';
import { buildNewInvoiceBlocks } from '../blocks/new-invoice.blocks.js';

export class SlackPayrollNotifier {
  constructor(
    private readonly app: App,
    private readonly client: PayPilotClient = new PayPilotClient(),
  ) {}

  /**
   * Posts the scheduled payroll preview message:
   * "Payroll runs tomorrow: 12 people, $48,200 total, 3 items flagged"
   */
  public async postScheduledPayrollAlert(
    channelId: string,
    customSummary?: Partial<UpcomingPayrollSummary>,
  ): Promise<unknown> {
    const summary = customSummary
      ? { ...(await this.client.getUpcomingPayrollSummary()), ...customSummary }
      : await this.client.getUpcomingPayrollSummary();

    const blocks = buildPayrollRunScheduledBlocks({
      payrollRunId: summary.runId,
      approvalId: summary.approvalId,
      totalPeople: summary.totalPeople,
      totalAmountFormatted: summary.totalAmountFormatted,
      flaggedItemsCount: summary.flaggedItemsCount,
      scheduledTimeDescription: 'runs tomorrow',
      anomalies: summary.anomalies,
    });

    const fallbackText = `Payroll runs tomorrow: ${summary.totalPeople} people, ${summary.totalAmountFormatted} total, ${summary.flaggedItemsCount} items flagged`;

    return this.app.client.chat.postMessage({
      channel: channelId,
      text: fallbackText,
      blocks: blocks as any,
    });
  }

  /**
   * Posts a new invoice extraction card with vendor, amount, match confidence, and action buttons.
   */
  public async postNewInvoiceAlert(channelId: string, invoice: PendingInvoiceItem): Promise<unknown> {
    const blocks = buildNewInvoiceBlocks({
      invoiceId: invoice.id,
      approvalId: invoice.approvalId,
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber,
      amountFormatted: invoice.amountFormatted,
      currency: invoice.currency,
      matchConfidence: invoice.matchConfidence,
      flags: invoice.flags,
      dueDateFormatted: invoice.dueDateFormatted,
    });

    const fallbackText = `New invoice from ${invoice.vendorName}: ${invoice.amountFormatted} (${invoice.matchConfidence}% confidence)`;

    return this.app.client.chat.postMessage({
      channel: channelId,
      text: fallbackText,
      blocks: blocks as any,
    });
  }
}
