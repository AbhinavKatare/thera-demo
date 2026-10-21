'use client';

import React, { useState } from 'react';
import {
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  UserCheck,
  FileCheck2,
} from 'lucide-react';
import { MOCK_PAYROLL_RUN, MOCK_ANOMALIES, MOCK_CONTRACTORS } from '@/lib/mock-data';
import { ContractorItem, AnomalyItem } from '@/lib/api-client';

interface PayrollContractorItem extends ContractorItem {
  isFlagged: boolean;
  flagReason?: string;
  payoutAmountMinor: number;
  approvalStatus: string;
}

export default function PayrollPage() {
  const [payrollRun] = useState(MOCK_PAYROLL_RUN);
  const [anomalies] = useState(MOCK_ANOMALIES);
  const [contractors, setContractors] = useState<PayrollContractorItem[]>(
    MOCK_CONTRACTORS.map((c: ContractorItem, i: number) => ({
      ...c,
      isFlagged: i < 3,
      flagReason:
        i === 0
          ? 'Identical invoice number previously settled'
          : i === 1
          ? 'Payout coordinates changed within 36 hours'
          : i === 4
          ? 'Amount 42% above 3-month rolling median'
          : undefined,
      payoutAmountMinor:
        i === 0 ? 520000 : i === 1 ? 508200 : i === 2 ? 320000 : i === 3 ? 580000 : i === 4 ? 780000 : 410000,
      approvalStatus: i < 3 ? 'HELD_FOR_REVIEW' : 'CLEAN_READY',
    }))
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bulk approve clean items
  const handleBulkApproveClean = () => {
    const updated = contractors.map((c: PayrollContractorItem) =>
      c.approvalStatus === 'CLEAN_READY' ? { ...c, approvalStatus: 'APPROVED' } : c
    );
    setContractors(updated);
    setToastMessage('Approved 5 clean contractor payments ($35,118.00). Flagged anomalies retained on review hold.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApproveItem = (id: string) => {
    const updated = contractors.map((c: PayrollContractorItem) => (c.id === id ? { ...c, approvalStatus: 'APPROVED' } : c));
    setContractors(updated);
    setToastMessage('Item approved and signed.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleHoldItem = (id: string) => {
    const updated = contractors.map((c: PayrollContractorItem) => (c.id === id ? { ...c, approvalStatus: 'HELD_FOR_REVIEW' } : c));
    setContractors(updated);
    setToastMessage('Item placed on hold.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Run Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Banknote className="h-6 w-6 text-emerald-400" />
              <span>Upcoming Payroll Run</span>
            </h1>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/25">
              Cycle: Oct 01 - Oct 15
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Automated preview generated via pg-boss nightly cron. 2 of 2 approvers required for amounts &gt; $5,000.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleBulkApproveClean}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 interactive-tap transition-all shadow-lg shadow-emerald-500/10"
        >
          <FileCheck2 className="h-4 w-4" />
          <span>Bulk Approve Clean Items (5)</span>
        </button>
      </div>

      {toastMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* High-Level Run Breakdown Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-surface rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-400">Total Run Commitment</div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            ${(payrollRun.grossMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Net payout: ${(payrollRun.netMinor / 100).toFixed(2)}</div>
        </div>

        <div className="card-surface rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-400">Multi-Approver State</div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-amber-300 tabular-nums">
            {payrollRun.approvalsReceived} of {payrollRun.approvalsRequired} Signatures
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Alex Rivera (Signed) · Sarah Jenkins (Pending)
          </div>
        </div>

        <div className="card-surface rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-400">Anomaly Quarantine</div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-rose-400 tabular-nums">
            {anomalies.length} Flagged / 8 Total
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Hold prevents disbursement to unverified items
          </div>
        </div>
      </div>

      {/* Flagged Anomalies Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>AI Anomaly Scanner &amp; Plain-English Explanations</span>
          </h2>
          <span className="text-xs text-slate-400">Strict rules: LLM never hallucinates numbers</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {anomalies.map((anom: AnomalyItem) => (
            <div
              key={anom.id}
              className={`rounded-2xl border p-4 flex flex-col justify-between ${
                anom.severity === 'CRITICAL'
                  ? 'border-rose-500/30 bg-rose-950/20'
                  : anom.severity === 'HIGH'
                  ? 'border-amber-500/30 bg-amber-950/20'
                  : 'border-white/10 bg-slate-900/40'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      anom.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : anom.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {anom.severity}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{anom.rule}</span>
                </div>

                <h3 className="text-xs font-semibold text-white">{anom.summary}</h3>
                <p className="text-[11px] leading-relaxed text-slate-300">{anom.explanation}</p>
              </div>

              {anom.suggestedAction && (
                <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                  <div className="text-[10px] text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-emerald-400" />
                    <span><strong>Suggested:</strong> {anom.suggestedAction}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      className="flex-1 rounded-lg bg-white/10 py-1 text-center text-[10px] font-medium text-slate-200 hover:bg-white/20 transition-colors"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
                    >
                      Hold Payout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Line-Item Payout Table with Individual Approval State */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-400" />
          <span>Contractor Line Items ({contractors.length})</span>
        </h2>

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 bg-white/[0.02] text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 pl-4 pr-3 font-semibold">Contractor</th>
                <th className="py-3 px-3 font-semibold">Country / Currency</th>
                <th className="py-3 px-3 font-semibold">Payout Coordinates</th>
                <th className="py-3 px-3 font-semibold text-right">Cycle Amount</th>
                <th className="py-3 px-3 font-semibold text-center">Status</th>
                <th className="py-3 pl-3 pr-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {contractors.map((c: PayrollContractorItem) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 pl-4 pr-3">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="text-[10px] text-slate-400">{c.email}</div>
                    {c.flagReason && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        <span>{c.flagReason}</span>
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="font-mono text-slate-300">{c.currency} ({c.country})</div>
                  </td>

                  <td className="py-3.5 px-3 text-[11px] font-mono text-slate-400">
                    {c.bankDetails?.accountNumber || c.bankDetails?.iban || 'Verified'}
                  </td>

                  <td className="py-3.5 px-3 text-right font-mono font-semibold tabular-nums text-white">
                    {c.currency} {(c.payoutAmountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
                        c.approvalStatus === 'APPROVED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : c.approvalStatus === 'HELD_FOR_REVIEW'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}
                    >
                      {c.approvalStatus}
                    </span>
                  </td>

                  <td className="py-3.5 pl-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.approvalStatus !== 'APPROVED' ? (
                        <button
                          onClick={() => handleApproveItem(c.id)}
                          className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleHoldItem(c.id)}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/10 transition-colors"
                        >
                          Hold
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Timeline Component */}
      <div className="card-surface rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-400" />
          <span>Lifecycle Timeline &amp; State Machine Progression</span>
        </h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-[#0b0f17]" />
            <div>
              <div className="text-xs font-semibold text-white">1. Draft Generated by Nightly Worker</div>
              <p className="text-[11px] text-slate-400">pg-boss executed preview cron: 8 contractors aggregated from Thera adapter.</p>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Oct 19, 2026 06:00 UTC</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-[#0b0f17]" />
            <div>
              <div className="text-xs font-semibold text-white">2. Deterministic &amp; AI Anomaly Detection Complete</div>
              <p className="text-[11px] text-slate-400">Evaluated 6 rules: 3 anomalies detected and flagged for human sign-off.</p>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Oct 19, 2026 06:01 UTC</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-[#0b0f17]" />
            <div>
              <div className="text-xs font-semibold text-white">3. Primary Director Approval (1 of 2)</div>
              <p className="text-[11px] text-slate-400">Alex Rivera confirmed preliminary budget from Slack Copilot.</p>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Oct 20, 2026 15:10 UTC</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 ring-4 ring-[#0b0f17] animate-pulse" />
            <div>
              <div className="text-xs font-semibold text-amber-300">4. Awaiting Secondary Approver (Amount &gt; $5,000 Rule)</div>
              <p className="text-[11px] text-slate-400">Awaiting Sarah Jenkins (Finance Lead) sign-off on rate spike anomaly.</p>
              <div className="text-[10px] text-amber-400 font-mono mt-0.5">Status: PENDING_APPROVAL</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3 opacity-40">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-600 ring-4 ring-[#0b0f17]" />
            <div>
              <div className="text-xs font-semibold text-slate-400">5. Automatic Payout Execution &amp; Accounting Sync</div>
              <p className="text-[11px] text-slate-500">Thera batch payment creation, followed by Xero/Zoho/NetSuite bill reconciliation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
