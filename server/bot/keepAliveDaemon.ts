import { baileysBot } from './baileys';
import { sessionManager } from './sessionManager';

export interface DaemonConfig {
  enabled: boolean;
  pingIntervalSec: number;
  antiSleepHttpLoop: boolean;
  autoRecoverSocket: boolean;
  maxMemoryThresholdMb: number;
  preventIdleDisconnect: boolean;
}

export interface DaemonStatus {
  enabled: boolean;
  state: 'active' | 'standby' | 'recovering';
  uptimeSeconds: number;
  startedAt?: string;
  totalHeartbeats: number;
  autoRecoveries: number;
  lastHeartbeatAt?: string;
  lastHealthCheckLatencyMs: number;
  memoryUsageMb: number;
  config: DaemonConfig;
  webhookUrl: string;
}

export class KeepAliveDaemonService {
  private timer: NodeJS.Timeout | null = null;
  private gcTimer: NodeJS.Timeout | null = null;
  private startedAt?: string;
  private totalHeartbeats: number = 0;
  private autoRecoveries: number = 0;
  private lastHeartbeatAt?: string;
  private lastLatencyMs: number = 12;

  private config: DaemonConfig = {
    enabled: true,
    pingIntervalSec: 25,
    antiSleepHttpLoop: true,
    autoRecoverSocket: true,
    maxMemoryThresholdMb: 380,
    preventIdleDisconnect: true,
  };

  constructor() {
    // Start autonomous daemon by default on server launch
    this.startDaemon();
  }

  public startDaemon(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    this.config.enabled = true;
    this.startedAt = new Date().toISOString();
    baileysBot.addLog('info', '24/7 Keep-Alive Autonomous Daemon activated. Anti-sleep loop initialized.');

    // Main 25-second keep-alive loop
    this.timer = setInterval(async () => {
      await this.runHeartbeatCycle();
    }, this.config.pingIntervalSec * 1000);

    // Watchdog Memory & GC purge loop every 3 minutes
    this.gcTimer = setInterval(() => {
      this.runMemoryAudit();
    }, 180000);

    // Trigger initial heartbeat immediately
    this.runHeartbeatCycle().catch(() => {});
  }

  public stopDaemon(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    this.config.enabled = false;
    baileysBot.addLog('warn', '24/7 Keep-Alive Daemon paused by Administrator.');
  }

  public async runHeartbeatCycle(): Promise<void> {
    if (!this.config.enabled) return;

    const startT = Date.now();
    this.totalHeartbeats++;
    this.lastHeartbeatAt = new Date().toISOString();

    // 1. Anti-Sleep HTTP Keep-Warm Ping (prevents cloud container idling)
    if (this.config.antiSleepHttpLoop) {
      try {
        const port = process.env.PORT || 3000;
        await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) });
      } catch (err) {
        // internal loopback fallback
      }
    }

    // 2. Check Bot Socket Health & Auto-Recover
    const botStatus = baileysBot.getStatus();
    const hasSession = sessionManager.hasActiveSession();

    if (this.config.autoRecoverSocket && hasSession) {
      // If we have registered credentials but status is disconnected or error, resurrect socket!
      if (botStatus.status === 'disconnected' || botStatus.status === 'error') {
        this.autoRecoveries++;
        baileysBot.addLog('security', `[DAEMON WATCHDOG] Socket disconnected with valid session! Initiating autonomous resurrection #${this.autoRecoveries}...`);
        try {
          await baileysBot.startBot();
        } catch (recoverErr: any) {
          baileysBot.addLog('error', `Autonomous resurrection attempt failed: ${recoverErr.message}`);
        }
      }
    }

    this.lastLatencyMs = Date.now() - startT;
  }

  private runMemoryAudit(): void {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);

    if (heapUsedMb > this.config.maxMemoryThresholdMb) {
      baileysBot.addLog('warn', `[DAEMON MEMORY WATCHDOG] Heap exceeded ${this.config.maxMemoryThresholdMb}MB (Current: ${heapUsedMb}MB). Running buffer purge & GC...`);
      if (global.gc) {
        try {
          global.gc();
        } catch (e) {}
      }
    }
  }

  public getStatus(originHost?: string): DaemonStatus {
    const uptimeSec = this.startedAt ? Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000) : 0;
    const mem = process.memoryUsage();
    const botStatus = baileysBot.getStatus();

    let state: DaemonStatus['state'] = 'standby';
    if (this.config.enabled) {
      state = botStatus.status === 'error' ? 'recovering' : 'active';
    }

    const host = originHost || 'ais-dev-a2khm3gth3b7pcjt2bn63m-696894486903.europe-west2.run.app';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';

    return {
      enabled: this.config.enabled,
      state,
      uptimeSeconds: uptimeSec,
      startedAt: this.startedAt,
      totalHeartbeats: this.totalHeartbeats,
      autoRecoveries: this.autoRecoveries,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastHealthCheckLatencyMs: Math.max(8, this.lastLatencyMs),
      memoryUsageMb: Math.round(mem.heapUsed / 1024 / 1024),
      config: { ...this.config },
      webhookUrl: `${protocol}://${host}/api/daemon/ping`
    };
  }

  public updateConfig(newConfig: Partial<DaemonConfig>): DaemonConfig {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.pingIntervalSec && this.config.enabled) {
      this.startDaemon(); // restart with new interval
    }
    baileysBot.addLog('info', '24/7 Daemon watchdog parameters updated.');
    return { ...this.config };
  }
}

export const keepAliveDaemon = new KeepAliveDaemonService();
