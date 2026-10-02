export interface BotConfig {
  botName: string;
  ownerName: string;
  ownerNumber: string;
  prefix: string;
  workMode: 'public' | 'self';
  autoRead: boolean;
  autoTyping: boolean;
  autoReact: boolean;
  autoReactEmoji: string;
  antiBug: boolean;
  antiLink: boolean;
  antiLinkAction: 'delete' | 'warn' | 'kick';
  antiDelete: boolean;
  antiSpam: boolean;
  antiToxic: boolean;
  antiDemote: boolean;
  welcomeMessage: string;
  goodbyeMessage: string;
  maxMessageLength: number;
}

export interface ConnectionStateInfo {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'pairing_code_ready' | 'connected' | 'error';
  userJid?: string;
  userName?: string;
  phoneNumber?: string;
  qrCode?: string;
  qrRaw?: string;
  pairingCode?: string;
  uptimeSeconds: number;
  startedAt?: string;
  messagesReceived: number;
  messagesSent: number;
  lastError?: string;
  batteryLevel?: number;
  platform?: string;
  socketPingMs?: number;
  activeSockets?: number;
  totalDbSessions?: number;
  lastPairedSession?: {
    sessionId: string;
    phoneNumber: string;
    creds: string;
    pairedAt: string;
  };
}

export interface ConnectedDevice {
  id: string;
  name: string;
  platform: string;
  browser: string;
  phoneNumber: string;
  jid: string;
  linkedAt: string;
  lastSeen: string;
  status: 'online' | 'idle' | 'syncing';
  ipAddress: string;
  protocolVersion: string;
}

export interface AdminRuntimeMetrics {
  cpuUsagePercent: number;
  memoryHeapUsedMb: number;
  memoryHeapTotalMb: number;
  memoryRssMb: number;
  systemTotalRamMb: number;
  eventLoopDelayMs: number;
  nodeVersion: string;
  baileysVersion: string;
  platform: string;
  osUptimeHours: number;
  processUptimeSeconds: number;
  activeTimers: number;
  commandsTotalExecuted: number;
  commandsFailed: number;
  bugAttacksNeutralized: number;
  linksBlocked: number;
}

export type CommandCategory =
  | 'general'
  | 'group'
  | 'moderation'
  | 'security'
  | 'autoreply'
  | 'ai'
  | 'media'
  | 'stickers'
  | 'anime'
  | 'tools'
  | 'owner';

export interface PluginCommand {
  id: string;
  name: string;
  category: CommandCategory;
  description: string;
  usage: string;
  aliases?: string[];
  enabled: boolean;
  adminOnly?: boolean;
  groupOnly?: boolean;
  ownerOnly?: boolean;
  isCustom?: boolean;
  customCode?: string;
  executionCount?: number;
}

export interface AutoReplyRule {
  id: string;
  trigger: string;
  matchType: 'exact' | 'contains' | 'startsWith' | 'regex';
  response: string;
  enabled: boolean;
  isGroupOnly?: boolean;
  isPrivateOnly?: boolean;
  replyWithQuoted?: boolean;
  delayMs?: number;
}

export interface SessionInfo {
  exists: boolean;
  registered: boolean;
  userJid?: string;
  userName?: string;
  fileCount: number;
  sizeKb: number;
  platform?: string;
  sessionString?: string;
}

export interface BotLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'security';
  message: string;
  details?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  replyType?: 'text' | 'image' | 'sticker' | 'alert' | 'none';
  latencyMs?: number;
  bannerUrl?: string;
  mediaUrl?: string;
}
