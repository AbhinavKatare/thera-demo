'use client';

import React, { useState, useEffect } from 'react';
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItem) {
        setSelectedItem(null);
        setActionType(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

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
    setToast({
      message: `Item ${selectedItem.id} marked as ${newStatus}. Write-once audit log recorded.`,
      type: actionType === 'APPROVE' ? 'success' : 'error',
    });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#111111]" />
            <span>Multi-Signature Approvals Queue</span>
          </h1>
          <p className="mt-1 text-xs text-[#77756F]">
            Enforcing approval state machine: DRAFT → PENDING_APPROVAL → APPROVED | REJECTED → SENT.
          </p>
        </div>

        {/* 2-Approver Rule Notice Pill */}
        <div className="flex items-center gap-2 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
          <span>Amount &gt; $5,000 Rule: Dual approvers required before release.</span>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-[8px] p-3 text-xs flex items-center gap-2 border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8E6E0] pb-2">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'PENDING'
              ? 'bg-[#111111] text-white shadow-sm'
              : 'text-[#77756F] hover:text-[#111111] hover:bg-white'
          }`}
        >
          Pending Signatures ({approvals.filter((a) => a.status === 'PENDING_APPROVAL').length})
        </button>
        <button
          onClick={() => setActiveTab('APPROVED')}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'APPROVED'
              ? 'bg-[#111111] text-white shadow-sm'
              : 'text-[#77756F] hover:text-[#111111] hover:bg-white'
          }`}
        >
          Cleared &amp; Approved
        </button>
        <button
          onClick={() => setActiveTab('ALL')}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-[#111111] text-white shadow-sm'
              : 'text-[#77756F] hover:text-[#111111] hover:bg-white'
          }`}
        >
          All Items
        </button>
      </div>

      {/* Approvals Table */}
      <div className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8E6E0] bg-[#F7F6F2]/70 text-[#77756F] font-medium text-[11px]">
              <tr>
                <th className="py-3 pl-4 pr-3">Target Entity</th>
                <th className="py-3 px-3">Requested By</th>
                <th className="py-3 px-3">Signatures Required</th>
                <th className="py-3 px-3 text-right">Commitment</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 pl-3 pr-4 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E6E0] text-[#111111]">
              {filtered.map((item) => {
                const needsTwo = item.requiredApproversCount > 1;

                return (
                  <tr key={item.id} className="hover:bg-[#F7F6F2]/60 transition-colors">
                    <td className="py-3.5 pl-4 pr-3">
                      <div className="font-mono font-medium text-[#111111]">{item.targetId}</div>
                      <div className="text-[10px] text-[#77756F]">{item.targetType}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="text-[#111111]">{item.requestedBy}</div>
                      <div className="text-[10px] text-[#77756F]">{item.createdAt.slice(0, 10)}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#111111]">
                          {item.approvers.length} / {item.requiredApproversCount}
                        </span>
                        {needsTwo && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 border border-amber-200">
                            &gt; $5k Rule
                          </span>
                        )}
                      </div>
                      {item.approvers.length > 0 && (
                        <div className="text-[10px] text-[#77756F] truncate max-w-xs">
                          Signed: {item.approvers.join(', ')}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-semibold tabular-nums text-[#111111]">
                      {item.currency} {(item.amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`status-pill ${
                          item.status === 'APPROVED'
                            ? 'status-pill-success'
                            : item.status === 'REJECTED'
                            ? 'status-pill-error'
                            : 'status-pill-warning'
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
                            className="rounded-[6px] bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleOpenDecision(item, 'REJECT')}
                            className="rounded-[6px] bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#77756F]">Completed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Modal with Notes */}
      {selectedItem && actionType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in"
          onClick={() => {
            setSelectedItem(null);
            setActionType(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-[12px] border border-[#E8E6E0] bg-white shadow-[0_20px_60px_rgba(17,17,17,0.14)] p-6 text-[#111111] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                {actionType === 'APPROVE' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-700" />
                )}
                <span>Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}</span>
              </h3>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setActionType(null);
                }}
                className="rounded-[6px] p-1 text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 text-xs space-y-1">
              <div><strong>Target:</strong> {selectedItem.targetId} ({selectedItem.targetType})</div>
              <div><strong>Amount:</strong> {selectedItem.currency} ${(selectedItem.amountMinor / 100).toFixed(2)}</div>
              <div><strong>Actor:</strong> Sarah Jenkins (Finance Lead / Approver Role)</div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#111111] mb-1">
                Audit Decision Note (Immutable)
              </label>
              <textarea
                rows={3}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="State justification or verification steps undertaken..."
                className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] p-2.5 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setActionType(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecision}
                className={actionType === 'APPROVE' ? 'btn-primary' : 'btn-destructive'}
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
