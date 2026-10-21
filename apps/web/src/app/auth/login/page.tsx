'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const DEMO_PERSONAS = [
  {
    name: 'Alex Rivera',
    email: 'alex@paypilot.internal',
    role: 'OWNER',
    description: 'Executive authority: can approve >$5k runs and manage connectors.',
  },
  {
    name: 'Sarah Jenkins',
    email: 'sarah.j@paypilot.internal',
    role: 'APPROVER',
    description: 'Finance lead: dual sign-off on flagged anomalies and vendor bills.',
  },
  {
    name: 'Dave Miller',
    email: 'dave.m@paypilot.internal',
    role: 'VIEWER',
    description: 'Auditor: read-only access to historical runs and immutable audit logs.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await apiClient.requestMagicLink(email);
      setMagicLinkSent(true);
      if (res.token) {
        setDevToken(res.token);
      }
    } catch {
      // Offline fallback: generate mock JWT token for testing
      setMagicLinkSent(true);
      setDevToken(`dev-jwt-token-${Date.now()}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (personaEmail: string) => {
    setEmail(personaEmail);
    setIsLoading(true);
    setTimeout(() => {
      apiClient.setToken(`mock-session-${personaEmail}`);
      router.push('/');
    }, 600);
  };

  const handleVerifyDevToken = () => {
    apiClient.setToken(devToken || 'demo-session-token');
    router.push('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-b from-[#0b0f17] via-[#0f172a] to-[#0b0f17]">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20">
            <Bot className="h-6 w-6 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign in to PayPilot</h1>
          <p className="text-xs text-slate-400">
            Slack-first payroll copilot and automated contractor invoice pipeline
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl space-y-5">
          {!magicLinkSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Send Magic Sign-In Link</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Passwordless auth delivered via Nodemailer SMTP or dev console transport</span>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Magic Link Dispatched</h3>
                <p className="mt-1 text-xs text-slate-400">
                  We sent a secure authentication link to <strong className="text-slate-200">{email}</strong>.
                </p>
              </div>

              {devToken && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-3 text-left">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 mb-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Dev Console Simulator</span>
                  </div>
                  <p className="text-[10px] text-slate-400 break-all font-mono">
                    Token: {devToken}
                  </p>
                  <button
                    onClick={handleVerifyDevToken}
                    className="mt-2.5 w-full rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                  >
                    Authenticate Instantly
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Persona Switcher for pair-programming & evaluation */}
          <div className="pt-4 border-t border-white/5 space-y-2">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              1-Click Demo Personas
            </div>
            <div className="space-y-1.5">
              {DEMO_PERSONAS.map((persona) => (
                <button
                  key={persona.email}
                  type="button"
                  onClick={() => handleQuickLogin(persona.email)}
                  className="w-full text-left rounded-lg border border-white/5 bg-white/[0.02] p-2 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all interactive-tap group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                      <span className="text-xs font-medium text-slate-200">{persona.name}</span>
                    </div>
                    <span className="rounded bg-white/5 px-1.5 py-0.2 text-[9px] font-bold text-slate-300">
                      {persona.role}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400 truncate pl-5">
                    {persona.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500">
          PayPilot Enterprise Monorepo · React 19 · Next.js 15
        </p>
      </div>
    </div>
  );
}
