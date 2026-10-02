import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Cpu,
  Layers,
  Globe,
  Radio,
  Clock,
  Play,
  Pause,
  ExternalLink,
  HeartHandshake
} from 'lucide-react';

interface DaemonStatus {
  enabled: boolean;
  state: 'active' | 'standby' | 'recovering';
  uptimeSeconds: number;
  startedAt?: string;
  totalHeartbeats: number;
  autoRecoveries: number;
  lastHeartbeatAt?: string;
  lastHealthCheckLatencyMs: number;
  memoryUsageMb: number;
  config: {
    enabled: boolean;
    pingIntervalSec: number;
    antiSleepHttpLoop: boolean;
    autoRecoverSocket: boolean;
    maxMemoryThresholdMb: number;
    preventIdleDisconnect: boolean;
  };
  webhookUrl: string;
}

export const DaemonServerPanel: React.FC = () => {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [deployScripts, setDeployScripts] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pingSuccessNotice, setPingSuccessNotice] = useState<string | null>(null);
  const [activeDeployTab, setActiveDeployTab] = useState<'cloud' | 'systemd' | 'pm2' | 'docker'>('cloud');

  const fetchDaemonStatus = async () => {
    try {
      const res = await fetch('/api/daemon/status');
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch (e) {
      console.error('Failed to load daemon status:', e);
    }
  };

  const fetchDeployScripts = async () => {
    try {
      const res = await fetch('/api/daemon/deploy-scripts');
      if (res.ok) {
        setDeployScripts(await res.json());
      }
    } catch (e) {
      console.error('Failed to load deploy scripts:', e);
    }
  };

  useEffect(() => {
    fetchDaemonStatus();
    fetchDeployScripts();
    const interval = setInterval(fetchDaemonStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleDaemon = async () => {
    if (!status) return;
    setIsLoading(true);
    try {
      const newEnabled = !status.enabled;
      const res = await fetch('/api/daemon/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } catch (e) {
      console.error('Failed to toggle daemon:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateConfigOption = async (key: string, value: any) => {
    if (!status) return;
    try {
      const newConfig = { ...status.config, [key]: value };
      const res = await fetch('/api/daemon/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } catch (e) {
      console.error('Failed to update daemon parameter:', e);
    }
  };

  const handlePingNow = async () => {
    setIsPinging(true);
    setPingSuccessNotice(null);
    try {
      const res = await fetch('/api/daemon/ping-now', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setPingSuccessNotice(`Keep-alive pulse confirmed! Latency: ${data.status.lastHealthCheckLatencyMs}ms`);
        setTimeout(() => setPingSuccessNotice(null), 4000);
      }
    } catch (e) {
      console.error('Heartbeat ping failed:', e);
    } finally {
      setIsPinging(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Status Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-purple-950/80 to-slate-950 border border-purple-500/40 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-purple-600/20 border-2 border-purple-400/50 flex items-center justify-center text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <Server className="w-7 h-7 text-purple-300" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status?.enabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-slate-950 ${status?.enabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  24/7 Autonomous Cloud Server & Keep-Alive Daemon
                </h2>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  status?.enabled
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                }`}>
                  {status?.enabled ? 'DAEMON ONLINE (24/7 ACTIVE)' : 'DAEMON STANDBY'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-1">
                Self-healing background engine keeping WhatsApp Baileys active when your browser or PC is shut down
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePingNow}
              disabled={isPinging}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shadow"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-400 ${isPinging ? 'animate-bounce' : ''}`} />
              <span>{isPinging ? 'Pinging...' : 'Send Pulse'}</span>
            </button>

            <button
              onClick={handleToggleDaemon}
              disabled={isLoading}
              className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
                status?.enabled
                  ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
              }`}
            >
              {status?.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{status?.enabled ? 'Pause Daemon' : 'Activate 24/7 Engine'}</span>
            </button>
          </div>
        </div>

        {pingSuccessNotice && (
          <div className="mt-4 p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-xs font-mono text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{pingSuccessNotice}</span>
          </div>
        )}

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 font-mono">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Keep-Alive Pulses</span>
            </div>
            <div className="text-xl font-extrabold text-white">
              {status?.totalHeartbeats || 0}
            </div>
            <span className="text-[10px] text-slate-500">Every {status?.config.pingIntervalSec || 25}s</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 font-mono">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
              <HeartHandshake className="w-3.5 h-3.5 text-cyan-400" />
              <span>Auto-Resurrections</span>
            </div>
            <div className="text-xl font-extrabold text-cyan-400">
              {status?.autoRecoveries || 0}
            </div>
            <span className="text-[10px] text-slate-500">Zero-downtime revivals</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 font-mono">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Engine Continuous Uptime</span>
            </div>
            <div className="text-xl font-extrabold text-purple-300">
              {formatUptime(status?.uptimeSeconds || 0)}
            </div>
            <span className="text-[10px] text-slate-500">Cloud active</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 font-mono">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold mb-1">
              <Cpu className="w-3.5 h-3.5 text-pink-400" />
              <span>Heap / Watchdog</span>
            </div>
            <div className="text-xl font-extrabold text-white">
              {status?.memoryUsageMb || 64} <span className="text-xs text-slate-400">MB</span>
            </div>
            <span className="text-[10px] text-emerald-400">GC Auto-Purge Armed</span>
          </div>
        </div>
      </div>

      {/* 2. Anti-Sleep Webhook URL (For 100% Free 24/7 Uptime when PC is turned OFF) */}
      <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Permanent 24/7 Keep-Alive Webhook (Anti-Sleep Monitor)
              </h3>
              <p className="text-xs text-slate-400">
                Pinging this webhook keeps the cloud container 100% awake even when you close the browser or turn off your PC
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded">
            200 OK Response
          </span>
        </div>

        <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div className="truncate text-xs text-cyan-300 w-full select-all">
            {status?.webhookUrl || 'https://ais-dev-a2khm3gth3b7pcjt2bn63m-696894486903.europe-west2.run.app/api/daemon/ping'}
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={() => copyToClipboard(status?.webhookUrl || '', 'webhook')}
              className="px-3 py-1.5 rounded-lg bg-purple-900/70 hover:bg-purple-800 text-purple-200 border border-purple-600/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'webhook' ? 'Copied URL!' : 'Copy Ping URL'}</span>
            </button>
            <a
              href={status?.webhookUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test in Browser</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono text-slate-300 pt-1">
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80">
            <span className="text-purple-400 font-bold block mb-1">1. UptimeRobot (Free)</span>
            <p className="text-[11px] text-slate-400">
              Create an HTTP(s) monitor on uptimerobot.com, paste the URL above, and set interval to 5 mins. It pings your bot continuously 24/7.
            </p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80">
            <span className="text-cyan-400 font-bold block mb-1">2. Cron-Job.org (Free)</span>
            <p className="text-[11px] text-slate-400">
              Add a recurring cron job every 2 minutes targeting this endpoint to guarantee zero idle container sleep.
            </p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/80">
            <span className="text-pink-400 font-bold block mb-1">3. BetterStack / Healthchecks</span>
            <p className="text-[11px] text-slate-400">
              Receive instant SMS/Telegram alerts if the WhatsApp socket ever loses connection to WhatsApp servers.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Self-Healing Supervisor Controls */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <Shield className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Self-Healing Watchdog Configuration</h3>
            <p className="text-xs text-slate-400">Automated defense loops that prevent socket collapse and memory leaks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          {/* Anti-Sleep HTTP Loop */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>Internal Anti-Sleep HTTP Loop</span>
                <span className="text-[9px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800">
                  CORE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Periodically warms local HTTP routes so server process stays awake in cloud environments
              </p>
            </div>
            <button
              onClick={() => handleUpdateConfigOption('antiSleepHttpLoop', !status?.config.antiSleepHttpLoop)}
              className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                status?.config.antiSleepHttpLoop ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                status?.config.antiSleepHttpLoop ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Autonomous Socket Resurrection */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>Auto-Resurrect Dropped Sockets</span>
                <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                  DEFENSE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Detects WhatsApp server disconnects or network glitches and restarts the Baileys socket automatically
              </p>
            </div>
            <button
              onClick={() => handleUpdateConfigOption('autoRecoverSocket', !status?.config.autoRecoverSocket)}
              className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                status?.config.autoRecoverSocket ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                status?.config.autoRecoverSocket ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Prevent Idle Disconnect */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-white">Aggressive Presence Heartbeats</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Sends lightweight Noise protocol presence subscriptions so WhatsApp does not mark socket idle
              </p>
            </div>
            <button
              onClick={() => handleUpdateConfigOption('preventIdleDisconnect', !status?.config.preventIdleDisconnect)}
              className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                status?.config.preventIdleDisconnect ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                status?.config.preventIdleDisconnect ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Ping Frequency */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-white">Keep-Alive Frequency</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Interval between autonomous health checks and connection pulses
              </p>
            </div>
            <select
              value={status?.config.pingIntervalSec || 25}
              onChange={(e) => handleUpdateConfigOption('pingIntervalSec', Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-purple-300 font-mono focus:outline-none"
            >
              <option value={15}>Every 15s (Aggressive)</option>
              <option value={25}>Every 25s (Recommended)</option>
              <option value={45}>Every 45s (Balanced)</option>
              <option value={60}>Every 60s (Low Network)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Run On Your Own Dedicated Server (VPS / Cloud Export) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-pink-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Deploy On Your Own Dedicated Server (Ubuntu, VPS, Docker, PM2)
              </h3>
              <p className="text-xs text-slate-400">
                Full production scripts to run Tyler MD 24/7 indefinitely on any physical machine, cloud instance, or VPS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveDeployTab('cloud')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeDeployTab === 'cloud' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cloud 24/7
            </button>
            <button
              onClick={() => setActiveDeployTab('systemd')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeDeployTab === 'systemd' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Linux Service
            </button>
            <button
              onClick={() => setActiveDeployTab('pm2')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeDeployTab === 'pm2' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              PM2 Cluster
            </button>
            <button
              onClick={() => setActiveDeployTab('docker')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeDeployTab === 'docker' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Docker
            </button>
          </div>
        </div>

        {/* Tab 1: Cloud 24/7 Free Setup */}
        {activeDeployTab === 'cloud' && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono space-y-3">
            <p className="text-slate-300">
              To keep this bot alive 24/7 forever without paying for a server and even when your PC is turned off:
            </p>
            <div className="space-y-2 text-slate-400">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-1">Step 1: Copy Keep-Alive Webhook</span>
                <code className="text-cyan-300 block break-all text-[11px]">{status?.webhookUrl}</code>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-1">Step 2: Add to Uptime Monitoring Service</span>
                <p className="text-[11px]">
                  Sign up for free at <strong>uptimerobot.com</strong>, click <em>+ Add New Monitor</em>, choose <strong>HTTP(s)</strong>, paste the URL above, and choose <strong>5 minutes</strong> interval.
                </p>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-1">Step 3: Permanent Active Mode</span>
                <p className="text-[11px]">
                  UptimeRobot pings this server around the clock. The internal daemon responds with 200 OK, keeping the Node.js event loop active, memory fresh, and WhatsApp socket linked forever!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Systemd Service */}
        {activeDeployTab === 'systemd' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Save as: <strong className="text-white">/etc/systemd/system/tyler-md.service</strong></span>
              <button
                onClick={() => copyToClipboard(deployScripts?.systemdService || '', 'systemd')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 flex items-center gap-1.5"
              >
                {copiedKey === 'systemd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'systemd' ? 'Copied' : 'Copy Service Config'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto text-[11px]">
              {deployScripts?.systemdService}
            </pre>
            <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-purple-200 text-[11px] space-y-1">
              <p><strong>Commands to enable & start on Ubuntu / Debian:</strong></p>
              <code>sudo systemctl daemon-reload && sudo systemctl enable --now tyler-md</code>
            </div>
          </div>
        )}

        {/* Tab 3: PM2 */}
        {activeDeployTab === 'pm2' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Save as: <strong className="text-white">ecosystem.config.cjs</strong></span>
              <button
                onClick={() => copyToClipboard(deployScripts?.pm2Ecosystem || '', 'pm2')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 flex items-center gap-1.5"
              >
                {copiedKey === 'pm2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'pm2' ? 'Copied' : 'Copy PM2 Config'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto text-[11px]">
              {deployScripts?.pm2Ecosystem}
            </pre>
            <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-purple-200 text-[11px] space-y-1">
              <p><strong>Launch with PM2:</strong></p>
              <code>npm install -g pm2 && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup</code>
            </div>
          </div>
        )}

        {/* Tab 4: Docker Compose */}
        {activeDeployTab === 'docker' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Save as: <strong className="text-white">docker-compose.yml</strong></span>
              <button
                onClick={() => copyToClipboard(deployScripts?.dockerCompose || '', 'docker')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 flex items-center gap-1.5"
              >
                {copiedKey === 'docker' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'docker' ? 'Copied' : 'Copy Docker Compose'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto text-[11px]">
              {deployScripts?.dockerCompose}
            </pre>
            <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-purple-200 text-[11px] space-y-1">
              <p><strong>Start container:</strong></p>
              <code>docker-compose up -d</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
