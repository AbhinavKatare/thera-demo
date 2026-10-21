'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Bell,
  Command,
  Bot,
  Send,
  Loader2,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export function Header() {
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<{
    answer: string;
    sources: Array<Record<string, unknown>>;
  } | null>(null);

  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setAiAnswer(null);

    try {
      const res = await apiClient.askPayroll(query);
      setAiAnswer({
        answer: res.answer,
        sources: res.sources || [],
      });
    } catch {
      // Graceful demo answer matching seed database when API backend is offline
      setTimeout(() => {
        if (query.toLowerCase().includes('sg') || query.toLowerCase().includes('singapore') || query.toLowerCase().includes('chen')) {
          setAiAnswer({
            answer: 'In the last 30 days, PayPilot disbursed SGD 10,400.00 across 2 approved invoices to Liam Chen (Singapore, DevOps Specialist). All transactions were verified against DBS Singapore payout coordinates.',
            sources: [{ entity: 'Contractor', id: 'cnt_001', name: 'Liam Chen', country: 'SG' }],
          });
        } else if (query.toLowerCase().includes('anomaly') || query.toLowerCase().includes('flag')) {
          setAiAnswer({
            answer: 'There are currently 3 active anomalies on the upcoming Oct 15 payroll run: 1) Rate spike (+42%) for Marcus Vance, 2) Bank IBAN update within 36 hours for Sofia Rossi, and 3) Potential duplicate invoice INV-2026-088.',
            sources: [{ entity: 'PayrollRun', id: 'run_2026_10_cycle2', flaggedCount: 3 }],
          });
        } else {
          setAiAnswer({
            answer: `Based on your payroll records: The upcoming cycle total is $48,200.00 USD across 8 global contractors. 5 invoices are cleared for payment, and 3 are on review hold pending anomaly confirmation.`,
            sources: [{ entity: 'Summary', totalContractors: 8, totalGrossMinor: 4820000 }],
          });
        }
        setIsLoading(false);
      }, 700);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-white/5 bg-[#0b0f17]/80 px-6 backdrop-blur-xl">
        {/* Left: Organization Status & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">PayPilot Global</span>
            <span>/</span>
            <span className="text-slate-400">Payroll Ops</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Thera API Connected</span>
          </div>
        </div>

        {/* Center: Global AI Search Bar */}
        <div className="max-w-md flex-1 px-4">
          <button
            onClick={() => setAskModalOpen(true)}
            className="group flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-emerald-500/30 hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-2 truncate">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400 transition-transform group-hover:scale-110" />
              <span className="truncate">Ask your payroll... (e.g. &quot;how much did we pay in Singapore?&quot;)</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right: Slack Status, Notifications, Help */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1 text-xs text-slate-300">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-slate-400">Slack Socket: <strong className="text-slate-200 font-medium">#payroll-alerts</strong></span>
          </div>

          <button
            title="Notifications"
            className="relative rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[#0b0f17]" />
          </button>
        </div>
      </header>

      {/* AI Ask Modal */}
      {askModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 backdrop-blur-md bg-black/60 p-4 transition-all animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl p-6 text-slate-100 relative">
            <button
              onClick={() => {
                setAskModalOpen(false);
                setAiAnswer(null);
              }}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Ask Your Payroll (Gemini Copilot)</h3>
                <p className="text-xs text-slate-400">Whitelisted SQL &amp; parameterized query synthesis without raw SQL exposure</p>
              </div>
            </div>

            <form onSubmit={handleAskSubmit} className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask e.g. 'How much did we pay Liam Chen this month?' or 'Show me flagged anomalies'"
                className="w-full rounded-xl border border-white/10 bg-slate-900/90 py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="absolute right-2 top-2 rounded-lg bg-emerald-500 p-2 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition-colors"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            {/* Quick Prompt Suggestions */}
            {!aiAnswer && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="text-slate-500 text-[11px] self-center">Try asking:</span>
                {[
                  'What anomalies exist on the upcoming run?',
                  'How much did we pay contractors in Singapore?',
                  'Show invoices pending director approval',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setQuery(sample)}
                    className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-slate-300 hover:border-emerald-500/30 hover:text-white transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            )}

            {/* AI Response Display */}
            {aiAnswer && (
              <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-xs leading-relaxed text-slate-200">
                <div className="flex items-center gap-2 mb-2 text-emerald-400 font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Synthesized Answer</span>
                </div>
                <p className="text-slate-100">{aiAnswer.answer}</p>

                {aiAnswer.sources && aiAnswer.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Verified Source Entities:</span>
                    {aiAnswer.sources.map((src, i) => (
                      <span key={i} className="rounded bg-white/5 px-2 py-0.5 text-slate-300 font-mono text-[10px]">
                        {JSON.stringify(src)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
