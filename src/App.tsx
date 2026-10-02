import React, { useState, useEffect } from 'react';
import {
  ConnectionStateInfo,
  BotConfig,
  SessionInfo,
  PluginCommand,
  AutoReplyRule,
  BotLog,
  ChatMessage,
} from './types';
import { Header } from './components/Header';
import { TabsNav, AdminTabId } from './components/TabsNav';
import { PairingPanel } from './components/PairingPanel';
import { AdminMasterPanel } from './components/AdminMasterPanel';
import { MenuPanel } from './components/MenuPanel';
import { GroupManagerPanel } from './components/GroupManagerPanel';
import { AutoRepliesPanel } from './components/AutoRepliesPanel';
import { SecurityPanel } from './components/SecurityPanel';
import { PluginsPanel } from './components/PluginsPanel';
import { SimulatorPanel } from './components/SimulatorPanel';
import { ExportDeployPanel } from './components/ExportDeployPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { LogsModal } from './components/LogsModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { FloatingGalaxy } from './components/FloatingGalaxy';
import { DaemonServerPanel } from './components/DaemonServerPanel';

const DEFAULT_CONFIG: BotConfig = {
  botName: 'Tyler MD',
  ownerName: 'Tyler',
  ownerNumber: '1234567890',
  prefix: '.',
  workMode: 'public',
  autoRead: false,
  autoTyping: false,
  autoReact: false,
  autoReactEmoji: '⚡',
  antiBug: true,
  antiLink: true,
  antiLinkAction: 'delete',
  antiDelete: true,
  antiSpam: true,
  antiToxic: true,
  antiDemote: true,
  welcomeMessage: '👋 Welcome to *{group}*, {user}! Enjoy your stay.',
  goodbyeMessage: '👋 Farewell {user} from *{group}*.',
  maxMessageLength: 4000,
};

