import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { Boom } from '@hapi/boom';
import { toSansBold } from './pluginRegistry';
import { saveBotSessionToDb, markSessionPairedInDb } from '../db/firestore';

export interface IsolatedPairingRecord {
  clientSessionId: string;
  sessionId: string;
  phoneNumber: string;
  pairingCode?: string;
  status: 'idle' | 'generating' | 'ready' | 'paired' | 'error';
  errorMessage?: string;
  sessionCreds?: string;
  createdAt: string;
  expiresAt: number;
  inbotSent: boolean;
  pairedAt?: string;
  userName?: string;
}

export class MultiTenantPairingManager {
  private sessions: Map<string, IsolatedPairingRecord> = new Map();
  private sockets: Map<string, any> = new Map();
  private baseAuthDir = path.resolve(process.cwd(), 'auth_info_baileys', 'clients');

  constructor() {
    // Ensure base auth directory exists
    if (!fs.existsSync(this.baseAuthDir)) {
      try {
        fs.mkdirSync(this.baseAuthDir, { recursive: true });
      } catch (e) {}
    }

    // Run periodic garbage collection every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Get or create a private session space for a specific device
   */
  public getOrCreateClientSession(clientSessionId: string): IsolatedPairingRecord {
    let record = this.sessions.get(clientSessionId);
    if (!record) {
      record = {
        clientSessionId,
        sessionId: 'TYLER-MD~' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase(),
        phoneNumber: '',
        status: 'idle',
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 20 * 60 * 1000, // 20 min TTL
        inbotSent: false
      };
      this.sessions.set(clientSessionId, record);
    }
    return record;
  }

  /**
   * Get safe and private state for a given client device
   */
  public getClientStatus(clientSessionId: string): IsolatedPairingRecord | null {
    return this.sessions.get(clientSessionId) || null;
  }

  /**
   * Request an official WhatsApp pairing code inside an isolated, private socket sandbox
   */
  public async requestPairingCode(clientSessionId: string, phoneNumber: string): Promise<string> {
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleaned || cleaned.length < 9) {
      throw new Error('Please enter a valid international phone number with country code (e.g. 14155552671)');
    }

    // Close any previous socket for this client
    await this.closeClientSocket(clientSessionId);

    const record = this.getOrCreateClientSession(clientSessionId);
    record.phoneNumber = cleaned;
    record.status = 'generating';
    record.errorMessage = undefined;
    record.expiresAt = Date.now() + 20 * 60 * 1000;

    // Isolated directory for this client
    const clientAuthDir = path.resolve(this.baseAuthDir, clientSessionId);
    if (fs.existsSync(clientAuthDir)) {
      try {
        fs.rmSync(clientAuthDir, { recursive: true, force: true });
      } catch (e) {}
    }
    fs.mkdirSync(clientAuthDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(clientAuthDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as any }));

