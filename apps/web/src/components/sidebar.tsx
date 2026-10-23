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
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-[#E8E6E0] bg-[#FFFFFF] shadow-[0_2px_8px_rgba(17,17,17,0.02)]">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-[#E8E6E0] px-5">
        <Link href="/" className="flex items-center gap-2.5 interactive-tap">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#111111] text-white shadow-sm">
            <Bot className="h-4 w-4 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-[#111111] flex items-center gap-1.5">
              PayPilot
              <span className="rounded-full bg-[#F7F6F2] px-1.5 py-0.2 text-[10px] font-medium tracking-wide text-[#55534E] border border-[#E8E6E0]">
                PRO
              </span>
            </span>
            <span className="text-[11px] font-normal text-[#77756F]">Slack-First Payroll</span>
          </div>
        </Link>
      </div>

      {/* Organization Switcher Card */}
      <div className="p-3">
        <div className="flex items-center justify-between rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2]/60 p-2 hover:bg-[#F7F6F2] transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#FFFFFF] border border-[#E8E6E0] text-[#111111]">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="truncate text-left">
              <div className="truncate text-xs font-medium text-[#111111]">{MOCK_COMPANY.name}</div>
              <div className="text-[10px] text-[#77756F]">USD · {MOCK_COMPANY.plan}</div>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-[#77756F] shrink-0" />
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm font-medium">
        <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-[#77756F] uppercase">
          WORKSPACE
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between rounded-[8px] px-2.5 py-2 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#111111] text-white shadow-sm font-medium'
                  : 'text-[#55534E] hover:bg-[#F7F6F2] hover:text-[#111111]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-white' : 'text-[#77756F] group-hover:text-[#111111]'
                  }`}
                />
                <span>{item.name}</span>
              </div>

              {item.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wider ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badgeColor === 'rose'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : item.badgeColor === 'amber'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : item.badgeColor === 'emerald'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-[#F7F6F2] text-[#77756F] border border-[#E8E6E0]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Slack Copilot Status Notice */}
        <div className="pt-4 px-1">
          <div className="rounded-[10px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 text-left">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111111]">
              <Sparkles className="h-3.5 w-3.5 text-[#111111]" />
              <span>Slack Autonomous Pilot</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#77756F]">
              Connected to <code className="text-[#111111] font-mono text-[10px] bg-white px-1 py-0.5 rounded border border-[#E8E6E0]">#payroll-alerts</code>. Next run auto-preview in 8 hrs.
            </p>
          </div>
        </div>
      </nav>

      {/* User Footer Profile */}
      <div className="border-t border-[#E8E6E0] p-3">
        <div className="flex items-center justify-between rounded-[8px] p-2 hover:bg-[#F7F6F2] transition-colors">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111111] font-medium text-white text-xs">
              <span>AR</span>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="truncate text-left">
              <div className="truncate text-xs font-medium text-[#111111]">{MOCK_USER.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-[#F7F6F2] px-1 py-0.2 text-[9px] font-semibold text-[#55534E] border border-[#E8E6E0]">
                  {MOCK_USER.role}
                </span>
                <span className="text-[10px] text-[#77756F] truncate">alex@paypilot...</span>
              </div>
            </div>
          </div>
          <Link
            href="/auth/login"
            title="Switch User / Logout"
            className="rounded p-1.5 text-[#77756F] hover:bg-white hover:text-[#111111] transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
