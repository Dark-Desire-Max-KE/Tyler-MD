import React from 'react';
import { ConnectionStateInfo, BotConfig } from '../types';
import { Play, Square, RotateCw, Shield, Terminal, Zap, Cpu, Clock, Radio, Activity, Lock, Unlock, LogOut } from 'lucide-react';

interface HeaderProps {
  status: ConnectionStateInfo;
  config: BotConfig;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onToggleMode: () => void;
  onOpenLogs: () => void;
  isActionLoading: boolean;
  isAdminAuthenticated: boolean;
  onOpenAdminLogin: () => void;
  onExitAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  config,
  onStart,
  onStop,
  onRestart,
  onToggleMode,
  onOpenLogs,
  isActionLoading,
  isAdminAuthenticated,
  onOpenAdminLogin,
  onExitAdmin,
}) => {
  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (status.status) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Online</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Connecting</span>
          </div>
        );
      case 'qr_ready':
      case 'pairing_code_ready':
        return (
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Pairing Ready</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Socket Error</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-600"></span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">Standby</span>
          </div>
        );
    }
  };

  return (
    <header className="border-b border-purple-900/30 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40 px-4 lg:px-8 py-3.5 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand and Bot Identity */}
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl overflow-hidden border border-purple-500/50 shadow-lg shadow-purple-950/50 relative shrink-0">
            <img
              src="/images/tyler_md_avatar_1790893655486.jpg"
              alt="Tyler MD"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                {config.botName}
                <span className="text-[10px] font-mono tracking-widest text-purple-300 uppercase bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/60">
                  {isAdminAuthenticated ? '👑 ADMIN ROOT' : '🌸 v5.0'}
                </span>
              </h1>
              {isAdminAuthenticated && (
                <>
                  <span className="text-slate-600">/</span>
                  {getStatusBadge()}
                </>
              )}
            </div>
            {isAdminAuthenticated && (
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                <span>Owner: {config.ownerName}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>Prefix: [{config.prefix}]</span>
                {status.phoneNumber && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-emerald-400">+{status.phoneNumber}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Action Area */}
        {isAdminAuthenticated ? (
          /* When in Admin Mode: Show full controls and live diagnostics */
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Diagnostics Metrics */}
            <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-300 bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-200">{formatUptime(status.uptimeSeconds)}</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">18ms</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-400">{status.messagesReceived}/{status.messagesSent}</span>
              </div>
            </div>

            {/* Socket Control Actions */}
            <div className="flex items-center gap-2">
              {status.status === 'connected' ? (
                <button
                  onClick={onStop}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-medium transition-colors"
                  title="Stop Baileys Socket"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={onStart}
                  disabled={isActionLoading || status.status === 'connecting'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-colors disabled:opacity-50"
                  title="Start Baileys Socket"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start</span>
                </button>
              )}

              <button
                onClick={onRestart}
                disabled={isActionLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-medium transition-colors"
                title="Restart Service"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={onToggleMode}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  config.workMode === 'public'
                    ? 'bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border-cyan-800/50'
                    : 'bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border-amber-800/50'
                }`}
                title="Toggle Public / Self Mode"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="capitalize">{config.workMode}</span>
              </button>
            </div>
          </div>
        ) : (
          /* When on Public Pairing Page: The Admin Button ONLY */
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/60 border border-purple-400/50 transition-all hover:scale-[1.02]"
              title="Authenticate with admin password"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Login</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
