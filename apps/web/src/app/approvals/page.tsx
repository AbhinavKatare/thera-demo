'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { MOCK_APPROVALS } from '@/lib/mock-data';
import { ApprovalItem } from '@/lib/api-client';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>(MOCK_APPROVALS);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const filtered = approvals.filter((item) => {
    if (activeTab === 'PENDING') return item.status === 'PENDING_APPROVAL' || item.status === 'DRAFT';
    if (activeTab === 'APPROVED') return item.status === 'APPROVED';
    return true;
  });

  const handleOpenDecision = (item: ApprovalItem, type: 'APPROVE' | 'REJECT') => {
    setSelectedItem(item);
    setActionType(type);
    setDecisionNote(type === 'APPROVE' ? 'Approved after anomaly verification.' : 'Rejected due to validation mismatch.');
  };

  const handleConfirmDecision = () => {
    if (!selectedItem || !actionType) return;

    const newStatus: ApprovalItem['status'] = actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = approvals.map((a) =>
      a.id === selectedItem.id
        ? {
            ...a,
            status: newStatus,
            decisionNote,
            decidedAt: new Date().toISOString(),
            approvers: actionType === 'APPROVE' ? [...a.approvers, 'Sarah Jenkins (Finance Lead)'] : a.approvers,
          }
        : a
    );

    setApprovals(updated);
    setSelectedItem(null);
    setActionType(null);
    setToast(`Item ${selectedItem.id} marked as ${newStatus}. Audit log written.`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            <span>Multi-Signature Approvals Queue</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Enforcing approval state machine: DRAFT → PENDING_APPROVAL → APPROVED | REJECTED → SENT.
          </p>
        </div>

        {/* 2-Approver Rule Notice Pill */}
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Amount &gt; $5,000 Rule: Dual approvers required before release.</span>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'PENDING'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Pending Signatures ({approvals.filter((a) => a.status === 'PENDING_APPROVAL').length})
        </button>
        <button
          onClick={() => setActiveTab('APPROVED')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'APPROVED'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Cleared &amp; Approved
        </button>
        <button
          onClick={() => setActiveTab('ALL')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'ALL'
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Items
        </button>
      </div>

      {/* Approvals Table */}
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/5 bg-white/[0.02] text-slate-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 pl-4 pr-3 font-semibold">Target Entity</th>
              <th className="py-3 px-3 font-semibold">Requested By</th>
              <th className="py-3 px-3 font-semibold">Signatures Required</th>
              <th className="py-3 px-3 font-semibold text-right">Commitment</th>
              <th className="py-3 px-3 font-semibold text-center">Status</th>
              <th className="py-3 pl-3 pr-4 font-semibold text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {filtered.map((item) => {
              const needsTwo = item.requiredApproversCount > 1;

              return (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 pl-4 pr-3">
                    <div className="font-mono font-medium text-white">{item.targetId}</div>
                    <div className="text-[10px] text-slate-400">{item.targetType}</div>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="text-slate-200">{item.requestedBy}</div>
                    <div className="text-[10px] text-slate-400">{item.createdAt.slice(0, 10)}</div>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-200">
                        {item.approvers.length} / {item.requiredApproversCount}
                      </span>
                      {needsTwo && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/20">
                          &gt; $5k Rule
                        </span>
                      )}
                    </div>
                    {item.approvers.length > 0 && (
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">
                        Signed: {item.approvers.join(', ')}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-3 text-right font-mono font-semibold tabular-nums text-white">
                    {item.currency} {(item.amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
                        item.status === 'APPROVED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : item.status === 'REJECTED'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="py-3.5 pl-3 pr-4 text-right">
                    {item.status === 'PENDING_APPROVAL' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDecision(item, 'APPROVE')}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                        >
                          <Check className="h-3 w-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleOpenDecision(item, 'REJECT')}
                          className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
                        >
                          <X className="h-3 w-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">Completed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Decision Modal with Notes */}
      {selectedItem && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {actionType === 'APPROVE' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-400" />
                )}
                <span>Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}</span>
              </h3>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setActionType(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 text-xs space-y-1">
              <div><strong>Target:</strong> {selectedItem.targetId} ({selectedItem.targetType})</div>
              <div><strong>Amount:</strong> {selectedItem.currency} ${(selectedItem.amountMinor / 100).toFixed(2)}</div>
              <div><strong>Actor:</strong> Sarah Jenkins (Finance Lead / Approver Role)</div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Audit Decision Note (Immutable)
              </label>
              <textarea
                rows={3}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="State justification or verification steps undertaken..."
                className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setActionType(null);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecision}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-slate-950 transition-colors ${
                  actionType === 'APPROVE'
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : 'bg-rose-500 hover:bg-rose-400 text-white'
                }`}
              >
                Confirm &amp; Write Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
