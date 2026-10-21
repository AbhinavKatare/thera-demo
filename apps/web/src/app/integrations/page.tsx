'use client';

import React, { useState } from 'react';
import {
  Boxes,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Power,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { MOCK_INTEGRATIONS } from '@/lib/mock-data';
import { IntegrationStatusItem } from '@/lib/api-client';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatusItem[]>(MOCK_INTEGRATIONS);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<IntegrationStatusItem | null>(null);
  const [viewingErrors, setViewingErrors] = useState<IntegrationStatusItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Field mapping state
  const [mappingForm, setMappingForm] = useState({
    defaultExpenseAccountCode: '',
    defaultBankAccountId: '',
    defaultTaxRate: 0,
    vendorPrefix: '',
    region: 'us',
  });

  const handleSyncNow = (provider: string) => {
    setSyncingProvider(provider);
    setTimeout(() => {
      const updated = integrations.map((c) =>
        c.provider === provider
          ? {
              ...c,
              lastSyncedAt: new Date().toISOString(),
              status: 'CONNECTED' as const,
              rateLimitRemaining: (c.rateLimitRemaining ?? 1000) - 2,
            }
          : c
      );
      setIntegrations(updated);
      setSyncingProvider(null);
      setToast(`Synchronized ${provider.toUpperCase()} ledger successfully via AES-256 encrypted token store.`);
      setTimeout(() => setToast(null), 4000);
    }, 1200);
  };

  const handleToggleConnect = (provider: string) => {
    const updated = integrations.map((c) => {
      if (c.provider === provider) {
        const nextStatus: IntegrationStatusItem['status'] = c.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
        return { ...c, status: nextStatus };
      }
      return c;
    });
    setIntegrations(updated);
    setToast(`Updated ${provider.toUpperCase()} connection state.`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenEdit = (item: IntegrationStatusItem) => {
    setEditingProvider(item);
    setMappingForm({
      defaultExpenseAccountCode: item.config.defaultExpenseAccountCode,
      defaultBankAccountId: item.config.defaultBankAccountId ?? '',
      defaultTaxRate: item.config.defaultTaxRate,
      vendorPrefix: item.config.vendorPrefix ?? '',
      region: item.config.region ?? 'us',
    });
  };

  const handleSaveMapping = () => {
    if (!editingProvider) return;
    const updated = integrations.map((c) =>
      c.provider === editingProvider.provider
        ? {
            ...c,
            config: {
              ...c.config,
              ...mappingForm,
            },
          }
        : c
    );
    setIntegrations(updated);
    setEditingProvider(null);
    setToast(`Saved custom field mapping rules for ${editingProvider.name}.`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Boxes className="h-6 w-6 text-emerald-400" />
            <span>Accounting &amp; ERP Integrations</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Bi-directional synchronization of vendor profiles, approved bills, and bank payment statuses.
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/60 px-3.5 py-2 text-xs text-slate-300 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>OAuth tokens secured at rest with AES-256-GCM</span>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {integrations.map((item) => {
          const isConnected = item.status === 'CONNECTED';
          const isSyncing = syncingProvider === item.provider;
          const hasErrors = item.errors && item.errors.length > 0;

          return (
            <div
              key={item.provider}
              className="card-surface rounded-2xl p-6 flex flex-col justify-between space-y-6 relative group"
            >
              <div className="space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-200 font-bold text-sm border border-white/5">
                      {item.provider === 'xero' ? 'XR' : item.provider === 'zoho' ? 'ZH' : 'NS'}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                      <div className="text-[10px] text-slate-400">{item.tenantName}</div>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
                      isConnected
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed min-h-[3rem]">
                  {item.description}
                </p>

                {/* Status metadata */}
                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Last Synced:</span>
                    <span className="text-slate-200 font-mono text-[11px]">
                      {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Rate Limit:</span>
                    <span className="text-emerald-400 font-mono text-[11px]">
                      {item.rateLimitRemaining} calls remaining
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Expense Code:</span>
                    <span className="text-slate-300 font-mono text-[11px] truncate max-w-[140px]">
                      {item.config.defaultExpenseAccountCode}
                    </span>
                  </div>
                </div>

                {hasErrors && (
                  <button
                    onClick={() => setViewingErrors(item)}
                    className="w-full text-left rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-300 flex items-center justify-between hover:bg-amber-500/15 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{item.errors?.length} sync notice / warning</span>
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncNow(item.provider)}
                    disabled={!isConnected || isSyncing}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 interactive-tap transition-all disabled:opacity-40"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    title="Field Mapping Configuration"
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 interactive-tap transition-colors"
                  >
                    <Sliders className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleToggleConnect(item.provider)}
                    title={isConnected ? 'Disconnect Integration' : 'Connect Integration'}
                    className={`rounded-xl border p-2 transition-colors interactive-tap ${
                      isConnected
                        ? 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FIELD-MAPPING EDITOR MODAL */}
      {editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl p-6 text-slate-100 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-400" />
                  <span>Field Mapping &amp; Ledger Rules: {editingProvider.name}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Configure default accounts and code translation for automated bill creation
                </p>
              </div>
              <button
                onClick={() => setEditingProvider(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Default Expense Account Code
                </label>
                <input
                  type="text"
                  value={mappingForm.defaultExpenseAccountCode}
                  onChange={(e) =>
                    setMappingForm({ ...mappingForm, defaultExpenseAccountCode: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Default Bank Account ID / Name
                </label>
                <input
                  type="text"
                  value={mappingForm.defaultBankAccountId}
                  onChange={(e) =>
                    setMappingForm({ ...mappingForm, defaultBankAccountId: e.target.value })
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Default Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={mappingForm.defaultTaxRate}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, defaultTaxRate: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Vendor Code Prefix
                  </label>
                  <input
                    type="text"
                    value={mappingForm.vendorPrefix}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, vendorPrefix: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {editingProvider.provider === 'zoho' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Zoho Data Center Region
                  </label>
                  <select
                    value={mappingForm.region}
                    onChange={(e) => setMappingForm({ ...mappingForm, region: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="in">India (.in - GST compliance)</option>
                    <option value="us">United States (.com)</option>
                    <option value="eu">Europe (.eu - GDPR)</option>
                    <option value="au">Australia (.com.au)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setEditingProvider(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Save Mapping Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR & CONFLICT INSPECTOR MODAL */}
      {viewingErrors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/20 bg-[#0f172a] shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span>Last Sync Notices: {viewingErrors.name}</span>
              </h3>
              <button
                onClick={() => setViewingErrors(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {viewingErrors.errors?.map((err: string, i: number) => (
                <div
                  key={i}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200 leading-relaxed font-mono"
                >
                  {err}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setViewingErrors(null)}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/20"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
