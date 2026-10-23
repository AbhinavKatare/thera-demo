import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/app-shell';

export const metadata: Metadata = {
  title: 'PayPilot | Slack-first Payroll Copilot & Invoice Automation',
  description: 'Automated contractor invoice intake, anomaly detection, approval state machines, and accounting sync.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F7F6F2] text-[#111111] antialiased selection:bg-[#111111] selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
