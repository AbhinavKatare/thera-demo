'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Users,
  Banknote,
  CheckCircle2,
  Boxes,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Bot,
  LogOut,
  Building2,
} from 'lucide-react';
import { MOCK_COMPANY, MOCK_USER } from '@/lib/mock-data';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeColor?: 'rose' | 'amber' | 'emerald' | 'slate';
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: Receipt,
    badge: '1 review',
    badgeColor: 'amber',
  },
  {
    name: 'Contractors',
    href: '/contractors',
    icon: Users,
    badge: '8 active',
    badgeColor: 'slate',
  },
  {
    name: 'Payroll',
    href: '/payroll',
    icon: Banknote,
    badge: '3 flagged',
    badgeColor: 'rose',
  },
  {
    name: 'Approvals',
    href: '/approvals',
    icon: CheckCircle2,
    badge: '2 pending',
    badgeColor: 'amber',
  },
  {
    name: 'Integrations',
    href: '/integrations',
    icon: Boxes,
    badge: '3 live',
    badgeColor: 'emerald',
  },
  {
    name: 'Audit Log',
    href: '/audit',
    icon: ShieldAlert,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/5 bg-[#0b0f17]/95 backdrop-blur-xl">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
        <Link href="/" className="flex items-center gap-2.5 interactive-tap">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-bold text-slate-950 shadow-md shadow-emerald-500/20">
            <Bot className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight text-white flex items-center gap-1.5">
              PayPilot
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium tracking-wide text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </span>
            <span className="text-[11px] font-normal text-slate-400">Slack-First Payroll</span>
          </div>
        </Link>
      </div>

      {/* Organization Switcher Card */}
      <div className="p-3">
        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-300">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="truncate text-left">
              <div className="truncate text-xs font-medium text-slate-200">{MOCK_COMPANY.name}</div>
              <div className="text-[10px] text-slate-400">USD · {MOCK_COMPANY.plan}</div>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm font-medium">
        <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          WORKSPACE
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all interactive-tap ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.name}</span>
              </div>

              {item.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    item.badgeColor === 'rose'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                      : item.badgeColor === 'amber'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                      : item.badgeColor === 'emerald'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* AI Copilot Highlight Banner */}
        <div className="pt-4 px-1">
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-teal-500/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span>Slack Autonomous Pilot</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
              Socket Mode listening on <code className="text-emerald-300">#payroll-alerts</code>. Next run auto-preview in 8 hrs.
            </p>
          </div>
        </div>
      </nav>

      {/* User Footer Profile */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center justify-between rounded-lg p-2 hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 font-semibold text-white text-xs border border-white/10">
              <span>AR</span>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#0b0f17]" />
            </div>
            <div className="truncate text-left">
              <div className="truncate text-xs font-medium text-slate-200">{MOCK_USER.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[9px] font-bold tracking-wider text-emerald-400">
                  {MOCK_USER.role}
                </span>
                <span className="text-[10px] text-slate-400 truncate">alex@paypilot...</span>
              </div>
            </div>
          </div>
          <Link
            href="/auth/login"
            title="Switch User / Logout"
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
