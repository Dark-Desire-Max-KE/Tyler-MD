import React, { useState } from 'react';
import { BotLog } from '../types';
import { Terminal, Copy, Check, Trash2, Filter } from 'lucide-react';

interface LogsModalProps {
  logs: BotLog[];
  isOpen: boolean;
  onClose: () => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({ logs, isOpen, onClose }) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => filterLevel === 'all' || l.level === filterLevel);

  const handleCopyLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadgeClass = (level: BotLog['level']) => {
    switch (level) {
      case 'success':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
      case 'security':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
      case 'warn':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'error':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
      default:
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-4xl w-full h-[650px] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="bg-slate-900/80 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live Baileys Engine Event Stream</h3>
            <span className="text-xs text-slate-500">({logs.length} events logged)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-slate-900/40 px-5 py-2 border-b border-slate-800/80 flex items-center gap-2 text-xs">
          <span className="text-slate-500">Level:</span>
          {['all', 'info', 'success', 'security', 'warn', 'error'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-2 py-0.5 rounded capitalize transition-colors ${
                filterLevel === lvl
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Logs Terminal Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-1.5 text-xs bg-slate-950">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 hover:bg-slate-900/50 p-1 rounded">
              <span className="text-slate-500 select-none text-[11px] shrink-0">
                {log.timestamp}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded border text-[10px] font-bold uppercase shrink-0 ${getLevelBadgeClass(
                  log.level
                )}`}
              >
                {log.level}
              </span>
              <span className="text-slate-300 break-all leading-relaxed">
                {log.message}
              </span>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="text-center py-16 text-slate-600">
              No log events match the selected level.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