export default function App() {
  const [adminTab, setAdminTab] = useState<AdminTabId>('runtime');
  const [status, setStatus] = useState<ConnectionStateInfo>({
    status: 'disconnected',
    uptimeSeconds: 0,
    messagesReceived: 0,
    messagesSent: 0,
  });
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [session, setSession] = useState<SessionInfo>({
    exists: false,
    registered: false,
    fileCount: 0,
    sizeKb: 0,
  });
  const [plugins, setPlugins] = useState<PluginCommand[]>([]);
  const [autoReplies, setAutoReplies] = useState<AutoReplyRule[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);

  // Admin Master Authorization with password "bot2026"
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tyler_admin_authenticated') === 'true';
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  // Initial simulated messages
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      senderName: 'Tyler MD',
      text: '🌸 *Tyler MD v5.0 WhatsApp Bot Engine Initialized*\n\nType *.menu* to inspect full cyber anime command matrix with 430+ commands, or test group tools like *.tagall*, *.antibug*, *.warn*, *.tiktok*, *.ai*.',
      timestamp: '15:10',
    },
  ]);

  // Periodic polling for status and logs
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.config) setConfig(data.config);
        if (data.session) setSession(data.session);
      }
    } catch (e) {
      console.error('Failed to poll bot status:', e);
    }
  };

  const fetchPlugins = async () => {
    try {
      const res = await fetch('/api/plugins');
      if (res.ok) {
        const data = await res.json();
        setPlugins(data);
      }
    } catch (e) {
      console.error('Failed to fetch plugins:', e);
    }
  };

  const fetchAutoReplies = async () => {
    try {
      const res = await fetch('/api/autoreplies');
      if (res.ok) {
        const data = await res.json();
        setAutoReplies(data);
      }
    } catch (e) {
      console.error('Failed to fetch auto replies:', e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchPlugins();
    fetchAutoReplies();
    fetchLogs();

    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Bot Lifecycle Handlers
  const handleStartBot = async () => {
    setIsActionLoading(true);
    try {
      await fetch('/api/bot/start', { method: 'POST' });
      await fetchStatus();
    } catch (e) {
      console.error('Start error:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStopBot = async () => {
    setIsActionLoading(true);
    try {
      await fetch('/api/bot/stop', { method: 'POST' });
      await fetchStatus();
    } catch (e) {
      console.error('Stop error:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestartBot = async () => {
    setIsActionLoading(true);
    try {
      await fetch('/api/bot/restart', { method: 'POST' });
      await fetchStatus();
    } catch (e) {
      console.error('Restart error:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleMode = async () => {
    const newMode = config.workMode === 'public' ? 'self' : 'public';
    await handleUpdateConfig({ workMode: newMode });
  };

  const handleRequestPairingCode = async (phone: string) => {
    const res = await fetch('/api/bot/pairing-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to request pairing code');
    }
    await fetchStatus();
  };

  const handleResetPairing = async () => {
    try {
      await fetch('/api/bot/reset-pairing', { method: 'POST' });
      await fetchStatus();
    } catch (e) {
      console.error('Reset pairing error:', e);
    }
  };

  const handleUpdateConfig = async (newConfig: Partial<BotConfig>) => {
    try {
      const res = await fetch('/api/bot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  };

  // Admin Login & Logout Handlers
  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    localStorage.setItem('tyler_admin_authenticated', 'true');
    setAdminTab('runtime');
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem('tyler_admin_authenticated');
  };

  // Plugins Handlers
  const handleTogglePlugin = async (id: string) => {
    try {
      const res = await fetch(`/api/plugins/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        await fetchPlugins();
      }
    } catch (e) {
      console.error('Toggle plugin error:', e);
    }
  };

  const handleCreatePlugin = async (newPlugin: any) => {
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlugin),
      });
      if (res.ok) {
        await fetchPlugins();
      }
    } catch (e) {
      console.error('Create plugin error:', e);
    }
  };

  const handleDeletePlugin = async (id: string) => {
    try {
      const res = await fetch(`/api/plugins/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPlugins();
      }
    } catch (e) {
      console.error('Delete plugin error:', e);
    }
  };

  // Auto-Reply Handlers
  const handleAddAutoReply = async (rule: Omit<AutoReplyRule, 'id'>) => {
    try {
      const res = await fetch('/api/autoreplies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (res.ok) {
        await fetchAutoReplies();
      }
    } catch (e) {
      console.error('Add rule error:', e);
    }
  };

  const handleToggleAutoReply = async (id: string) => {
    try {
      const res = await fetch(`/api/autoreplies/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        await fetchAutoReplies();
      }
    } catch (e) {
      console.error('Toggle rule error:', e);
    }
  };

  const handleDeleteAutoReply = async (id: string) => {
    try {
      const res = await fetch(`/api/autoreplies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAutoReplies();
      }
    } catch (e) {
      console.error('Delete rule error:', e);
    }
  };

  // Session Handlers
  const handleClearSession = async () => {
    if (!window.confirm('Are you sure you want to clear current session credentials? You will need to re-pair with WhatsApp.')) {
      return;
    }
    try {
      await fetch('/api/session', { method: 'DELETE' });
      await fetchStatus();
    } catch (e) {
      console.error('Clear session error:', e);
    }
  };

  const handleImportSession = async (sessionStr: string) => {
    const res = await fetch('/api/session/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionString: sessionStr }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to import session');
    }
    await fetchStatus();
  };

  // Simulator Inbound Message Dispatcher
  const handleSendMessage = async (
    text: string,
    persona: { isGroup: boolean; isAdmin: boolean; isOwner: boolean }
  ) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;

    setChatHistory((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        senderName: persona.isOwner ? config.ownerName : persona.isAdmin ? 'Group Admin' : 'Member',
        text,
        timestamp: nowTime,
      },
    ]);

    setSimLoading(true);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderJid: persona.isOwner ? `${config.ownerNumber}@s.whatsapp.net` : '19876543210@s.whatsapp.net',
          senderName: persona.isOwner ? config.ownerName : persona.isAdmin ? 'Admin' : 'Member',
          isGroup: persona.isGroup,
          groupJid: persona.isGroup ? '12036302@g.us' : undefined,
          groupName: persona.isGroup ? 'Tyler MD Cyber Anime HQ' : undefined,
          isAdmin: Boolean(persona.isAdmin),
          isOwner: Boolean(persona.isOwner),
          messageText: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.replyText) {
          setChatHistory((prev) => [
            ...prev,
            {
              id: `bot-${Date.now()}`,
              sender: data.replyType === 'alert' ? 'system' : 'bot',
              senderName: config.botName,
              text: data.replyText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              replyType: data.replyType,
              mediaUrl: data.mediaUrl,
              latencyMs: data.latencyMs,
            },
          ]);
        }
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'system',
          senderName: 'System',
          text: `Simulation error: ${err.message}`,
          timestamp: nowTime,
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const handleTryCommand = (cmd: string) => {
    setAdminTab('simulator');
    handleSendMessage(cmd, { isGroup: true, isAdmin: true, isOwner: true });
  };

  return (
    <div className="min-h-screen bg-[#02030a] text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-purple-500/40 selection:text-purple-200">
      {/* 🌌 Animated Floating Galaxy Background */}
      <FloatingGalaxy />

      {/* Top Command Bar */}
      <Header
        status={status}
        config={config}
        onStart={handleStartBot}
        onStop={handleStopBot}
        onRestart={handleRestartBot}
        onToggleMode={handleToggleMode}
        onOpenLogs={() => setIsLogsOpen(true)}
        isActionLoading={isActionLoading}
        isAdminAuthenticated={isAdminAuthenticated}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onExitAdmin={handleAdminLogout}
      />

      {/* IF ADMIN AUTHENTICATED: Show the Full Admin Operating System */}
      {isAdminAuthenticated ? (
        <>
          {/* Admin System Navigation Bar */}
          <TabsNav
            activeTab={adminTab}
            onTabChange={setAdminTab}
            onExitAdmin={handleAdminLogout}
            onOpenLogs={() => setIsLogsOpen(true)}
          />

          {/* Admin System Workspaces */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 relative z-10">
            {adminTab === 'server' && (
              <DaemonServerPanel />
            )}

            {adminTab === 'runtime' && (
              <AdminMasterPanel
                config={config}
                status={status}
                plugins={plugins}
                onRestart={handleRestartBot}
                onUpdateConfig={handleUpdateConfig}
                onExecuteCommand={handleTryCommand}
              />
            )}

            {adminTab === 'devices' && (
              <AdminMasterPanel
                config={config}
                status={status}
                plugins={plugins}
                onRestart={handleRestartBot}
                onUpdateConfig={handleUpdateConfig}
                onExecuteCommand={handleTryCommand}
              />
            )}

            {adminTab === 'menu' && (
              <MenuPanel
                plugins={plugins}
                config={config}
                onTryCommand={handleTryCommand}
              />
            )}

            {adminTab === 'groups' && (
              <GroupManagerPanel
                config={config}
                onUpdateConfig={handleUpdateConfig}
                onExecuteCommand={handleTryCommand}
              />
            )}

            {adminTab === 'autoreplies' && (
              <AutoRepliesPanel
                rules={autoReplies}
                config={config}
                onAddRule={handleAddAutoReply}
                onToggleRule={handleToggleAutoReply}
                onDeleteRule={handleDeleteAutoReply}
                onUpdateConfig={handleUpdateConfig}
              />
            )}

            {adminTab === 'security' && (
              <SecurityPanel
                config={config}
                onUpdateConfig={handleUpdateConfig}
                onExecuteCommand={handleTryCommand}
              />
            )}

            {adminTab === 'plugins' && (
              <PluginsPanel
                plugins={plugins}
                config={config}
                onTogglePlugin={handleTogglePlugin}
                onCreatePlugin={handleCreatePlugin}
                onDeletePlugin={handleDeletePlugin}
                onTryCommand={handleTryCommand}
              />
            )}

            {adminTab === 'simulator' && (
              <SimulatorPanel
                config={config}
                chatHistory={chatHistory}
                onSendMessage={handleSendMessage}
                onClearHistory={() => setChatHistory([])}
                isLoading={simLoading}
              />
            )}

            {adminTab === 'deploy' && (
              <ExportDeployPanel
                session={session}
                config={config}
                onClearSession={handleClearSession}
                onImportSession={handleImportSession}
              />
            )}

            {adminTab === 'settings' && (
              <SettingsPanel
                config={config}
                onUpdateConfig={handleUpdateConfig}
              />
            )}
          </main>
        </>
      ) : (
        /* IF NOT ADMIN: Ultra-Clean Dedicated WhatsApp API Pairing Gateway */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-10 relative z-10 flex flex-col justify-center">
          <PairingPanel
            status={status}
            session={session}
            onRequestPairingCode={handleRequestPairingCode}
            onRefreshQR={handleStartBot}
            onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
            onResetPairing={handleResetPairing}
            isLoading={isActionLoading}
          />
        </main>
      )}

      {/* Live Event Logs Modal */}
      <LogsModal
        logs={logs}
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />

      {/* Admin Login Modal (password: bot2026) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={handleAdminLoginSuccess}
        isAuthenticated={isAdminAuthenticated}
        onLogout={handleAdminLogout}
      />
    </div>
  );
}
