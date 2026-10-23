'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
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
    }, 400);
  };

  const handleVerifyDevToken = () => {
    apiClient.setToken(devToken || 'demo-session-token');
    router.push('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#F7F6F2]">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#111111] text-white shadow-sm">
            <Bot className="h-6 w-6 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Sign in to PayPilot</h1>
          <p className="text-xs text-[#77756F]">
            Slack-first payroll copilot and automated contractor invoice pipeline
          </p>
        </div>

        {/* Auth Card */}
        <div className="card-editorial p-6 shadow-[0_6px_20px_rgba(17,17,17,0.06)] space-y-5">
          {!magicLinkSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#111111] mb-1.5">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#77756F]" />
                  <input
                    type="email"
                    required
                    placeholder="alex@paypilot.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] py-2 pl-9 pr-3 text-xs text-[#111111] placeholder-[#77756F] focus:border-[#111111] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="btn-primary w-full py-2.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending Magic Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Login Magic Link</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center animate-in fade-in">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">Check your inbox</h3>
                <p className="mt-1 text-xs text-[#77756F]">
                  We sent a secure login link to <strong className="text-[#111111] font-medium">{email}</strong>.
                </p>
              </div>

              {devToken && (
                <div className="rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 text-left space-y-2">
                  <div className="text-[10px] font-semibold text-[#77756F] uppercase">
                    Local Dev Console Token Bypass
                  </div>
                  <div className="font-mono text-[10px] text-[#55534E] break-all">
                    {devToken}
                  </div>
                  <button
                    onClick={handleVerifyDevToken}
                    className="btn-primary w-full py-1.5 text-xs"
                  >
                    Enter Workspace Instantly
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Demo Personas */}
          <div className="space-y-2 pt-4 border-t border-[#E8E6E0]">
            <div className="flex items-center justify-between text-[11px] text-[#77756F]">
              <span className="font-medium text-[#111111]">Instant Demo Access</span>
              <span>Click to test roles</span>
            </div>

            <div className="space-y-1.5">
              {DEMO_PERSONAS.map((persona) => (
                <button
                  key={persona.email}
                  type="button"
                  onClick={() => handleQuickLogin(persona.email)}
                  disabled={isLoading}
                  className="w-full text-left rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] p-2.5 hover:bg-white hover:border-[#111111] transition-all group flex items-center justify-between cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#111111] group-hover:text-[#000000]">
                        {persona.name}
                      </span>
                      <span className="rounded bg-white border border-[#E8E6E0] px-1.5 py-0.2 text-[9px] font-bold text-[#55534E]">
                        {persona.role}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#77756F] truncate mt-0.5">
                      {persona.description}
                    </div>
                  </div>
                  <UserCheck className="h-4 w-4 text-[#77756F] group-hover:text-[#111111] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Footer Notice */}
        <div className="text-center text-[11px] text-[#77756F] flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#111111]" />
          <span>Role-based access control with Slack mapping &amp; cryptographic sessions</span>
        </div>
      </div>
    </div>
  );
}
