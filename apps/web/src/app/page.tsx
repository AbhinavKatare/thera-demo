'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  AlertTriangle,
  Receipt,
  Users,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Clock,
  Layers,
  ChevronRight,
  Check,
  Pause,
} from 'lucide-react';
import {
  MOCK_PAYROLL_RUN,
  MOCK_ANOMALIES,
  MOCK_CONTRACTORS,
  MOCK_INTEGRATIONS,
} from '@/lib/mock-data';

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const [payrollStatus, setPayrollStatus] = useState<string>('REVIEW');
  const [signaturesCount, setSignaturesCount] = useState<number>(1);

  const handleSyncNow = () => {
    setIsSyncing(true);
    setActionToast({ message: 'Dispatching background sync to pg-boss workers...', type: 'info' });
    setTimeout(() => {
      setIsSyncing(false);
      setActionToast({ message: 'Synchronized Oracle NetSuite, Xero, and Zoho Books successfully.', type: 'success' });
      setTimeout(() => setActionToast(null), 4000);
    }, 1200);
  };

  const handleApprovePayroll = () => {
    if (signaturesCount >= 2) {
      setActionToast({ message: 'Payroll run is already fully approved.', type: 'info' });
      return;
    }
    const nextCount = signaturesCount + 1;
    setSignaturesCount(nextCount);
    if (nextCount >= 2) {
      setPayrollStatus('APPROVED');
      setActionToast({
        message: 'Second executive approval recorded. Payout ledger cleared for Thera disbursement.',
        type: 'success',
      });
    } else {
      setActionToast({
        message: 'First approval recorded (Alex Rivera). Awaiting secondary approver for >$5,000 threshold.',
        type: 'info',
      });
    }
    setTimeout(() => setActionToast(null), 4500);
  };

  const handleHoldPayroll = () => {
    setPayrollStatus('HOLD');
    setActionToast({
      message: 'Payroll execution placed on hold. Slack alerts broadcasted to #payroll-alerts.',
      type: 'warning',
    });
    setTimeout(() => setActionToast(null), 4000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome & Quick Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[#111111]">
              Payroll Operations
            </h1>
            <span className="status-pill status-pill-success">
              Live Preview
            </span>
          </div>
          <p className="mt-1 text-xs text-[#77756F]">
            Next automated cycle execution scheduled for Oct 22, 2026 at 09:00 UTC.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="btn-secondary interactive-tap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-[#111111]' : 'text-[#77756F]'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync All Connectors'}</span>
          </button>

          <Link href="/payroll" className="btn-primary interactive-tap">
            <span>Review Payroll Run</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {actionToast && (
        <div
          className={`rounded-[8px] p-3 text-xs flex items-center justify-between border transition-all ${
            actionToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : actionToast.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-[#FFFFFF] text-[#111111] border-[#E8E6E0] shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionToast.message}</span>
          </div>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Next Run Total */}
        <div className="card-editorial-hover p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#77756F]">Next Payroll Run</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F7F6F2] text-[#111111] border border-[#E8E6E0]">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-[#111111] tabular-nums">
              ${(MOCK_PAYROLL_RUN.grossMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#77756F]">
              <span className="text-[#111111] font-medium">8 contractors</span>
              <span>across 6 currencies</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E6E0] flex items-center justify-between text-[11px]">
            <span className="text-[#77756F]">Status: {payrollStatus}</span>
            <span className="text-emerald-700 font-semibold">{signaturesCount}/2 Signatures</span>
          </div>
        </div>

        {/* Flagged Anomalies */}
        <div className="card-editorial-hover p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#77756F]">Flagged Anomalies</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-amber-700 tabular-nums">
              {MOCK_ANOMALIES.length} Items
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#77756F]">
              <span className="text-rose-700 font-medium">1 Critical</span>
              <span>· 1 High · 1 Medium</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E6E0] flex items-center justify-between text-[11px]">
            <Link href="/payroll" className="text-amber-800 font-medium hover:underline flex items-center gap-1">
              <span>Inspect flagged rules</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Invoices Needing Review */}
        <div className="card-editorial-hover p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#77756F]">Invoices In Review</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F7F6F2] text-[#111111] border border-[#E8E6E0]">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-[#111111] tabular-nums">
              1 Pending
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#77756F]">
              <span className="text-[#111111] font-medium">Sofia Rossi (IT)</span>
              <span>· €4,200.00</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E6E0] flex items-center justify-between text-[11px]">
            <Link href="/invoices" className="text-[#111111] font-medium hover:underline flex items-center gap-1">
              <span>Split-screen OCR check</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Active Contractors */}
        <div className="card-editorial-hover p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#77756F]">Active Contractors</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F7F6F2] text-[#111111] border border-[#E8E6E0]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-[#111111] tabular-nums">
              {MOCK_CONTRACTORS.length} Global
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#77756F]">
              <span>SG, IT, BR, IN, US, EE, AE, JP</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E8E6E0] flex items-center justify-between text-[11px]">
            <Link href="/contractors" className="text-[#77756F] hover:text-[#111111] flex items-center gap-1">
              <span>View directory</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Upcoming Run Anomaly Highlights + Accounting Sync */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Anomaly Inspector */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#111111]" />
              <span>Upcoming Run Anomaly Inspector</span>
            </h2>
            <Link href="/payroll" className="text-xs text-[#111111] font-medium hover:underline flex items-center gap-1">
              <span>View full timeline</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {MOCK_ANOMALIES.map((anomaly) => (
              <div
                key={anomaly.id}
                className="card-editorial p-4 hover:border-[#D6D4CE] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`status-pill ${
                        anomaly.severity === 'CRITICAL'
                          ? 'status-pill-error'
                          : anomaly.severity === 'HIGH'
                          ? 'status-pill-warning'
                          : 'status-pill-neutral'
                      }`}
                    >
                      {anomaly.severity}
                    </span>
                    <span className="text-xs font-semibold text-[#111111]">{anomaly.summary}</span>
                  </div>
                  <span className="text-[10px] text-[#77756F] font-mono">{anomaly.rule}</span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-[#55534E]">
                  {anomaly.explanation}
                </p>

                {anomaly.suggestedAction && (
                  <div className="mt-3 rounded-[6px] bg-[#F7F6F2] p-2.5 text-[11px] text-[#111111] border border-[#E8E6E0] flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#111111]" />
                    <span><strong>Suggested:</strong> {anomaly.suggestedAction}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Connector Sync Status & Scheduled Alert */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#111111]" />
                <span>Accounting Sync</span>
              </h2>
              <Link href="/integrations" className="text-xs text-[#111111] font-medium hover:underline">
                Manage
              </Link>
            </div>

            <div className="space-y-2.5">
              {MOCK_INTEGRATIONS.map((connector) => (
                <div
                  key={connector.provider}
                  className="card-editorial p-3 flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-medium text-[#111111]">{connector.name}</div>
                    <div className="text-[10px] text-[#77756F] truncate">{connector.tenantName}</div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="status-pill status-pill-success">
                      {connector.status}
                    </span>
                    <span className="text-[9px] text-[#77756F] mt-1">
                      {connector.rateLimitRemaining} req left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Slack Copilot Interaction Card */}
          <div className="card-editorial p-4 space-y-3 bg-[#FFFFFF]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#111111]" />
                <span>Slack Scheduled Alert</span>
              </span>
              <span className="rounded bg-[#F7F6F2] border border-[#E8E6E0] px-1.5 py-0.5 text-[10px] text-[#55534E] font-mono">
                Tomorrow 09:00
              </span>
            </div>
            <p className="text-xs text-[#55534E] leading-relaxed">
              &quot;Payroll runs tomorrow: 8 people, $48,200 total, 3 items flagged. Approve run, Hold, or View details.&quot;
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleApprovePayroll}
                className="btn-primary flex-1"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{signaturesCount >= 2 ? 'Approved' : 'Approve Run'}</span>
              </button>
              <button
                type="button"
                onClick={handleHoldPayroll}
                className="btn-secondary"
              >
                <Pause className="h-3.5 w-3.5 text-[#77756F]" />
                <span>Hold</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
