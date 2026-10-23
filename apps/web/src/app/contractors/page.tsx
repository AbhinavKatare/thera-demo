'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Globe,
  X,
  CheckCircle2,
} from 'lucide-react';
import { MOCK_CONTRACTORS } from '@/lib/mock-data';
import { ContractorItem } from '@/lib/api-client';

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorItem[]>(MOCK_CONTRACTORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    country: 'US',
    currency: 'USD',
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInviteModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = contractors.filter((c) => {
    const matchesCurrency = currencyFilter === 'ALL' || c.currency === currencyFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.country.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCurrency && matchesSearch;
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return;

    const newContractor: ContractorItem = {
      id: `cnt_new_${Date.now()}`,
      companyId: 'cmp_prod_001',
      name: inviteForm.name,
      email: inviteForm.email,
      country: inviteForm.country,
      currency: inviteForm.currency,
      status: 'ACTIVE',
      totalPaidMinor: 0,
      bankDetails: {
        accountNumber: '••••••••4099',
      },
      createdAt: new Date().toISOString(),
    };

    setContractors([newContractor, ...contractors]);
    setInviteModalOpen(false);
    setInviteForm({ name: '', email: '', country: 'US', currency: 'USD' });
    setToast(`Contractor invitation dispatched to ${inviteForm.email}.`);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
            <Users className="h-5 w-5 text-[#111111]" />
            <span>Contractors &amp; Vendors</span>
          </h1>
          <p className="mt-1 text-xs text-[#77756F]">
            Multi-currency contractor profiles, payout routing coordinates, and historical ledger totals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInviteModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          <span>Invite Contractor</span>
        </button>
      </div>

      {toast && (
        <div className="rounded-[8px] bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="card-editorial p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'USD', 'EUR', 'SGD', 'BRL', 'INR', 'AED', 'JPY'].map((cur) => (
            <button
              key={cur}
              onClick={() => setCurrencyFilter(cur)}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                currencyFilter === cur
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111]'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#77756F]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contractor, email, country..."
            className="w-full rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] py-1.5 pl-9 pr-8 text-xs text-[#111111] placeholder-[#77756F] focus:border-[#111111] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-[#77756F] hover:text-[#111111]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Contractors Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="card-editorial-hover p-5 flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="status-pill status-pill-success">
                  {c.status}
                </span>
                <span className="font-mono text-xs font-medium text-[#77756F] flex items-center gap-1">
                  <Globe className="h-3 w-3 text-[#77756F]" />
                  {c.country} · {c.currency}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-sm font-semibold text-[#111111]">
                  {c.name}
                </h3>
                <p className="text-[11px] text-[#77756F] truncate">{c.email}</p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-[#E8E6E0] text-xs">
              <div className="flex items-center justify-between text-[#77756F] text-[11px]">
                <span>Coordinates:</span>
                <span className="font-mono text-[#111111]">
                  {c.bankDetails?.accountNumber || c.bankDetails?.iban || 'Verified'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#77756F] text-[11px]">
                <span>Total Settled:</span>
                <span className="font-mono font-semibold text-[#111111] tabular-nums">
                  {c.currency} {(c.totalPaidMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-[#E8E6E0] bg-white shadow-[0_20px_60px_rgba(17,17,17,0.14)] p-6 text-[#111111] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                <Users className="h-4 w-4 text-[#111111]" />
                <span>Invite New Contractor</span>
              </h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="rounded-[6px] p-1 text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#111111] font-medium mb-1">Contractor Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#111111] font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="maya.lin@contractor.io"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#111111] font-medium mb-1">Country</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="US"
                    value={inviteForm.country}
                    onChange={(e) => setInviteForm({ ...inviteForm, country: e.target.value.toUpperCase() })}
                    className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] font-mono focus:border-[#111111] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#111111] font-medium mb-1">Disbursement Currency</label>
                  <select
                    value={inviteForm.currency}
                    onChange={(e) => setInviteForm({ ...inviteForm, currency: e.target.value })}
                    className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] font-mono focus:border-[#111111] focus:bg-white focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="SGD">SGD (S$)</option>
                    <option value="BRL">BRL (R$)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6E0]">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Send Onboarding Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
