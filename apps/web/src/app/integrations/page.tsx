'use client';

import React, { useState, useEffect } from 'react';
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingProvider(null);
        setViewingErrors(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      setToast({
        message: `Synchronized ${provider.toUpperCase()} ledger successfully via AES-256 encrypted token store.`,
        type: 'success',
      });
      setTimeout(() => setToast(null), 4000);
    }, 1000);
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
    setToast({
      message: `Updated ${provider.toUpperCase()} connection state.`,
      type: 'info',
    });
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
    setToast({
      message: `Saved custom field mapping rules for ${editingProvider.name}.`,
      type: 'success',
    });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
            <Boxes className="h-5 w-5 text-[#111111]" />
            <span>Accounting &amp; ERP Integrations</span>
          </h1>
          <p className="mt-1 text-xs text-[#77756F]">
            Bi-directional synchronization of vendor profiles, approved bills, and bank payment statuses.
          </p>
        </div>

        <div className="rounded-[8px] border border-[#E8E6E0] bg-white px-3.5 py-2 text-xs text-[#55534E] flex items-center gap-2 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <span>OAuth tokens secured at rest with AES-256-GCM</span>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-[8px] p-3 text-xs flex items-center gap-2 border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-white text-[#111111] border-[#E8E6E0] shadow-sm'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{toast.message}</span>
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
              className="card-editorial p-6 flex flex-col justify-between space-y-6 relative"
            >
              <div className="space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#F7F6F2] text-[#111111] font-bold text-xs border border-[#E8E6E0]">
                      {item.provider === 'xero' ? 'XR' : item.provider === 'zoho' ? 'ZH' : 'NS'}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#111111]">{item.name}</h3>
                      <div className="text-[10px] text-[#77756F]">{item.tenantName}</div>
                    </div>
                  </div>

                  <span
                    className={`status-pill ${
                      isConnected ? 'status-pill-success' : 'status-pill-neutral'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <p className="text-xs text-[#55534E] leading-relaxed min-h-[3rem]">
                  {item.description}
                </p>

                {/* Status metadata */}
                <div className="rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between text-[#77756F]">
                    <span>Last Synced:</span>
                    <span className="text-[#111111] font-mono text-[11px]">
                      {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#77756F]">
                    <span>Rate Limit:</span>
                    <span className="text-emerald-700 font-mono text-[11px] font-semibold">
                      {item.rateLimitRemaining} calls remaining
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#77756F]">
                    <span>Expense Code:</span>
                    <span className="text-[#111111] font-mono text-[11px] truncate max-w-[140px]">
                      {item.config.defaultExpenseAccountCode}
                    </span>
                  </div>
                </div>

                {hasErrors && (
                  <button
                    onClick={() => setViewingErrors(item)}
                    className="w-full text-left rounded-[6px] border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 flex items-center justify-between hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span className="truncate">{item.errors?.length} sync notice / warning</span>
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#E8E6E0] space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncNow(item.provider)}
                    disabled={!isConnected || isSyncing}
                    className="btn-primary flex-1 py-1.5 text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    title="Field Mapping Configuration"
                    className="btn-secondary p-2"
                  >
                    <Sliders className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleToggleConnect(item.provider)}
                    title={isConnected ? 'Disconnect Integration' : 'Connect Integration'}
                    className={`rounded-[8px] border p-2 transition-colors cursor-pointer ${
                      isConnected
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-[#E8E6E0] bg-white text-[#77756F] hover:text-[#111111]'
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in"
          onClick={() => setEditingProvider(null)}
        >
          <div
            className="w-full max-w-lg rounded-[12px] border border-[#E8E6E0] bg-white shadow-[0_20px_60px_rgba(17,17,17,0.14)] p-6 text-[#111111] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#111111]" />
                  <span>Field Mapping &amp; Ledger Rules: {editingProvider.name}</span>
                </h3>
                <p className="text-xs text-[#77756F]">
                  Configure default accounts and code translation for automated bill creation
                </p>
              </div>
              <button
                onClick={() => setEditingProvider(null)}
                className="rounded-[6px] p-1 text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[#111111] font-medium mb-1">
                  Default Expense Account Code
                </label>
                <input
                  type="text"
                  value={mappingForm.defaultExpenseAccountCode}
                  onChange={(e) =>
                    setMappingForm({ ...mappingForm, defaultExpenseAccountCode: e.target.value })
                  }
                  className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#111111] font-medium mb-1">
                  Default Bank Account ID / Name
                </label>
                <input
                  type="text"
                  value={mappingForm.defaultBankAccountId}
                  onChange={(e) =>
                    setMappingForm({ ...mappingForm, defaultBankAccountId: e.target.value })
                  }
                  className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#111111] font-medium mb-1">
                    Default Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={mappingForm.defaultTaxRate}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, defaultTaxRate: Number(e.target.value) })
                    }
                    className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#111111] font-medium mb-1">
                    Vendor Code Prefix
                  </label>
                  <input
                    type="text"
                    value={mappingForm.vendorPrefix}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, vendorPrefix: e.target.value })
                    }
                    className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {editingProvider.provider === 'zoho' && (
                <div>
                  <label className="block text-[#111111] font-medium mb-1">
                    Zoho Data Center Region
                  </label>
                  <select
                    value={mappingForm.region}
                    onChange={(e) => setMappingForm({ ...mappingForm, region: e.target.value })}
                    className="w-full rounded-[6px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-2 text-xs text-[#111111] focus:border-[#111111] focus:bg-white focus:outline-none"
                  >
                    <option value="in">India (.in - GST compliance)</option>
                    <option value="us">United States (.com)</option>
                    <option value="eu">Europe (.eu - GDPR)</option>
                    <option value="au">Australia (.com.au)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6E0]">
              <button
                onClick={() => setEditingProvider(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                className="btn-primary"
              >
                Save Mapping Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR & CONFLICT INSPECTOR MODAL */}
      {viewingErrors && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in"
          onClick={() => setViewingErrors(null)}
        >
          <div
            className="w-full max-w-lg rounded-[12px] border border-amber-200 bg-white shadow-[0_20px_60px_rgba(17,17,17,0.14)] p-6 text-[#111111] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Last Sync Notices: {viewingErrors.name}</span>
              </h3>
              <button
                onClick={() => setViewingErrors(null)}
                className="rounded-[6px] p-1 text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {viewingErrors.errors?.map((err: string, i: number) => (
                <div
                  key={i}
                  className="rounded-[6px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed font-mono"
                >
                  {err}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setViewingErrors(null)}
                className="btn-secondary"
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
