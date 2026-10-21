'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Globe,
} from 'lucide-react';
import { MOCK_CONTRACTORS } from '@/lib/mock-data';
import { ContractorItem } from '@/lib/api-client';

export default function ContractorsPage() {
  const [contractors] = useState<ContractorItem[]>(MOCK_CONTRACTORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');

  const filtered = contractors.filter((c) => {
    const matchesCurrency = currencyFilter === 'ALL' || c.currency === currencyFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.country.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCurrency && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            <span>Contractors &amp; Vendors</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Multi-currency contractor profiles, payout routing coordinates, and historical ledger totals.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 interactive-tap transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Invite Contractor</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['ALL', 'USD', 'EUR', 'SGD', 'BRL', 'INR', 'AED', 'JPY'].map((cur) => (
            <button
              key={cur}
              onClick={() => setCurrencyFilter(cur)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                currencyFilter === cur
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contractor, email, country..."
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Contractors Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="card-surface rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-white/15 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  {c.status}
                </span>
                <span className="font-mono text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Globe className="h-3 w-3 text-slate-500" />
                  {c.country} · {c.currency}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {c.name}
                </h3>
                <p className="text-[11px] text-slate-400 truncate">{c.email}</p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-white/5 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Coordinates:</span>
                <span className="font-mono text-slate-300">
                  {c.bankDetails?.accountNumber || c.bankDetails?.iban || 'Verified'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Total Settled:</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {c.currency} {(c.totalPaidMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
