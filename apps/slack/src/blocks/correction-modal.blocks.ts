export type SlackModalView = Record<string, unknown>;

export interface CorrectionModalInitialData {
  invoiceId: string;
  vendorName?: string;
  invoiceNumber?: string;
  amount?: string;
  currency?: string;
  dueDate?: string;
  bankDetails?: string;
  channelId?: string;
  messageTs?: string;
}

export function buildInvoiceCorrectionModal(data: CorrectionModalInitialData): SlackModalView {
  const metadata = JSON.stringify({
    invoiceId: data.invoiceId,
    channelId: data.channelId,
    messageTs: data.messageTs,
  });

  return {
    type: 'modal',
    callback_id: 'invoice_correction_modal_submit',
    private_metadata: metadata,
    title: {
      type: 'plain_text',
      text: 'Correct Invoice Fields',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Save & Resubmit',
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
          text: `Review and adjust extracted data for Invoice \`${data.invoiceId.slice(0, 8)}\`. Updated values will be verified and stored in the audit log.`,
        },
      },
      {
        type: 'input',
        block_id: 'vendor_name_block',
        element: {
          type: 'plain_text_input',
          action_id: 'vendor_name_input',
          initial_value: data.vendorName ?? '',
          placeholder: {
            type: 'plain_text',
            text: 'e.g. Acme Corp',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Vendor Name',
        },
      },
      {
        type: 'input',
        block_id: 'invoice_number_block',
        element: {
          type: 'plain_text_input',
          action_id: 'invoice_number_input',
          initial_value: data.invoiceNumber ?? '',
          placeholder: {
            type: 'plain_text',
            text: 'e.g. INV-2026-001',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Invoice Number',
        },
      },
      {
        type: 'input',
        block_id: 'amount_block',
        element: {
          type: 'plain_text_input',
          action_id: 'amount_input',
          initial_value: data.amount ?? '',
          placeholder: {
            type: 'plain_text',
            text: 'e.g. 3500.00',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Total Amount',
        },
      },
      {
        type: 'input',
        block_id: 'currency_block',
        element: {
          type: 'plain_text_input',
          action_id: 'currency_input',
          initial_value: data.currency ?? 'USD',
          placeholder: {
            type: 'plain_text',
            text: 'USD, EUR, GBP, CAD...',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Currency Code (ISO)',
        },
      },
      {
        type: 'input',
        block_id: 'due_date_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'due_date_input',
          initial_value: data.dueDate ?? '',
          placeholder: {
            type: 'plain_text',
            text: 'YYYY-MM-DD',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Due Date',
        },
      },
      {
        type: 'input',
        block_id: 'bank_details_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'bank_details_input',
          initial_value: data.bankDetails ?? '',
          placeholder: {
            type: 'plain_text',
            text: 'IBAN, routing, or SWIFT BIC',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Bank / Remittance Details',
        },
      },
      {
        type: 'input',
        block_id: 'correction_reason_block',
        element: {
          type: 'plain_text_input',
          action_id: 'correction_reason_input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'Explain why these fields were adjusted (required for compliance audit trail)...',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Reason for Modification',
        },
      },
    ],
  };
}
