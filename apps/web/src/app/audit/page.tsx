'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  User,
  Cpu,
  Bot,
} from 'lucide-react';
import { MOCK_AUDIT_LOGS } from '@/lib/mock-data';
import { AuditLogItem } from '@/lib/api-client';

export default function AuditPage() {
  const [logs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);
  const [actorFilter, setActorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>('aud_001');

  const filteredLogs = logs.filter((log) => {
    const matchesActor = actorFilter === 'ALL' || log.actorType === actorFilter;
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesActor && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-emerald-400" />
            <span>Immutable Audit Log</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Append-only record of all approvals, rejections, extractions, and connector synchronizations.
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/60 px-3.5 py-2 text-xs text-slate-300 flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span>Write-Once Service Function Guaranteed</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          {['ALL', 'USER', 'SERVICE', 'SYSTEM'].map((type) => (
            <button
              key={type}
              onClick={() => setActorFilter(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                actorFilter === type
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              {type === 'ALL' ? 'All Actors' : type}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action or resource ID..."
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Log Feed */}
      <div className="space-y-3">
        {filteredLogs.map((log) => {
          const isExpanded = expandedLogId === log.id;

          return (
            <div
              key={log.id}
              className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 transition-all hover:border-white/10"
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                    {log.actorType === 'USER' ? (
                      <User className="h-4 w-4 text-emerald-400" />
                    ) : log.actorType === 'SERVICE' ? (
                      <Bot className="h-4 w-4 text-sky-400" />
                    ) : (
                      <Cpu className="h-4 w-4 text-amber-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-white">{log.action}</span>
                      <span className="rounded bg-white/5 px-1.5 py-0.2 text-[9px] font-mono text-slate-400">
                        {log.resourceType}:{log.resourceId}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Actor: <strong className="text-slate-300 font-medium">{log.actorId}</strong> ({log.actorType})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-[11px] text-slate-400 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expandable JSON Inspector */}
              {isExpanded && (
                <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                  <div className="rounded-xl border border-white/5 bg-slate-950 p-3 space-y-1">
                    <div className="text-[10px] font-semibold tracking-wider text-rose-400 uppercase">
                      Before State (Snapshot)
                    </div>
                    <pre className="font-mono text-[10px] text-slate-300 overflow-x-auto p-1 leading-relaxed">
                      {JSON.stringify(log.beforeJson ?? {}, null, 2)}
                    </pre>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-slate-950 p-3 space-y-1">
                    <div className="text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
                      After State (Delta)
                    </div>
                    <pre className="font-mono text-[10px] text-slate-300 overflow-x-auto p-1 leading-relaxed">
                      {JSON.stringify(log.afterJson ?? {}, null, 2)}
                    </pre>
                  </div>

                  {log.metadata && (
                    <div className="md:col-span-2 text-[10px] text-slate-500 font-mono">
                      Metadata: {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
