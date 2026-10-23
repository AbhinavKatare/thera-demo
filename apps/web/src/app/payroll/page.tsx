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
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Bulk approve clean items
  const handleBulkApproveClean = () => {
    const updated = contractors.map((c: PayrollContractorItem) =>
      c.approvalStatus === 'CLEAN_READY' ? { ...c, approvalStatus: 'APPROVED' } : c
    );
    setContractors(updated);
    setToastMessage({
      message: 'Approved 5 clean contractor payments ($35,118.00). Flagged anomalies retained on review hold.',
      type: 'success',
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApproveItem = (id: string) => {
    const updated = contractors.map((c: PayrollContractorItem) =>
      c.id === id ? { ...c, approvalStatus: 'APPROVED' } : c
    );
    setContractors(updated);
    setToastMessage({
      message: 'Item approved and released for execution.',
      type: 'success',
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleHoldItem = (id: string) => {
    const updated = contractors.map((c: PayrollContractorItem) =>
      c.id === id ? { ...c, approvalStatus: 'HELD_FOR_REVIEW' } : c
    );
    setContractors(updated);
    setToastMessage({
      message: 'Item placed on review hold.',
      type: 'warning',
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAcknowledgeAnomaly = (id: string) => {
    setToastMessage({
      message: `Anomaly ${id} acknowledged by Alex Rivera. Action logged to immutable audit trail.`,
      type: 'info',
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Run Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
              <Banknote className="h-5 w-5 text-[#111111]" />
              <span>Upcoming Payroll Run</span>
            </h1>
            <span className="status-pill status-pill-warning">
              Cycle: Oct 01 - Oct 15
            </span>
          </div>
          <p className="mt-1 text-xs text-[#77756F]">
            Automated preview generated via pg-boss nightly cron. 2 of 2 approvers required for amounts &gt; $5,000.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleBulkApproveClean}
          className="btn-primary interactive-tap"
        >
          <FileCheck2 className="h-4 w-4" />
          <span>Bulk Approve Clean Items (5)</span>
        </button>
      </div>

      {toastMessage && (
        <div
          className={`rounded-[8px] p-3 text-xs flex items-center gap-2 border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toastMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-white text-[#111111] border-[#E8E6E0] shadow-sm'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* High-Level Run Breakdown Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-editorial p-5">
          <div className="text-xs font-medium text-[#77756F]">Total Run Commitment</div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-[#111111] tabular-nums">
            ${(payrollRun.grossMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
          <div className="mt-1 text-[11px] text-[#77756F]">Net payout: ${(payrollRun.netMinor / 100).toFixed(2)}</div>
        </div>

        <div className="card-editorial p-5">
          <div className="text-xs font-medium text-[#77756F]">Multi-Approver State</div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-amber-700 tabular-nums">
            {payrollRun.approvalsReceived} of {payrollRun.approvalsRequired} Signatures
          </div>
          <div className="mt-1 text-[11px] text-[#77756F]">
            Alex Rivera (Signed) · Sarah Jenkins (Pending)
          </div>
        </div>

        <div className="card-editorial p-5">
          <div className="text-xs font-medium text-[#77756F]">Anomaly Quarantine</div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-rose-700 tabular-nums">
            {anomalies.length} Flagged / 8 Total
          </div>
          <div className="mt-1 text-[11px] text-[#77756F]">
            Hold prevents disbursement to unverified items
          </div>
        </div>
      </div>

      {/* Flagged Anomalies Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>AI Anomaly Scanner &amp; Plain-English Explanations</span>
          </h2>
          <span className="text-xs text-[#77756F]">Strict rules: LLM never hallucinates numbers</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {anomalies.map((anom: AnomalyItem) => (
            <div
              key={anom.id}
              className="card-editorial p-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`status-pill ${
                      anom.severity === 'CRITICAL'
                        ? 'status-pill-error'
                        : anom.severity === 'HIGH'
                        ? 'status-pill-warning'
                        : 'status-pill-neutral'
                    }`}
                  >
                    {anom.severity}
                  </span>
                  <span className="text-[10px] font-mono text-[#77756F]">{anom.rule}</span>
                </div>

                <h3 className="text-xs font-semibold text-[#111111]">{anom.summary}</h3>
                <p className="text-[11px] leading-relaxed text-[#55534E]">{anom.explanation}</p>
              </div>

              {anom.suggestedAction && (
                <div className="mt-4 pt-3 border-t border-[#E8E6E0] space-y-2">
                  <div className="text-[10px] text-[#111111] flex items-center gap-1.5 font-medium">
                    <Sparkles className="h-3 w-3 text-[#111111]" />
                    <span><strong>Suggested:</strong> {anom.suggestedAction}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAnomaly(anom.id)}
                      className="btn-secondary flex-1 py-1 text-[11px]"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setToastMessage({
                          message: `Payout hold affirmed on anomaly ${anom.id}.`,
                          type: 'warning',
                        });
                        setTimeout(() => setToastMessage(null), 3000);
                      }}
                      className="btn-destructive py-1 text-[11px]"
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
        <h2 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-[#111111]" />
          <span>Contractor Line Items ({contractors.length})</span>
        </h2>

        <div className="card-editorial overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8E6E0] bg-[#F7F6F2]/70 text-[#77756F] font-medium text-[11px]">
                <tr>
                  <th className="py-3 pl-4 pr-3">Contractor</th>
                  <th className="py-3 px-3">Country / Currency</th>
                  <th className="py-3 px-3">Payout Coordinates</th>
                  <th className="py-3 px-3 text-right">Cycle Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 pl-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E6E0] text-[#111111]">
                {contractors.map((c: PayrollContractorItem) => (
                  <tr key={c.id} className="hover:bg-[#F7F6F2]/60 transition-colors">
                    <td className="py-3.5 pl-4 pr-3">
                      <div className="font-medium text-[#111111]">{c.name}</div>
                      <div className="text-[11px] text-[#77756F]">{c.email}</div>
                      {c.flagReason && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-700">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          <span>{c.flagReason}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-mono text-[#55534E]">{c.currency} ({c.country})</div>
                    </td>

                    <td className="py-3.5 px-3 text-[11px] font-mono text-[#77756F]">
                      {c.bankDetails?.accountNumber || c.bankDetails?.iban || 'Verified'}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-semibold tabular-nums text-[#111111]">
                      {c.currency} {(c.payoutAmountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`status-pill ${
                          c.approvalStatus === 'APPROVED'
                            ? 'status-pill-success'
                            : c.approvalStatus === 'HELD_FOR_REVIEW'
                            ? 'status-pill-error'
                            : 'status-pill-warning'
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
                            className="rounded-[6px] bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        ) : (
                          <button
                            onClick={() => handleHoldItem(c.id)}
                            className="rounded-[6px] border border-[#E8E6E0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#77756F] hover:bg-[#F7F6F2] transition-colors cursor-pointer"
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
      </div>

      {/* Approval Timeline Component */}
      <div className="card-editorial p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#111111]" />
          <span>Lifecycle Timeline &amp; State Machine Progression</span>
        </h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E8E6E0]">
          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-[#F7F6F2]" />
            <div>
              <div className="text-xs font-semibold text-[#111111]">1. Draft Generated by Nightly Worker</div>
              <p className="text-[11px] text-[#77756F]">pg-boss executed preview cron: 8 contractors aggregated from Thera adapter.</p>
              <div className="text-[10px] text-[#77756F] font-mono mt-0.5">Oct 19, 2026 06:00 UTC</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-[#F7F6F2]" />
            <div>
              <div className="text-xs font-semibold text-[#111111]">2. Deterministic &amp; AI Anomaly Detection Complete</div>
              <p className="text-[11px] text-[#77756F]">Evaluated 6 rules: 3 anomalies detected and flagged for human sign-off.</p>
              <div className="text-[10px] text-[#77756F] font-mono mt-0.5">Oct 19, 2026 06:01 UTC</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-[#F7F6F2]" />
            <div>
              <div className="text-xs font-semibold text-[#111111]">3. Primary Director Approval (1 of 2)</div>
              <p className="text-[11px] text-[#77756F]">Alex Rivera confirmed preliminary budget from Slack Copilot.</p>
              <div className="text-[10px] text-[#77756F] font-mono mt-0.5">Oct 20, 2026 15:10 UTC</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-4 ring-[#F7F6F2] animate-pulse" />
            <div>
              <div className="text-xs font-semibold text-amber-800">4. Awaiting Secondary Approver (Amount &gt; $5,000 Rule)</div>
              <p className="text-[11px] text-[#77756F]">Awaiting Sarah Jenkins (Finance Lead) sign-off on rate spike anomaly.</p>
              <div className="text-[10px] text-amber-700 font-mono mt-0.5">Status: PENDING_APPROVAL</div>
            </div>
          </div>

          <div className="relative flex items-start gap-3 opacity-40">
            <div className="absolute -left-6 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#E8E6E0] ring-4 ring-[#F7F6F2]" />
            <div>
              <div className="text-xs font-semibold text-[#77756F]">5. Automatic Payout Execution &amp; Accounting Sync</div>
              <p className="text-[11px] text-[#77756F]">Thera batch payment creation, followed by Xero/Zoho/NetSuite bill reconciliation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
