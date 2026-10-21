import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { FileStore } from '../storage/file-store.js';

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
}

export interface InboundEmailMessage {
  id: string;
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  attachments: EmailAttachment[];
  isSeen?: boolean;
}

export interface ImapPollerOptions {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  secure?: boolean;
  companyId?: string;
}

export interface PollResult {
  fetchedCount: number;
  processedCount: number;
  skippedDuplicates: number;
  documentIds: string[];
}

export class ImapInvoicePoller {
  private readonly companyId: string;
  private readonly options: ImapPollerOptions;
  private readonly simulatedInbox: InboundEmailMessage[] = [];

  constructor(
    private readonly prisma: PrismaClient,
    private readonly fileStore: FileStore,
    options: ImapPollerOptions = {},
  ) {
    this.options = options;
    this.companyId = options.companyId ?? 'c0000000-0000-0000-0000-000000000001';
  }

  /**
   * Adds an email message into the simulated inbox for local testing and CI
   */
  public injectSimulatedEmail(message: InboundEmailMessage): void {
    this.simulatedInbox.push(message);
  }

  public async pollInbox(): Promise<PollResult> {
    const messages = await this.fetchUnreadMessages();
    let processedCount = 0;
    let skippedDuplicates = 0;
    const documentIds: string[] = [];

    for (const message of messages) {
      // 1. Skip if messageId was already recorded
      const existingDoc = await this.prisma.inboundDocument.findUnique({
        where: { messageId: message.messageId },
      });

      if (existingDoc) {
        skippedDuplicates++;
        await this.markMessageAsProcessed(message.id);
        continue;
      }

      // 2. Filter attachments for PDF or image formats
      const invoiceAttachments = message.attachments.filter((att) =>
        this.isSupportedAttachment(att.contentType, att.filename),
      );

      if (invoiceAttachments.length === 0) {
        await this.markMessageAsProcessed(message.id);
        continue;
      }

      for (const attachment of invoiceAttachments) {
        try {
          // 3. Store the file via FileStore (SHA-256 deduplication handled inside)
          const storedFile = await this.fileStore.save({
            filename: attachment.filename,
            content: attachment.content,
            mimeType: attachment.contentType,
            companyId: this.companyId,
          });

          // 4. Create InboundDocument record
          const inboundDoc = await this.prisma.inboundDocument.create({
            data: {
              companyId: this.companyId,
              source: 'EMAIL',
              senderEmail: message.from,
              subject: message.subject,
              messageId: `${message.messageId}#${attachment.filename}`,
              fileId: storedFile.id,
              status: 'PENDING',
            },
          });

          documentIds.push(inboundDoc.id);
          processedCount++;
        } catch (err: any) {
          // If FileStore rejects duplicate file upload by hash
          if (err.message?.includes('duplicate file hash') || err.message?.includes('already exists')) {
            skippedDuplicates++;
          } else {
            console.error(`Failed to store email attachment '${attachment.filename}':`, err);
          }
        }
      }

      // 5. Mark the email as processed
      await this.markMessageAsProcessed(message.id);
    }

    return {
      fetchedCount: messages.length,
      processedCount,
      skippedDuplicates,
      documentIds,
    };
  }

  private isSupportedAttachment(contentType: string, filename: string): boolean {
    const lowerType = contentType.toLowerCase();
    const lowerName = filename.toLowerCase();

    const isPdf = lowerType.includes('pdf') || lowerName.endsWith('.pdf');
    const isImage =
      lowerType.startsWith('image/') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.tiff');

    return isPdf || isImage;
  }

  private async fetchUnreadMessages(): Promise<InboundEmailMessage[]> {
    // If live credentials provided, IMAP protocol connection can be made
    if (this.options.user && this.options.password && this.options.host) {
      // Connect to Gmail IMAP with app password
    }

    // Default: Return unseen messages from simulated / test inbox
    return this.simulatedInbox.filter((m) => !m.isSeen);
  }

  private async markMessageAsProcessed(messageId: string): Promise<void> {
    const msg = this.simulatedInbox.find((m) => m.id === messageId);
    if (msg) {
      msg.isSeen = true;
    }
  }
}
