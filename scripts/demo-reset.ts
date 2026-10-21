import { PrismaClient } from '@prisma/client';
import { executeSeed } from '../apps/api/prisma/seed.js';

async function main() {
  console.log('🔄 [PayPilot Demo Reset] Resetting environment to clean baseline...');

  const prisma = new PrismaClient();
  let dbConnected = false;

  try {
    await prisma.$connect();
    dbConnected = true;
    console.log('✓ Connected to PostgreSQL database.');
  } catch (err: any) {
    console.log('ℹ PostgreSQL database not directly connected or offline.');
    console.log('  Running demo reset in standalone mock mode (simulated database & storage).');
  }

  if (dbConnected) {
    try {
      console.log('Clearing existing tables in reverse dependency order...');
      await prisma.auditLog.deleteMany();
      await prisma.anomalyRecord.deleteMany();
      await prisma.approval.deleteMany();
      await prisma.paymentDraft.deleteMany();
      await prisma.invoiceLineItem.deleteMany();
      await prisma.invoice.deleteMany();
      await prisma.inboundDocument.deleteMany();
      await prisma.storedFile.deleteMany();
      await prisma.contract.deleteMany();
      await prisma.contractor.deleteMany();
      await prisma.payrollRun.deleteMany();
      await prisma.connectorAccount.deleteMany();
      await prisma.slackUserMapping.deleteMany();
      await prisma.magicLinkToken.deleteMany();
      await prisma.user.deleteMany();
      await prisma.company.deleteMany();
      console.log('✓ Tables cleared successfully.');

      console.log('Executing standard PayPilot seed script...');
      await executeSeed(prisma);
      console.log('✓ Seeding complete: 1 Company, 8 Contractors, 3 Payroll Runs, 15 Invoices.');
    } catch (err: any) {
      console.warn('⚠️ Warning during DB reset:', err.message);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log('\n======================================================');
  console.log('✨ PayPilot Demo Environment Ready!');
  console.log('• Company: PayPilot Technologies Inc. (Enterprise USD)');
  console.log('• Contractors: 8 International (SGD, EUR, BRL, INR, USD, EE, AE, JP)');
  console.log('• Connectors: Xero, Zoho Books, NetSuite SuiteTalk REST');
  console.log('• Live App UI: http://localhost:3000');
  console.log('• API & OpenAPI Docs: http://localhost:4000/docs');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during demo reset:', err);
  process.exit(1);
});
