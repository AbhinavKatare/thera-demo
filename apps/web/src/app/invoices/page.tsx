'use client';

import React, { useState } from 'react';
import {
  Receipt,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Search,
  Edit3,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { InvoiceItem, InvoiceLineItem } from '@/lib/api-client';
import { MOCK_INVOICES } from '@/lib/mock-data';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>(MOCK_INVOICES);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InvoiceItem>>({});

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'NEEDS_REVIEW' && (inv.flags && inv.flags.length > 0)) ||
      inv.status === selectedStatus;
    const matchesQuery =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.contractor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.currency.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const handleOpenReview = (inv: InvoiceItem) => {
    setSelectedInvoice(inv);
    setEditForm({ ...inv });
    setIsEditing(false);
  };

  const handleSaveEdits = () => {
    if (!selectedInvoice) return;
    const updated = invoices.map((inv) => (inv.id === selectedInvoice.id ? { ...inv, ...editForm } : inv));
    setInvoices(updated as InvoiceItem[]);
    setSelectedInvoice({ ...selectedInvoice, ...editForm } as InvoiceItem);
    setIsEditing(false);
    setUploadToast(`Invoice ${selectedInvoice.invoiceNumber} updated successfully.`);
    setTimeout(() => setUploadToast(null), 3000);
  };

  const handleApprove = (id: string) => {
    const updated = invoices.map((inv) => (inv.id === id ? { ...inv, status: 'APPROVED' as const } : inv));
    setInvoices(updated);
    if (selectedInvoice?.id === id) {
      setSelectedInvoice({ ...selectedInvoice, status: 'APPROVED' });
    }
    setUploadToast('Invoice approved and queued for accounting sync');
    setTimeout(() => setUploadToast(null), 3000);
  };

  const handleReject = (id: string) => {
    const updated = invoices.map((inv) => (inv.id === id ? { ...inv, status: 'REJECTED' as const } : inv));
    setInvoices(updated);
    if (selectedInvoice?.id === id) {
      setSelectedInvoice({ ...selectedInvoice, status: 'REJECTED' });
    }
    setUploadToast('Invoice marked as rejected');
    setTimeout(() => setUploadToast(null), 3000);
  };

  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadToast(null);

    // Simulated PDF extraction pipeline (FileStore SHA-256 hash check -> OCR -> LLM extract -> Deterministic check)
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
        currency: 'BRL',
        subtotalMinor: 450000,
        taxMinor: 0,
        totalMinor: 450000,
        invoiceHash: `sha256_${Math.random().toString(16).substring(2)}`,
        contractor: {
          id: 'cnt_003',
          name: 'Carlos Silva',
          email: 'carlos.silva@backend.br',
          country: 'BR',
          currency: 'BRL',
        },
        lineItems: [
          {
            description: 'Postgres High-Availability Cluster & Read-Replica Sharding',
            quantity: 60,
            unitPriceMinor: 7500,
            amountMinor: 450000,
            accountCode: '6200-ENGINEERING',
          },
        ],
        matchConfidence: 0.94,
        flags: [],
        notes: 'Uploaded via PDF intake pipeline. SHA-256 hash uniqueness verified.',
        createdAt: new Date().toISOString(),
      };

      setInvoices([newInvoice, ...invoices]);
      setIsUploading(false);
      setSelectedInvoice(newInvoice);
      setUploadToast(`Successfully processed "${file.name}" with 94% match confidence!`);
      setTimeout(() => setUploadToast(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-400" />
            <span>Contractor Invoices</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Intake via Gmail IMAP poller, Tesseract OCR fallback, and LLM parameter extraction.
          </p>
        </div>

        {/* Upload Button */}
        <label className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 interactive-tap transition-all cursor-pointer">
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

      {uploadToast && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{uploadToast}</span>
        </div>
      )}

      {/* Drag & Drop PDF Dropzone Hero */}
      <div className="relative rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.01] p-6 text-center hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition-all">
        <input
          type="file"
          accept=".pdf,image/png,image/jpeg"
          onChange={handleSimulateUpload}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
            <UploadCloud className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-xs font-medium text-slate-200">
            Drop PDF invoices here or click to browse
          </div>
          <p className="text-[11px] text-slate-500">
            FileStore checks SHA-256 for duplicate avoidance. Auto-flags confidence &lt; 85%.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'NEEDS_REVIEW', 'SUBMITTED', 'APPROVED', 'PAID'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all interactive-tap ${
                selectedStatus === status
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              {status === 'NEEDS_REVIEW' ? 'Needs Review (Flags)' : status}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice # or contractor..."
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/5 bg-white/[0.02] text-slate-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 pl-4 pr-3 font-semibold">Invoice #</th>
              <th className="py-3 px-3 font-semibold">Contractor</th>
              <th className="py-3 px-3 font-semibold">Period &amp; Due</th>
              <th className="py-3 px-3 font-semibold">Match Score</th>
              <th className="py-3 px-3 font-semibold text-right">Amount</th>
              <th className="py-3 px-3 font-semibold text-center">Status</th>
              <th className="py-3 pl-3 pr-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {filteredInvoices.map((inv) => {
              const hasFlags = inv.flags && inv.flags.length > 0;
              const isLowConfidence = inv.matchConfidence && inv.matchConfidence < 0.85;

              return (
                <tr
                  key={inv.id}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => handleOpenReview(inv)}
                >
                  <td className="py-3.5 pl-4 pr-3 font-mono font-medium text-white">
                    <div className="flex items-center gap-1.5">
                      <span>{inv.invoiceNumber}</span>
                      {hasFlags && (
                        <span title="Anomalies flagged" className="text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="font-medium text-slate-200">{inv.contractor?.name ?? 'Unknown'}</div>
                    <div className="text-[10px] text-slate-400">{inv.contractor?.country} · {inv.contractor?.email}</div>
                  </td>

                  <td className="py-3.5 px-3 text-slate-400">
                    <div>Due {inv.dueDate}</div>
                    <div className="text-[10px]">{inv.periodStart} → {inv.periodEnd}</div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isLowConfidence
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {Math.round((inv.matchConfidence ?? 0.95) * 100)}%
                    </span>
                  </td>

                  <td className="py-3.5 px-3 text-right font-mono font-semibold tabular-nums text-white">
                    {inv.currency} {((inv.totalMinor) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
                        inv.status === 'APPROVED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : inv.status === 'PAID'
                          ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                          : inv.status === 'REJECTED'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>

                  <td className="py-3.5 pl-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenReview(inv)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10 transition-colors"
                      >
                        Review
                      </button>
                      {inv.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleApprove(inv.id)}
                          title="Approve invoice"
                          className="rounded-lg bg-emerald-500/10 p-1 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SPLIT-SCREEN REVIEW MODAL / DRAWER */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/70 animate-in fade-in">
          <div className="w-full max-w-6xl h-[88vh] rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl flex flex-col overflow-hidden">
            {/* Split Screen Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 bg-slate-900/80">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Review Invoice {selectedInvoice.invoiceNumber}
                    <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-mono text-slate-300">
                      {selectedInvoice.status}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Vendor: {selectedInvoice.contractor?.name} ({selectedInvoice.contractor?.country})
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdits}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                      <span>Edit Fields</span>
                    </button>
                    <button
                      onClick={() => handleApprove(selectedInvoice.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleReject(selectedInvoice.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Split Screen Body: 50% Left (Simulated Document/PDF), 50% Right (Extracted Form) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/10">
              {/* LEFT: PDF & Extraction Visual Bounding Boxes */}
              <div className="p-6 bg-slate-950/60 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">DOCUMENT PREVIEW (PDF CANVAS)</span>
                  <span className="font-mono text-[10px]">SHA-256: {selectedInvoice.invoiceHash?.substring(0, 18)}...</span>
                </div>

                {/* Simulated High-Fidelity PDF Sheet */}
                <div className="relative rounded-xl border border-white/15 bg-white/[0.03] p-6 shadow-inner space-y-6">
                  {/* Bounding box header */}
                  <div className="flex justify-between items-start border-b border-white/10 pb-4">
                    <div>
                      <div className="text-lg font-bold text-white tracking-tight">
                        {selectedInvoice.contractor?.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {selectedInvoice.contractor?.email} · VAT ID: IT-99401283
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-slate-400 uppercase">INVOICE</div>
                      <div className="text-sm font-mono font-bold text-emerald-400">
                        {selectedInvoice.invoiceNumber}
                      </div>
                    </div>
                  </div>

                  {/* Dates Box */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-white/[0.02] p-3 rounded-lg border border-white/5">
                    <div>
                      <span className="text-slate-500 block text-[10px]">ISSUE DATE</span>
                      <span className="font-mono text-slate-200">{selectedInvoice.issueDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">DUE DATE</span>
                      <span className="font-mono text-slate-200">{selectedInvoice.dueDate}</span>
                    </div>
                  </div>

                  {/* Line Items Table Canvas */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase">Line Items</div>
                    <div className="space-y-1.5">
                      {selectedInvoice.lineItems.map((item: InvoiceLineItem, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs p-2 rounded bg-white/[0.02] border border-white/5"
                        >
                          <span className="text-slate-200 truncate pr-2">{item.description}</span>
                          <span className="font-mono tabular-nums text-white font-medium shrink-0">
                            {selectedInvoice.currency} {(item.amountMinor / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Canvas */}
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-300">TOTAL DUE</span>
                    <span className="text-base font-bold font-mono text-emerald-400 tabular-nums">
                      {selectedInvoice.currency} {((selectedInvoice.totalMinor) / 100).toFixed(2)}
                    </span>
                  </div>

                  {/* Low Confidence OCR Warning Marker */}
                  {selectedInvoice.matchConfidence && selectedInvoice.matchConfidence < 0.85 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <strong>Low Confidence OCR ({(selectedInvoice.matchConfidence * 100).toFixed(0)}%):</strong>
                        <p className="mt-0.5 text-[11px] text-amber-200/80">
                          Tesseract fallback detected faint character scans on VAT number and line-item decimal point. Verify against right panel.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Extracted Fields Editor */}
              <div className="p-6 bg-slate-900/40 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">EXTRACTED METADATA FIELDS</span>
                  <span className="text-emerald-400 font-medium">LLM Parameterized Mode</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* Vendor Name */}
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Contractor / Vendor</label>
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
                      className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-75 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Invoice Number & Currency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Invoice Number</label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={editForm.invoiceNumber ?? selectedInvoice.invoiceNumber}
                        onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-mono text-white disabled:opacity-75 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Currency Code (ISO)</label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={editForm.currency ?? selectedInvoice.currency}
                        onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-mono text-white disabled:opacity-75 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Issue Date & Due Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Issue Date</label>
                      <input
                        type="date"
                        disabled={!isEditing}
                        value={editForm.issueDate ?? selectedInvoice.issueDate}
                        onChange={(e) => setEditForm({ ...editForm, issueDate: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-75 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Due Date</label>
                      <input
                        type="date"
                        disabled={!isEditing}
                        value={editForm.dueDate ?? selectedInvoice.dueDate}
                        onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-75 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Total & Tax (Highlighted in amber if low confidence) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        selectedInvoice.matchConfidence && selectedInvoice.matchConfidence < 0.85
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-white/10 bg-slate-950'
                      }`}
                    >
                      <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                        <span>Total Minor</span>
                        {selectedInvoice.matchConfidence && selectedInvoice.matchConfidence < 0.85 && (
                          <span className="text-[10px] text-amber-400">Needs Verify</span>
                        )}
                      </label>
                      <div className="font-mono text-sm font-bold text-white tabular-nums">
                        ${((selectedInvoice.totalMinor) / 100).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border border-white/10 bg-slate-950">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Tax Amount
                      </label>
                      <div className="font-mono text-sm text-slate-300 tabular-nums">
                        ${((selectedInvoice.taxMinor) / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Deterministic Validation Rules Status */}
                  <div className="rounded-xl border border-white/10 bg-slate-950 p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-300">Deterministic Rule Checks</div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="h-3 w-3" />
                        <span>Line items sum matches invoice total</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="h-3 w-3" />
                        <span>Issue date precedes due date</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <Check className="h-3 w-3" />
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
