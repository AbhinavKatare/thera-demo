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
  X,
  Copy,
  Check,
} from 'lucide-react';
import { MOCK_AUDIT_LOGS } from '@/lib/mock-data';
import { AuditLogItem } from '@/lib/api-client';

export default function AuditPage() {
  const [logs] = useState<AuditLogItem[]>(MOCK_AUDIT_LOGS);
  const [actorFilter, setActorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>('aud_001');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesActor = actorFilter === 'ALL' || log.actorType === actorFilter;
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesActor && matchesSearch;
  });

  const handleCopyLogId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#111111] flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#111111]" />
            <span>Immutable Audit Log</span>
          </h1>
          <p className="mt-1 text-xs text-[#77756F]">
            Append-only record of all approvals, rejections, extractions, and connector synchronizations.
          </p>
        </div>

        <div className="rounded-[8px] border border-[#E8E6E0] bg-white px-3.5 py-2 text-xs text-[#55534E] flex items-center gap-2 shadow-sm">
          <Database className="h-3.5 w-3.5 text-[#111111]" />
          <span>Write-Once Service Function Guaranteed</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card-editorial p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'USER', 'SERVICE', 'SYSTEM'].map((type) => (
            <button
              key={type}
              onClick={() => setActorFilter(type)}
              className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                actorFilter === type
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#77756F] hover:bg-[#F7F6F2] hover:text-[#111111]'
              }`}
            >
              {type === 'ALL' ? 'All Actors' : type}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#77756F]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action or resource ID..."
            className="w-full rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] py-1.5 pl-9 pr-8 text-xs text-[#111111] placeholder-[#77756F] focus:border-[#111111] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-[#77756F] hover:text-[#111111]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <div className="space-y-3">
        {filteredLogs.map((log) => {
          const isExpanded = expandedLogId === log.id;

          return (
            <div
              key={log.id}
              className="card-editorial p-4 transition-all hover:border-[#D6D4CE]"
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#F7F6F2] text-[#111111] border border-[#E8E6E0]">
                    {log.actorType === 'USER' ? (
                      <User className="h-4 w-4 text-[#111111]" />
                    ) : log.actorType === 'SERVICE' ? (
                      <Bot className="h-4 w-4 text-[#111111]" />
                    ) : (
                      <Cpu className="h-4 w-4 text-[#111111]" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#111111]">{log.action}</span>
                      <span className="rounded bg-[#F7F6F2] border border-[#E8E6E0] px-1.5 py-0.2 text-[9px] font-mono text-[#55534E]">
                        {log.resourceType}:{log.resourceId}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#77756F] mt-0.5">
                      Actor: <strong className="text-[#111111] font-medium">{log.actorId}</strong> ({log.actorType})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleCopyLogId(log.id, e)}
                    title="Copy Log ID"
                    className="p-1 rounded text-[#77756F] hover:text-[#111111] hover:bg-[#F7F6F2] transition-colors"
                  >
                    {copiedId === log.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                  <div className="text-right text-[11px] text-[#77756F] font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[#77756F]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#77756F]" />
                  )}
                </div>
              </div>

              {/* Expandable JSON Inspector */}
              {isExpanded && (
                <div className="mt-4 pt-3 border-t border-[#E8E6E0] grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                  <div className="rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 space-y-1">
                    <div className="text-[10px] font-semibold tracking-wider text-rose-800 uppercase">
                      Before State (Snapshot)
                    </div>
                    <pre className="font-mono text-[10px] text-[#333333] overflow-x-auto p-1 leading-relaxed">
                      {JSON.stringify(log.beforeJson ?? {}, null, 2)}
                    </pre>
                  </div>

                  <div className="rounded-[8px] border border-[#E8E6E0] bg-[#F7F6F2] p-3 space-y-1">
                    <div className="text-[10px] font-semibold tracking-wider text-emerald-800 uppercase">
                      After State (Delta)
                    </div>
                    <pre className="font-mono text-[10px] text-[#333333] overflow-x-auto p-1 leading-relaxed">
                      {JSON.stringify(log.afterJson ?? {}, null, 2)}
                    </pre>
                  </div>

                  {log.metadata && (
                    <div className="md:col-span-2 text-[10px] text-[#77756F] font-mono bg-white p-2 rounded border border-[#E8E6E0]">
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
