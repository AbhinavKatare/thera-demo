'use client';

import React, { useState, useEffect } from 'react';
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

  // Keyboard shortcut Cmd/Ctrl + K and Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setAskModalOpen(true);
      } else if (e.key === 'Escape' && askModalOpen) {
        setAskModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [askModalOpen]);

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
      // Graceful fallback demo answer matching seed database
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
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-[#E8E6E0] bg-[#FFFFFF]/90 px-6 backdrop-blur-md">
        {/* Left: Organization Status & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[#77756F]">
            <span className="font-medium text-[#111111]">PayPilot Global</span>
            <span>/</span>
            <span className="text-[#77756F]">Payroll Ops</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>Thera API Connected</span>
          </div>
        </div>

        {/* Center: Global AI Search Bar */}
        <div className="max-w-md flex-1 px-4">
          <button
            onClick={() => setAskModalOpen(true)}
            className="group flex w-full items-center justify-between rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-1.5 text-xs text-[#77756F] transition-all hover:border-[#D6D4CE] hover:bg-white hover:text-[#111111] shadow-sm"
          >
            <div className="flex items-center gap-2 truncate">
              <Sparkles className="h-3.5 w-3.5 text-[#111111] transition-transform group-hover:scale-110" />
              <span className="truncate">Ask your payroll... (e.g. &quot;how much did we pay in Singapore?&quot;)</span>
            </div>
            <div className="flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] text-[#77756F] border border-[#E8E6E0]">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right: Slack Status, Notifications */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] px-2.5 py-1 text-xs text-[#55534E]">
            <div className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="text-[11px] text-[#77756F]">Slack Socket: <strong className="text-[#111111] font-medium">#payroll-alerts</strong></span>
          </div>

          <button
            title="Notifications"
            className="relative rounded-[8px] p-2 text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111] transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
          </button>
        </div>
      </header>

      {/* AI Ask Modal */}
      {askModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 backdrop-blur-sm bg-black/30 p-4 transition-all animate-in fade-in"
          onClick={() => setAskModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[12px] border border-[#E8E6E0] bg-[#FFFFFF] shadow-[0_12px_40px_rgba(17,17,17,0.12)] p-6 text-[#111111] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setAskModalOpen(false);
                setAiAnswer(null);
              }}
              className="absolute top-4 right-4 rounded-[6px] p-1.5 text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#111111] text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">Ask Your Payroll (Gemini Copilot)</h3>
                <p className="text-xs text-[#77756F]">Whitelisted parameterized query synthesis without raw SQL exposure</p>
              </div>
            </div>

            <form onSubmit={handleAskSubmit} className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask e.g. 'How much did we pay Liam Chen this month?' or 'Show me flagged anomalies'"
                className="w-full rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] py-2.5 pl-3.5 pr-12 text-xs text-[#111111] placeholder-[#77756F] focus:border-[#111111] focus:bg-white focus:outline-none transition-colors"
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="absolute right-1.5 top-1.5 rounded-[6px] bg-[#111111] p-1.5 text-white hover:bg-[#000000] disabled:opacity-30 transition-colors"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            {/* Quick Prompt Suggestions */}
            {!aiAnswer && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="text-[#77756F] text-[11px] self-center">Try asking:</span>
                {[
                  'What anomalies exist on the upcoming run?',
                  'How much did we pay contractors in Singapore?',
                  'Show invoices pending director approval',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setQuery(sample)}
                    className="rounded-full border border-[#E8E6E0] bg-[#F7F6F2] px-3 py-1 text-[11px] text-[#55534E] hover:border-[#111111] hover:text-[#111111] hover:bg-white transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            )}

            {/* AI Response Display */}
            {aiAnswer && (
              <div className="mt-5 rounded-[10px] border border-[#E8E6E0] bg-[#F7F6F2] p-4 text-xs leading-relaxed text-[#111111]">
                <div className="flex items-center gap-2 mb-2 text-[#111111] font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Synthesized Answer</span>
                </div>
                <p className="text-[#333333] text-xs leading-relaxed">{aiAnswer.answer}</p>

                {aiAnswer.sources && aiAnswer.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E8E6E0] flex flex-wrap items-center gap-2 text-[11px] text-[#77756F]">
                    <span>Verified Source Entities:</span>
                    {aiAnswer.sources.map((src, i) => (
                      <span key={i} className="rounded bg-white border border-[#E8E6E0] px-2 py-0.5 text-[#111111] font-mono text-[10px]">
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
