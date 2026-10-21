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
} from 'lucide-react';
import {
  MOCK_PAYROLL_RUN,
  MOCK_ANOMALIES,
  MOCK_CONTRACTORS,
  MOCK_INTEGRATIONS,
} from '@/lib/mock-data';

export default function DashboardPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleSyncNow = () => {
    setIsSyncing(true);
    setSyncToast(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncToast('Dispatched sync job to pg-boss: 3 connectors synced successfully');
      setTimeout(() => setSyncToast(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome & Quick Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Payroll Operations
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
              Live Preview
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Next automated cycle execution scheduled for Oct 22, 2026 at 09:00 UTC.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] interactive-tap transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync All Connectors'}</span>
          </button>

          <Link
            href="/payroll"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 interactive-tap transition-all"
          >
            <span>Review Payroll Run</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {syncToast && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{syncToast}</span>
          </div>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Next Run Total */}
        <div className="card-surface rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Next Payroll Run</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-white tabular-nums">
              ${(MOCK_PAYROLL_RUN.grossMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-emerald-400 font-medium">8 contractors</span>
              <span>across 6 currencies</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Status: REVIEW</span>
            <span className="text-emerald-400 font-medium">1/2 Signatures</span>
          </div>
        </div>

        {/* Flagged Anomalies */}
        <div className="card-surface rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Flagged Anomalies</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-rose-400 tabular-nums">
              {MOCK_ANOMALIES.length} Items
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-rose-400 font-medium">1 Critical</span>
              <span>· 1 High · 1 Medium</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
            <Link href="/payroll" className="text-rose-400 hover:underline flex items-center gap-1">
              <span>Inspect flagged rules</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Invoices Needing Review */}
        <div className="card-surface rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Invoices In Review</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-white tabular-nums">
              1 Pending
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-amber-400 font-medium">Sofia Rossi (IT)</span>
              <span>· €5,082.00</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
            <Link href="/invoices" className="text-amber-400 hover:underline flex items-center gap-1">
              <span>Split-screen OCR check</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Active Contractors */}
        <div className="card-surface rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Contractors</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight text-white tabular-nums">
              {MOCK_CONTRACTORS.length} Global
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>SG, IT, BR, IN, US, EE, AE, JP</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
            <Link href="/contractors" className="text-slate-400 hover:text-white flex items-center gap-1">
              <span>View directory</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Upcoming Run Banner + Accounting Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Upcoming Run Anomaly Highlights */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
              <span>Upcoming Run Anomaly Inspector</span>
            </h2>
            <Link href="/payroll" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
              <span>View full timeline</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {MOCK_ANOMALIES.map((anomaly) => (
              <div
                key={anomaly.id}
                className={`rounded-xl border p-4 transition-all interactive-tap ${
                  anomaly.severity === 'CRITICAL'
                    ? 'border-rose-500/20 bg-rose-950/10 hover:border-rose-500/30'
                    : anomaly.severity === 'HIGH'
                    ? 'border-amber-500/20 bg-amber-950/10 hover:border-amber-500/30'
                    : 'border-white/10 bg-slate-900/40 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                        anomaly.severity === 'CRITICAL'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          : anomaly.severity === 'HIGH'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {anomaly.severity}
                    </span>
                    <span className="text-xs font-semibold text-slate-100">{anomaly.summary}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{anomaly.rule}</span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {anomaly.explanation}
                </p>

                {anomaly.suggestedAction && (
                  <div className="mt-3 rounded-lg bg-black/30 p-2.5 text-[11px] text-emerald-300 border border-emerald-500/15 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span><strong>Suggested:</strong> {anomaly.suggestedAction}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Connector Sync Status & Slack Copilot */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-400" />
                <span>Accounting Sync</span>
              </h2>
              <Link href="/integrations" className="text-xs text-emerald-400 hover:underline">
                Manage
              </Link>
            </div>

            <div className="space-y-2.5">
              {MOCK_INTEGRATIONS.map((connector) => (
                <div
                  key={connector.provider}
                  className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 flex items-center justify-between hover:border-white/10 transition-colors"
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-medium text-slate-200">{connector.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{connector.tenantName}</div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                      {connector.status}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-1">
                      {connector.rateLimitRemaining} req left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Slack Copilot Interaction Card */}
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-teal-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Slack Scheduled Alert</span>
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 font-mono">
                Tomorrow 09:00
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              &quot;Payroll runs tomorrow: 8 people, $48,200 total, 3 items flagged. Approve run, Hold, or View details.&quot;
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-center text-xs font-semibold text-slate-950 hover:bg-emerald-400 interactive-tap transition-all"
              >
                Approve Run
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-all"
              >
                Hold
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