    const silentLogger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      emitOwnEvents: true,
      retryRequestDelayMs: 250,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false
    });

    this.sockets.set(clientSessionId, sock);

    sock.ev.on('creds.update', saveCreds);

    // Monitor connection events inside this isolated tenant
    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        record.status = 'paired';
        record.pairedAt = new Date().toISOString();

        const user = sock.user;
        const userJid = user?.id ? jidNormalizedUser(user.id) : undefined;
        record.userName = user?.name || user?.notify || 'Tyler User';

        // Read creds.json to export session string
        let credsBase64 = '';
        try {
          const credsFile = path.resolve(clientAuthDir, 'creds.json');
          if (fs.existsSync(credsFile)) {
            const raw = fs.readFileSync(credsFile, 'utf-8');
            credsBase64 = Buffer.from(raw).toString('base64');
            record.sessionCreds = credsBase64;
          }
        } catch (e) {}

        // Persist to Firestore cloud vault
        await markSessionPairedInDb(record.sessionId, credsBase64).catch(() => {});

        // Push inbot Session ID & Tyler MD About card directly into WhatsApp chat
        const targetJid = userJid || (record.phoneNumber ? `${record.phoneNumber}@s.whatsapp.net` : null);
        if (targetJid && !record.inbotSent) {
          record.inbotSent = true;
          await this.sendInbotWelcome(sock, targetJid, record.userName, record.phoneNumber, record.sessionId);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          record.status = 'error';
          record.errorMessage = 'Pairing session was logged out. Please request a new pairing code.';
        }
      }
    });

    // Wait for the socket connection to establish handshake with WhatsApp servers (up to 12s)
    let retries = 0;
    while ((!sock.ws || (sock.ws as any).readyState !== 1) && retries < 24) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }

    if (!sock.ws || (sock.ws as any).readyState !== 1) {
      record.status = 'error';
      record.errorMessage = 'Could not establish connection with WhatsApp servers. Please try again.';
      throw new Error('Could not establish connection with WhatsApp servers. Please try again.');
    }

    try {
      const rawCode = await sock.requestPairingCode(cleaned);
      let formattedCode = rawCode;
      if (rawCode && rawCode.length === 8 && !rawCode.includes('-')) {
        formattedCode = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`;
      }

      record.pairingCode = formattedCode;
      record.status = 'ready';

      // Save initial record to Firestore
      await saveBotSessionToDb({
        sessionId: record.sessionId,
        phoneNumber: cleaned,
        pairingCode: formattedCode,
        status: 'pending',
        createdAt: record.createdAt,
        devicePlatform: 'Multi-Tenant WhatsApp MD Gateway'
      }).catch(() => {});

      return formattedCode;
    } catch (err: any) {
      record.status = 'error';
      record.errorMessage = err.message || 'Failed to request pairing code';
      throw err;
    }
  }

  /**
   * Pushes the inbot Session ID & Tyler MD About onboarding message directly to user
   */
  private async sendInbotWelcome(sock: any, targetJid: string, userName: string, phoneNumber: string, sessionId: string) {
    const pushAboutText = `╔════════════════════════════════════════╗\n` +
      `   🌸 ${toSansBold('TYLER MD V5.0')} 🌸\n` +
      `   ( ${toSansBold('Cyber Anime Edition')} )\n` +
      `╚════════════════════════════════════════╝\n\n` +
      `╭───〔 🌸 ${toSansBold('SESSION VAULT')} 🌸 〕\n` +
      `│ 🔑 ${toSansBold('Session ID')} : *${sessionId}*\n` +
      `│ 👤 ${toSansBold('User')} : ${userName}\n` +
      `│ 📱 ${toSansBold('Phone')} : +${phoneNumber}\n` +
      `│ ⏱️ ${toSansBold('Paired')} : ${new Date().toUTCString()}\n` +
      `│ 🛡️ ${toSansBold('Status')} : ${toSansBold('PAIRED & VERIFIED')}\n` +
      `╰────────────────────────────────────────┈\n\n` +
      `╭───『 🌸 ${toSansBold('ABOUT TYLER MD')} 』\n` +
      `│ ⚡ ${toSansBold('Tyler MD')} is a hyper-fast, next-gen WhatsApp Multi-Device bot engineered for ultimate speed and stability.\n` +
      `│ 👑 ${toSansBold('Owner')} : Tyler\n` +
      `│ 🔑 ${toSansBold('Prefix')} : [ . ]\n` +
      `│ 📦 ${toSansBold('Features')} : 430+ Built-in Commands\n` +
      `│ 🛡️ ${toSansBold('Security')} : Anti-Crash, Anti-Bug Shield & Anti-Link Protection\n` +
      `│ 🌸 ${toSansBold('Anime')} : High-Definition Art Generator (.waifu, .neko, .wallpaper)\n` +
      `│ 🤖 ${toSansBold('Automation')} : Auto-Typing, Auto-React, Auto-Read Blue Ticks\n` +
      `│ 🧠 ${toSansBold('AI Core')} : Powered by Google Gemini Neural Intelligence\n` +
      `╰────────────────────────────────────────┈\n\n` +
      `💡 *${toSansBold('Quick Start')}*:\n` +
      `Type *.menu* to open your interactive cyber anime command matrix!\n` +
      `⚠️ *${toSansBold('Security Notice')}*: Keep your Session ID safe and never share it.\n\n` +
      `🌸 ${toSansBold('TYLER MD BAILEYS ENGINE')} 🌸`;

    try {
      const bannerPath = path.resolve(process.cwd(), 'src/assets/images/tyler_md_banner_1790893643188.jpg');
      let imagePayload: any;
      if (fs.existsSync(bannerPath)) {
        imagePayload = fs.readFileSync(bannerPath);
      } else {
        imagePayload = { url: '/src/assets/images/tyler_md_banner_1790893643188.jpg' };
      }

      await sock.sendMessage(targetJid, {
        image: imagePayload,
        caption: pushAboutText
      });
      console.log(`[MultiTenant] Sent inbot Session ID and Tyler MD About card to ${targetJid}`);
    } catch (err: any) {
      console.warn(`[MultiTenant] Image push failed, sending text fallback to ${targetJid}:`, err.message);
      try {
        await sock.sendMessage(targetJid, { text: pushAboutText });
      } catch (e: any) {
        console.error(`[MultiTenant] Could not push inbot text message to ${targetJid}:`, e.message);
      }
    }
  }

  /**
   * Reset pairing for a specific client device
   */
  public async resetClientSession(clientSessionId: string): Promise<void> {
    await this.closeClientSocket(clientSessionId);
    this.sessions.delete(clientSessionId);
    const clientAuthDir = path.resolve(this.baseAuthDir, clientSessionId);
    if (fs.existsSync(clientAuthDir)) {
      try {
        fs.rmSync(clientAuthDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  private async closeClientSocket(clientSessionId: string): Promise<void> {
    const sock = this.sockets.get(clientSessionId);
    if (sock) {
      try {
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.end(undefined);
      } catch (e) {}
      this.sockets.delete(clientSessionId);
    }
  }

  /**
   * Cleans up expired sessions to maintain lean memory footprint across 1M+ users
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const [clientId, record] of this.sessions.entries()) {
      if (now > record.expiresAt) {
        await this.resetClientSession(clientId);
      }
    }
  }
}

export const multiTenantPairing = new MultiTenantPairingManager();
