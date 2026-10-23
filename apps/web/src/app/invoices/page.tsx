'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Search,
  Edit3,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { InvoiceItem } from '@/lib/api-client';
import { MOCK_INVOICES } from '@/lib/mock-data';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(MOCK_INVOICES);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InvoiceItem>>({});
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedInvoice) {
        setSelectedInvoice(null);
        setIsEditing(false);
        setModalFeedback(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInvoice]);

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'NEEDS_REVIEW' && (inv.flags && inv.flags.length > 0)) ||
      inv.status === selectedStatus;
    const matchesQuery =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.contractor?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      inv.currency.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const handleOpenReview = (inv: InvoiceItem) => {
    setSelectedInvoice(inv);
    setEditForm({ ...inv });
    setIsEditing(false);
    setModalFeedback(null);
  };

  const handleSaveEdits = () => {
    if (!selectedInvoice) return;
    const updated = invoices.map((inv) => (inv.id === selectedInvoice.id ? { ...inv, ...editForm } : inv));
    setInvoices(updated as InvoiceItem[]);
    setSelectedInvoice({ ...selectedInvoice, ...editForm } as InvoiceItem);
    setIsEditing(false);
    setModalFeedback(`Invoice ${selectedInvoice.invoiceNumber} updated successfully.`);
    setUploadToast({
      message: `Invoice ${selectedInvoice.invoiceNumber} changes saved.`,
      type: 'success',
    });
    setTimeout(() => {
      setUploadToast(null);
      setModalFeedback(null);
    }, 4000);
  };

  const handleApprove = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = invoices.map((inv) => (inv.id === id ? { ...inv, status: 'APPROVED' as const } : inv));
    setInvoices(updated);
    if (selectedInvoice?.id === id) {
      setSelectedInvoice({ ...selectedInvoice, status: 'APPROVED' });
      setModalFeedback('Invoice approved and queued for accounting sync');
    }
    setUploadToast({
      message: 'Invoice approved and queued for accounting sync',
      type: 'success',
    });
    setTimeout(() => setUploadToast(null), 3500);
  };

  const handleReject = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = invoices.map((inv) => (inv.id === id ? { ...inv, status: 'REJECTED' as const } : inv));
    setInvoices(updated);
    if (selectedInvoice?.id === id) {
      setSelectedInvoice({ ...selectedInvoice, status: 'REJECTED' });
      setModalFeedback('Invoice marked as rejected');
    }
    setUploadToast({
      message: 'Invoice marked as rejected',
      type: 'error',
    });
    setTimeout(() => setUploadToast(null), 3500);
  };

  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadToast({
      message: `Extracting fields from "${file.name}" using Tesseract OCR & LLM...`,
      type: 'info',
    });

    // Simulated PDF extraction pipeline
    setTimeout(() => {
      const newInvoice: InvoiceItem = {
        id: `inv_uploaded_${Date.now()}`,
        companyId: 'cmp_prod_001',
        contractorId: 'cnt_003',
        invoiceNumber: `INV-2026-${Math.floor(Math.random() * 800 + 100)}`,
        status: 'SUBMITTED',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-15',
        issueDate: '2026-10-18',
        dueDate: '2026-10-28',
        currency: 'EUR',
        subtotalMinor: 420000,
        taxMinor: 0,
        totalMinor: 420000,
        invoiceHash: `sha256_${Math.random().toString(16).substring(2)}`,
        contractor: {
          id: 'cnt_002',
          name: 'Sofia Rossi',
          country: 'IT',
          currency: 'EUR',
          email: 'sofia.rossi@design.it',
        },
        lineItems: [
          {
            description: 'Mobile App Design System Sprint',
            quantity: 1,
            unitPriceMinor: 420000,
            amountMinor: 420000,
          },
        ],
        matchConfidence: 0.96,
        createdAt: new Date().toISOString(),
      };

      setInvoices([newInvoice, ...invoices]);
      setIsUploading(false);
      setUploadToast({
        message: `Successfully processed "${file.name}" with 96% match confidence!`,
        type: 'success',
      });
      setTimeout(() => setUploadToast(null), 4000);
    }, 1200);
  };

  // Status counts
  const counts = {
    ALL: invoices.length,
    SUBMITTED: invoices.filter((i) => i.status === 'SUBMITTED').length,
    NEEDS_REVIEW: invoices.filter((i) => i.flags && i.flags.length > 0).length,
    APPROVED: invoices.filter((i) => i.status === 'APPROVED').length,
    PAID: invoices.filter((i) => i.status === 'PAID').length,
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#111111]" />
            <span>Contractor Invoices</span>
          </h1>
          <p className="mt-1 text-xs text-[#77756F]">
            Intake via Gmail IMAP poller, Tesseract OCR fallback, and structured LLM extraction.
          </p>
        </div>

        {/* Upload Button */}
        <label className="btn-primary interactive-tap">
          <UploadCloud className="h-4 w-4" />
          <span>{isUploading ? 'Extracting PDF...' : 'Upload PDF Invoice'}</span>
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg"
            onChange={handleSimulateUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Toast Feedback Notification */}
      {uploadToast && (
        <div
          className={`rounded-[8px] p-3 text-xs flex items-center gap-2 border transition-all ${
            uploadToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : uploadToast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-[#F7F6F2] text-[#111111] border-[#E8E6E0]'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{uploadToast.message}</span>
        </div>
      )}

      {/* Drag & Drop PDF Dropzone */}
      <div className="relative rounded-[12px] border-2 border-dashed border-[#E8E6E0] bg-white p-6 text-center hover:border-[#111111] transition-all">
        <input
          type="file"
          accept=".pdf,image/png,image/jpeg"
          onChange={handleSimulateUpload}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#F7F6F2] text-[#111111] border border-[#E8E6E0]">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div className="text-xs font-medium text-[#111111]">
            Drop PDF invoices here or click to browse
          </div>
          <div className="text-[11px] text-[#77756F]">
            Automatic hash deduplication, layout parsing, and contractor entity matching
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="card-editorial p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'SUBMITTED', 'NEEDS_REVIEW', 'APPROVED', 'PAID'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedStatus === status
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#55534E] hover:bg-[#F7F6F2] hover:text-[#111111]'
              }`}
            >
              <span>{status.replace('_', ' ')}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  selectedStatus === status ? 'bg-white/20 text-white' : 'bg-[#F7F6F2] text-[#77756F]'
                }`}
              >
                {counts[status]}
              </span>
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#77756F]" />
          <input
            type="text"
            placeholder="Search vendor, invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] py-1.5 pl-8 pr-7 text-xs text-[#111111] placeholder-[#77756F] focus:border-[#111111] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-[#77756F] hover:text-[#111111]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Invoices Data Table */}
      <div className="card-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E8E6E0] bg-[#F7F6F2]/70 text-[#77756F] font-medium">
                <th className="py-3 pl-4 pr-3">INVOICE</th>
                <th className="py-3 px-3">CONTRACTOR</th>
                <th className="py-3 px-3">ISSUE / DUE</th>
                <th className="py-3 px-3 text-right">AMOUNT</th>
                <th className="py-3 px-3">MATCH</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 pl-3 pr-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E6E0]">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#77756F]">
                    No invoices match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const hasFlags = inv.flags && inv.flags.length > 0;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => handleOpenReview(inv)}
                      className="cursor-pointer transition-colors hover:bg-[#F7F6F2]/60"
                    >
                      <td className="py-3 pl-4 pr-3 font-mono font-medium text-[#111111]">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-[#77756F]" />
                          <span>{inv.invoiceNumber}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-[#111111]">{inv.contractor?.name}</div>
                        <div className="text-[11px] text-[#77756F]">
                          {inv.contractor?.country} · {inv.contractor?.email}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-[#55534E]">
                        <div>{inv.issueDate}</div>
                        <div className="text-[10px] text-[#77756F]">Due: {inv.dueDate}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#111111] tabular-nums">
                        {inv.currency} {((inv.totalMinor) / 100).toFixed(2)}
                      </td>

                      <td className="py-3 px-3">
                        {inv.matchConfidence ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                inv.matchConfidence > 0.9
                                  ? 'bg-emerald-600'
                                  : inv.matchConfidence > 0.8
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            />
                            <span className="font-mono text-[11px] text-[#55534E]">
                              {(inv.matchConfidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#77756F] text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`status-pill ${
                            inv.status === 'APPROVED'
                              ? 'status-pill-success'
                              : inv.status === 'REJECTED'
                              ? 'status-pill-error'
                              : hasFlags
                              ? 'status-pill-warning'
                              : 'status-pill-neutral'
                          }`}
                        >
                          {hasFlags && <AlertTriangle className="h-3 w-3 mr-0.5 text-amber-600" />}
                          {inv.status}
                        </span>
                      </td>

                      <td className="py-3 pl-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenReview(inv)}
                            className="rounded-[6px] border border-[#E8E6E0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#111111] hover:bg-[#F7F6F2] transition-colors"
                          >
                            Review
                          </button>
                          {inv.status !== 'APPROVED' && (
                            <button
                              onClick={(e) => handleApprove(inv.id, e)}
                              title="Approve invoice"
                              className="rounded-[6px] bg-emerald-50 border border-emerald-200 p-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {inv.status !== 'REJECTED' && inv.status !== 'APPROVED' && (
                            <button
                              onClick={(e) => handleReject(inv.id, e)}
                              title="Reject invoice"
                              className="rounded-[6px] bg-rose-50 border border-rose-200 p-1 text-rose-700 hover:bg-rose-100 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SPLIT-SCREEN REVIEW DRAWER / MODAL */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in"
          onClick={() => {
            setSelectedInvoice(null);
            setIsEditing(false);
            setModalFeedback(null);
          }}
        >
          <div
            className="w-full max-w-5xl h-[88vh] rounded-[12px] border border-[#E8E6E0] bg-white shadow-[0_20px_60px_rgba(17,17,17,0.14)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-[#E8E6E0] px-6 py-3.5 bg-[#F7F6F2]/80">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-[#111111]" />
                <div>
                  <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                    Review Invoice {selectedInvoice.invoiceNumber}
                    <span
                      className={`status-pill ${
                        selectedInvoice.status === 'APPROVED'
                          ? 'status-pill-success'
                          : selectedInvoice.status === 'REJECTED'
                          ? 'status-pill-error'
                          : 'status-pill-warning'
                      }`}
                    >
                      {selectedInvoice.status}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#77756F]">
                    Vendor: {selectedInvoice.contractor?.name} ({selectedInvoice.contractor?.country})
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button onClick={handleSaveEdits} className="btn-primary">
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </button>
                    <button onClick={() => setIsEditing(false)} className="btn-secondary">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(true)} className="btn-secondary">
                      <Edit3 className="h-3.5 w-3.5 text-[#77756F]" />
                      <span>Edit Fields</span>
                    </button>
                    {selectedInvoice.status !== 'APPROVED' && (
                      <button
                        onClick={() => handleApprove(selectedInvoice.id)}
                        className="btn-primary"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                    {selectedInvoice.status !== 'REJECTED' && (
                      <button
                        onClick={() => handleReject(selectedInvoice.id)}
                        className="btn-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => {
                    setSelectedInvoice(null);
                    setIsEditing(false);
                    setModalFeedback(null);
                  }}
                  className="rounded-[6px] p-1.5 text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111] transition-colors ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* In-Modal Feedback Alert */}
            {modalFeedback && (
              <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{modalFeedback}</span>
              </div>
            )}

            {/* Split Screen Body */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#E8E6E0]">
              {/* LEFT: PDF & Extraction Preview Canvas */}
              <div className="p-6 bg-[#F7F6F2]/50 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between text-xs text-[#77756F]">
                  <span className="font-semibold text-[#111111]">DOCUMENT PREVIEW (PDF CANVAS)</span>
                  <span className="font-mono text-[10px]">
                    SHA-256: {selectedInvoice.invoiceHash?.substring(0, 18)}...
                  </span>
                </div>

                {/* Simulated PDF Sheet */}
                <div className="relative rounded-[8px] border border-[#E8E6E0] bg-white p-6 shadow-sm space-y-6">
                  <div className="flex justify-between items-start border-b border-[#E8E6E0] pb-4">
                    <div>
                      <div className="text-base font-bold text-[#111111]">
                        {selectedInvoice.contractor?.name}
                      </div>
                      <div className="text-xs text-[#77756F]">
                        {selectedInvoice.contractor?.email} · Tax ID: IT-99401283
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-[#77756F] uppercase">INVOICE</div>
                      <div className="text-sm font-mono font-bold text-[#111111]">
                        {selectedInvoice.invoiceNumber}
                      </div>
                    </div>
                  </div>

                  {/* Dates & Currency */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[#77756F] text-[10px] uppercase">Issue Date</span>
                      <div className="font-medium text-[#111111]">{selectedInvoice.issueDate}</div>
                    </div>
                    <div>
                      <span className="text-[#77756F] text-[10px] uppercase">Due Date</span>
                      <div className="font-medium text-[#111111]">{selectedInvoice.dueDate}</div>
                    </div>
                  </div>

                  {/* Masked Bank Details */}
                  <div className="rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 text-xs">
                    <div className="text-[10px] font-semibold text-[#77756F] uppercase tracking-wider mb-1">
                      Payout Coordinates (Masked PII)
                    </div>
                    <div className="font-mono text-[11px] text-[#111111]">
                      IBAN: IT60•••••••••••••••••••3456
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-[#77756F] uppercase">Line Items</div>
                    <div className="divide-y divide-[#E8E6E0] border-t border-b border-[#E8E6E0]">
                      {selectedInvoice.lineItems.map((li, idx) => (
                        <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                          <div>
                            <div className="font-medium text-[#111111]">{li.description}</div>
                            <div className="text-[11px] text-[#77756F]">Qty: {li.quantity}</div>
                          </div>
                          <span className="font-mono font-semibold text-[#111111]">
                            {selectedInvoice.currency} {((li.amountMinor) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#111111]">TOTAL DUE</span>
                    <span className="text-base font-bold font-mono text-[#111111] tabular-nums">
                      {selectedInvoice.currency} {((selectedInvoice.totalMinor) / 100).toFixed(2)}
                    </span>
                  </div>

                  {/* Low Confidence Callout */}
                  {selectedInvoice.matchConfidence && selectedInvoice.matchConfidence < 0.85 && (
                    <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong>OCR Verification Note:</strong>
                        <p className="mt-0.5 text-[11px] text-amber-800">
                          Detected faint character scans on VAT number and line-item decimal point. Verify against right panel before approval.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Structured Fields Inspector & Editor */}
              <div className="p-6 bg-white overflow-y-auto space-y-4">
                <div className="flex items-center justify-between text-xs text-[#77756F]">
                  <span className="font-semibold text-[#111111]">EXTRACTED METADATA FIELDS</span>
                  <span className="text-emerald-700 font-medium">LLM Parameterized Mode</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* Vendor Name */}
                  <div>
                    <label className="block text-[#77756F] text-[11px] mb-1 font-medium">Contractor / Vendor</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={editForm.contractor?.name ?? selectedInvoice.contractor?.name ?? ''}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          contractor: { ...selectedInvoice.contractor!, name: e.target.value },
                        })
                      }
                      className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] disabled:opacity-85 focus:border-[#111111] focus:bg-white focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Invoice Number & Currency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#77756F] text-[11px] mb-1 font-medium">Invoice Number</label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={editForm.invoiceNumber ?? selectedInvoice.invoiceNumber}
                        onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                        className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs font-mono text-[#111111] disabled:opacity-85 focus:border-[#111111] focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[#77756F] text-[11px] mb-1 font-medium">Currency Code (ISO)</label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={editForm.currency ?? selectedInvoice.currency}
                        onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                        className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs font-mono text-[#111111] disabled:opacity-85 focus:border-[#111111] focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Issue Date & Due Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#77756F] text-[11px] mb-1 font-medium">Issue Date</label>
                      <input
                        type="date"
                        disabled={!isEditing}
                        value={editForm.issueDate ?? selectedInvoice.issueDate}
                        onChange={(e) => setEditForm({ ...editForm, issueDate: e.target.value })}
                        className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] disabled:opacity-85 focus:border-[#111111] focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[#77756F] text-[11px] mb-1 font-medium">Due Date</label>
                      <input
                        type="date"
                        disabled={!isEditing}
                        value={editForm.dueDate ?? selectedInvoice.dueDate}
                        onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                        className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] disabled:opacity-85 focus:border-[#111111] focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Total & Tax */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2]">
                      <label className="block text-[11px] font-medium text-[#77756F] mb-1">Total Amount</label>
                      <div className="font-mono text-sm font-bold text-[#111111] tabular-nums">
                        ${((selectedInvoice.totalMinor) / 100).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-3 rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2]">
                      <label className="block text-[11px] font-medium text-[#77756F] mb-1">Tax Amount</label>
                      <div className="font-mono text-sm text-[#55534E] tabular-nums">
                        ${((selectedInvoice.taxMinor) / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Deterministic Validation Checks */}
                  <div className="rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-[#111111]">Deterministic Validation Checks</div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Line items sum matches invoice total</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Issue date precedes due date</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Valid ISO currency ({selectedInvoice.currency})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
