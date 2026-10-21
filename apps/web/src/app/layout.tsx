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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0f17] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
