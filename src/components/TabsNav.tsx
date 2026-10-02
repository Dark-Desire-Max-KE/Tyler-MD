import React from 'react';
import {
  Server,
  Smartphone,
  ListFilter,
  Users,
  Bot,
  ShieldAlert,
  Puzzle,
  MessageSquare,
  DownloadCloud,
  Sliders,
  LogOut,
  Terminal,
  Activity
} from 'lucide-react';

export type AdminTabId =
  | 'server'
  | 'runtime'
  | 'devices'
  | 'menu'
  | 'groups'
  | 'autoreplies'
  | 'security'
  | 'plugins'
  | 'simulator'
  | 'deploy'
  | 'settings';

interface TabsNavProps {
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
  onExitAdmin: () => void;
  onOpenLogs: () => void;
}

export const TabsNav: React.FC<TabsNavProps> = ({
  activeTab,
  onTabChange,
  onExitAdmin,
  onOpenLogs,
}) => {
  const tabs = [
    {
      id: 'server' as AdminTabId,
      label: '24/7 Dedicated Server',
      icon: Server,
      badge: '24/7'
    },
    {
      id: 'runtime' as AdminTabId,
      label: 'Runtime & Health',
      icon: Activity,
    },
    {
      id: 'devices' as AdminTabId,
      label: 'Connected Devices',
      icon: Smartphone,
    },
    {
      id: 'menu' as AdminTabId,
      label: 'Command Matrix (430+)',
      icon: ListFilter,
    },
    {
      id: 'groups' as AdminTabId,
      label: 'Group Suite',
      icon: Users,
    },
    {
      id: 'autoreplies' as AdminTabId,
      label: 'Auto-Replies',
      icon: Bot,
    },
    {
      id: 'security' as AdminTabId,
      label: 'Anti-Bug Shield',
      icon: ShieldAlert,
    },
    {
      id: 'plugins' as AdminTabId,
      label: 'Plugins',
      icon: Puzzle,
    },
    {
      id: 'simulator' as AdminTabId,
      label: 'Chat Simulator',
      icon: MessageSquare,
    },
    {
      id: 'deploy' as AdminTabId,
      label: 'Deploy & Export',
      icon: DownloadCloud,
    },
    {
      id: 'settings' as AdminTabId,
      label: 'Bot Settings',
      icon: Sliders,
    },
  ];

  return (
    <div className="border-b border-purple-900/40 bg-slate-950/80 backdrop-blur-xl sticky top-[61px] z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between gap-3">
        {/* Admin Navigation Tabs */}
        <nav className="flex space-x-1.5 overflow-x-auto py-2.5 no-scrollbar" aria-label="Admin Navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-900/80 to-slate-800 text-white font-semibold border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-full animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Action Controls for Admin */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 text-xs font-mono transition-colors"
            title="Open Live Engine Logs"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Logs</span>
          </button>

          <button
            onClick={onExitAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-mono font-semibold transition-colors"
            title="Exit Admin System and return to Pairing Gateway"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock / Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
