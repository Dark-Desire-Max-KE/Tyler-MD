import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { Boom } from '@hapi/boom';
import { BotConfig, ConnectionStateInfo, BotLog } from '../types';
import { sessionManager } from './sessionManager';
import { securityManager } from './securityManager';
import { autoReplyManager } from './autoReplyManager';
import { pluginRegistry, CommandContext, toSansBold } from './pluginRegistry';
import {
  saveBotSessionToDb,
  markSessionPairedInDb,
  getPairedBotCountFromDb
} from '../db/firestore';

export class BaileysBotService {
  private sock: any = null;
  private qrCodeDataUrl: string = '';
  private qrCodeRaw: string = '';
  private pairingCode: string = '';
  private status: ConnectionStateInfo['status'] = 'disconnected';
  private startedAt?: string;
  private userJid?: string;
  private userName?: string;
  private phoneNumber?: string;
  private lastError?: string;
  private messagesReceived: number = 0;
  private messagesSent: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isConnecting: boolean = false;
  private logs: BotLog[] = [];
  private startTime = Date.now();
  private currentSessionId: string = '';
  private totalDbSessions: number = 0;
  private lastPairedSession?: {
    sessionId: string;
    phoneNumber: string;
    creds: string;
    pairedAt: string;
  };

  private config: BotConfig = {
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
    welcomeMessage: '👋 Welcome to *{group}*, {user}! Make sure to read group rules and enjoy your stay.',
    goodbyeMessage: '👋 Farewell {user} from *{group}*. We will miss you!',
    maxMessageLength: 4000
  };

  constructor() {
    this.addLog('info', 'Tyler-MD Baileys Bot Service initialized. Engine standby.');
  }

  public getConfig(): BotConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<BotConfig>): BotConfig {
    this.config = { ...this.config, ...newConfig };
    this.addLog('info', 'Bot configuration updated successfully');
    return this.config;
  }

  public getStatus(): ConnectionStateInfo {
    const uptimeSec = this.startedAt ? Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000) : 0;
    return {
      status: this.status,
      userJid: this.userJid,
      userName: this.userName,
      phoneNumber: this.phoneNumber,
      qrCode: this.qrCodeDataUrl,
      qrRaw: this.qrCodeRaw,
      pairingCode: this.pairingCode,
      uptimeSeconds: uptimeSec,
      startedAt: this.startedAt,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      lastError: this.lastError,
      batteryLevel: 98,
      platform: 'Baileys Multi-Device (Node.js)',
      totalDbSessions: this.totalDbSessions,
      lastPairedSession: this.lastPairedSession
    };
  }

  public getLogs(): BotLog[] {
    return [...this.logs];
  }

  public addLog(level: BotLog['level'], message: string, details?: Record<string, any>) {
    const log: BotLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      details
    };
    this.logs.unshift(log);
    if (this.logs.length > 150) {
      this.logs.pop();
    }
  }

  public async startBot(): Promise<void> {
    if (this.isConnecting || this.status === 'connected') {
      return;
    }

    this.isConnecting = true;
    this.status = 'connecting';
    this.lastError = undefined;
    this.addLog('info', 'Connecting Baileys Multi-Device socket...');

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionManager.getSessionDir());
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as any }));

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        defaultQueryTimeoutMs: 60000,
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: true,
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Listen to connection updates
      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeRaw = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: { dark: '#020617', light: '#ffffff' }
            });
            this.status = 'qr_ready';
            this.addLog('info', 'New WhatsApp QR code generated. Ready for mobile scan.');
          } catch (qrErr: any) {
            this.addLog('error', `Failed to render QR Code: ${qrErr.message}`);
          }
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrCodeDataUrl = '';
          this.qrCodeRaw = '';
          this.pairingCode = '';
          this.reconnectAttempts = 0;
          this.startedAt = new Date().toISOString();

          const user = this.sock.user;
          this.userJid = user?.id ? jidNormalizedUser(user.id) : undefined;
          this.userName = user?.name || user?.notify || 'Tyler Owner';
          this.phoneNumber = this.userJid ? this.userJid.split('@')[0].split(':')[0] : (this.phoneNumber || undefined);

          // Automatically set paired user as Master Bot Owner and Admin!
          if (this.phoneNumber) {
            this.config.ownerNumber = this.phoneNumber;
            this.addLog('info', `Paired number +${this.phoneNumber} recognized as Master Bot Owner & Root Admin.`);
          }

          // Export portable session credentials for 1M+ user session vault
          const credsStr = sessionManager.exportSessionString() || '';
          const sessId = this.currentSessionId || ('TYLER-MD~' + Date.now().toString(36).toUpperCase());
          this.lastPairedSession = {
            sessionId: sessId,
            phoneNumber: this.phoneNumber || '',
            creds: credsStr,
            pairedAt: new Date().toISOString()
          };

          // Save to Firestore database asynchronously
          markSessionPairedInDb(sessId, credsStr).catch(() => {});
          this.totalDbSessions++;

          this.addLog('success', `WhatsApp Connected successfully! Linked User: ${this.userName} (+${this.phoneNumber}). Saved in Firestore session vault [${sessId}].`);

          // Push inbot Session ID & About Card directly into paired user WhatsApp chat
          const targetJid = this.userJid || (this.phoneNumber ? `${this.phoneNumber}@s.whatsapp.net` : null);
          if (targetJid) {
            const pushAboutText = `╔════════════════════════════════════════╗\n` +
              `   🌸 ${toSansBold('TYLER MD V5.0')} 🌸\n` +
              `   ( ${toSansBold('Cyber Anime Edition')} )\n` +
              `╚════════════════════════════════════════╝\n\n` +
              `╭───〔 🌸 ${toSansBold('SESSION VAULT')} 🌸 〕\n` +
              `│ 🔑 ${toSansBold('Session ID')} : *${sessId}*\n` +
              `│ 👤 ${toSansBold('User')} : ${this.userName}\n` +
              `│ 📱 ${toSansBold('Phone')} : +${this.phoneNumber}\n` +
              `│ ⏱️ ${toSansBold('Paired')} : ${new Date().toUTCString()}\n` +
              `│ 🛡️ ${toSansBold('Status')} : ${toSansBold('PAIRED & VERIFIED')}\n` +
              `╰────────────────────────────────────────┈\n\n` +
              `╭───『 🌸 ${toSansBold('ABOUT TYLER MD')} 』\n` +
              `│ ⚡ ${toSansBold('Tyler MD')} is a hyper-fast, next-gen WhatsApp Multi-Device bot engineered for ultimate speed and stability.\n` +
              `│ 👑 ${toSansBold('Owner')} : ${this.config.ownerName}\n` +
              `│ 🔑 ${toSansBold('Prefix')} : [ ${this.config.prefix} ]\n` +
              `│ 📦 ${toSansBold('Features')} : 430+ Built-in Commands\n` +
              `│ 🛡️ ${toSansBold('Security')} : Anti-Crash, Anti-Bug Shield & Anti-Link Protection\n` +
              `│ 🌸 ${toSansBold('Anime')} : High-Definition Art Generator (.waifu, .neko, .wallpaper)\n` +
              `│ 🤖 ${toSansBold('Automation')} : Auto-Typing, Auto-React, Auto-Read Blue Ticks\n` +
              `│ 🧠 ${toSansBold('AI Core')} : Powered by Google Gemini Neural Intelligence\n` +
              `╰────────────────────────────────────────┈\n\n` +
              `💡 *${toSansBold('Quick Start')}*:\n` +
              `Type *${this.config.prefix}menu* to open your interactive cyber anime command matrix!\n` +
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

              this.sock.sendMessage(targetJid, {
                image: imagePayload,
                caption: pushAboutText
              }).then(() => {
                this.addLog('success', `Sent inbot Session ID & Tyler MD About card to ${targetJid}`);
              }).catch((e: any) => {
                this.sock.sendMessage(targetJid, { text: pushAboutText }).catch(() => {});
              });
            } catch (err: any) {
              this.sock.sendMessage(targetJid, { text: pushAboutText }).catch(() => {});
            }
          }
        }

        if (connection === 'close') {
          this.status = 'disconnected';
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.addLog('warn', `WhatsApp connection closed. Reason code: ${statusCode || 'unknown'}. Reconnect allowed: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            this.lastError = 'Session logged out from phone. Please re-scan QR or re-pair.';
            sessionManager.clearSession();
            this.addLog('error', 'Logged out by WhatsApp mobile app. Session wiped.');
          } else if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delayTime = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 15000);
            this.addLog('info', `Attempting reconnection #${this.reconnectAttempts} in ${Math.round(delayTime / 1000)}s...`);
            setTimeout(() => {
              this.isConnecting = false;
              this.startBot();
            }, delayTime);
          } else {
            this.lastError = `Connection halted. Max retry limit reached or server stopped.`;
          }
        }
      });

      // Listen to incoming messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
        if (type !== 'notify' && type !== 'append') return;

        for (const msg of messages) {
          if (!msg.message) continue;
          await this.processIncomingMessage(msg);
        }
      });

      // Group participants update (Welcome / Leave greetings)
      this.sock.ev.on('group-participants.update', async (event: any) => {
        const { id: groupJid, participants, action } = event;
        if (!groupJid) return;

        try {
          if (action === 'add' && this.config.welcomeMessage) {
            for (const userJid of participants) {
              const userNum = userJid.split('@')[0];
              const welcome = this.config.welcomeMessage
                .replace(/{group}/g, 'Group')
                .replace(/{user}/g, `@${userNum}`);
              await this.sock.sendMessage(groupJid, {
                text: welcome,
                mentions: [userJid]
              });
              this.messagesSent++;
              this.addLog('info', `Sent welcome message to @${userNum} in group.`);
            }
          } else if (action === 'remove' && this.config.goodbyeMessage) {
            for (const userJid of participants) {
              const userNum = userJid.split('@')[0];
              const goodbye = this.config.goodbyeMessage
                .replace(/{group}/g, 'Group')
                .replace(/{user}/g, `@${userNum}`);
              await this.sock.sendMessage(groupJid, {
                text: goodbye,
                mentions: [userJid]
              });
              this.messagesSent++;
              this.addLog('info', `Sent goodbye message to @${userNum}.`);
            }
          }
        } catch (err: any) {
          this.addLog('error', `Failed to send group participant event: ${err.message}`);
        }
      });

    } catch (err: any) {
      this.status = 'error';
      this.lastError = err.message;
      this.addLog('error', `Baileys initialization failed: ${err.message}`);
    } finally {
      this.isConnecting = false;
    }
  }

  // Request 8-digit WhatsApp pairing code without camera / QR
  public async requestPairingCode(phoneNumber: string): Promise<string> {
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleaned || cleaned.length < 9) {
      throw new Error('Please enter a valid international phone number with country code (e.g. 14155552671)');
    }

    // Ensure socket is active and attempting connection
    if (!this.sock || this.status === 'disconnected' || this.status === 'error') {
      await this.startBot();
    }

    // Wait for the socket connection to establish handshake with WhatsApp servers (up to 12s)
    let retries = 0;
    while ((!this.sock || !this.sock.ws || this.sock.ws.readyState !== 1) && retries < 24) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }

    if (!this.sock) {
      throw new Error('Could not establish connection with WhatsApp servers. Please try again.');
    }

    if (this.sock.authState?.creds?.registered) {
      throw new Error('This bot instance is already registered to a linked WhatsApp account.');
    }

    try {
      this.addLog('info', `Requesting official WhatsApp API pairing code for +${cleaned}...`);
      const rawCode = await this.sock.requestPairingCode(cleaned);

      let formattedCode = rawCode;
      if (rawCode && rawCode.length === 8 && !rawCode.includes('-')) {
        formattedCode = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`;
      }

      this.pairingCode = formattedCode;
      this.status = 'pairing_code_ready';
      this.phoneNumber = cleaned;

      // Assign isolated session identifier for scalable 1M+ storage
      const sessId = 'TYLER-MD~' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      this.currentSessionId = sessId;

      // Persist to Firestore database
      await saveBotSessionToDb({
        sessionId: sessId,
        phoneNumber: cleaned,
        pairingCode: formattedCode,
        status: 'pending',
        createdAt: new Date().toISOString(),
        devicePlatform: 'WhatsApp Multi-Device Web Gateway'
      }).catch(() => {});

      this.addLog('success', `Official WhatsApp Pairing Code received: ${formattedCode} [Session Vault ID: ${sessId}]`);
      return formattedCode;
    } catch (err: any) {
      this.addLog('error', `WhatsApp API Pairing Code error: ${err.message}`);
      throw new Error(`WhatsApp API Error: ${err.message || 'Could not retrieve pairing code from WhatsApp servers'}. Please verify phone number and country code.`);
    }
  }

  public async resetForNextPairing(): Promise<void> {
    this.addLog('info', 'Refreshing pairing gateway ready for next code request...');
    this.pairingCode = '';
    this.qrCodeDataUrl = '';
    this.qrCodeRaw = '';
    this.status = 'disconnected';
    this.currentSessionId = '';
    this.lastPairedSession = undefined;
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {
        // ignore
      }
      this.sock = null;
    }
    this.isConnecting = false;
  }

  public async stopBot(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {
        // ignore
      }
      this.sock = null;
    }
    this.status = 'disconnected';
    this.qrCodeDataUrl = '';
    this.qrCodeRaw = '';
    this.pairingCode = '';
    this.addLog('info', 'WhatsApp Bot stopped and socket terminated.');
  }

  public async restartBot(): Promise<void> {
    this.addLog('info', 'Restarting WhatsApp Bot engine...');
    await this.stopBot();
    await new Promise(r => setTimeout(r, 1000));
    await this.startBot();
  }

  // Core incoming message dispatcher
  private async processIncomingMessage(msg: any) {
    this.messagesReceived++;
    const senderJid = msg.key.remoteJid;
    const isGroup = senderJid?.endsWith('@g.us') || false;
    const participantJid = isGroup ? (msg.key.participant || senderJid) : senderJid;
    const senderNumber = participantJid ? participantJid.split('@')[0] : '';
    const senderName = msg.pushName || senderNumber || 'WhatsApp User';

    // Extract text content
    const msgContent = msg.message;
    const text = msgContent.conversation ||
      msgContent.extendedTextMessage?.text ||
      msgContent.imageMessage?.caption ||
      msgContent.videoMessage?.caption ||
      '';

    // 1. Anti-Bug Crash Protection (Nexus / Queen Lavita)
    if (this.config.antiBug) {
      const bugCheck = securityManager.analyzeForBugs(text, msgContent);
      if (bugCheck.isBug) {
        this.addLog('security', `[ANTI-BUG DEFENSE] Blocked crash payload from @${senderNumber}: ${bugCheck.threatType}`);
        return; // Drop malicious crash message safely
      }
    }

    // 2. Anti-Spam rate limiting
    if (this.config.antiSpam) {
      const spamCheck = securityManager.checkSpam(participantJid);
      if (spamCheck.isSpam) {
        this.addLog('warn', `Rate limit triggered: @${senderNumber} sent too many messages quickly.`);
        return;
      }
    }

    // 3. Cache message for Anti-Delete
    if (this.config.antiDelete && text) {
      securityManager.cacheMessage({
        id: msg.key.id,
        from: participantJid,
        senderName,
        text,
        isGroup,
        groupJid: isGroup ? senderJid : undefined
      });
    }

    // 4. Anti-Link Filter in Groups
    if (isGroup && this.config.antiLink && text) {
      const linkCheck = securityManager.checkLink(text);
      if (linkCheck.hasLink) {
        const isOwnerOrAdmin = senderNumber === this.config.ownerNumber;
        if (!isOwnerOrAdmin) {
          this.addLog('security', `Anti-Link triggered in group by @${senderNumber}: ${text.slice(0, 30)}...`);
          try {
            if (this.config.antiLinkAction === 'delete') {
              await this.sock.sendMessage(senderJid, { delete: msg.key });
              await this.sock.sendMessage(senderJid, {
                text: `⚠️ *Anti-Link Guard*: Link deleted. @${senderNumber}, invite links are prohibited.`,
                mentions: [participantJid]
              });
            } else if (this.config.antiLinkAction === 'kick') {
              await this.sock.groupParticipantsUpdate(senderJid, [participantJid], 'remove');
              await this.sock.sendMessage(senderJid, {
                text: `🚪 *Anti-Link Guard*: @${senderNumber} was ejected for sharing forbidden links.`,
                mentions: [participantJid]
              });
            }
            return;
          } catch (e: any) {
            this.addLog('error', `Anti-Link action failed: ${e.message}`);
          }
        }
      }
    }

    // 5. Auto-Read & Auto-Presence
    if (this.config.autoRead) {
      try {
        await this.sock.readMessages([msg.key]);
      } catch (e) {
        // ignore
      }
    }

    if (this.config.autoTyping) {
      try {
        await this.sock.sendPresenceUpdate('composing', senderJid);
      } catch (e) {
        // ignore
      }
    }

    // 6. Auto-React
    if (this.config.autoReact && this.config.autoReactEmoji) {
      try {
        await this.sock.sendMessage(senderJid, {
          react: { text: this.config.autoReactEmoji, key: msg.key }
        });
      } catch (e) {
        // ignore
      }
    }

    // 7. Check if command starts with prefix
    const prefix = this.config.prefix;
    const isCommand = text.startsWith(prefix);

    if (isCommand) {
      const trimmed = text.slice(prefix.length).trim();
      const parts = trimmed.split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      // The paired user is 100% the Admin & Owner with unrestricted access
      const isFromMe = Boolean(msg.key?.fromMe);
      const pairedNum = this.phoneNumber ? this.phoneNumber.replace(/[^0-9]/g, '') : '';
      const ownerConfigNum = this.config.ownerNumber ? this.config.ownerNumber.replace(/[^0-9]/g, '') : '';
      const cleanSender = senderNumber.replace(/[^0-9]/g, '');

      const isOwner = Boolean(
        isFromMe ||
        (pairedNum && cleanSender.includes(pairedNum)) ||
        (ownerConfigNum && cleanSender.includes(ownerConfigNum)) ||
        (this.userJid && participantJid.split('@')[0].split(':')[0] === this.userJid.split('@')[0].split(':')[0])
      );
      const isAdmin = Boolean(isOwner || !isGroup);

      // Work mode: if self mode, ignore if not owner
      if (this.config.workMode === 'self' && !isOwner) {
        return;
      }

      this.addLog('info', `Command received: ${prefix}${commandName} from ${senderName} (${isOwner ? '👑 Owner' : isGroup ? 'Group Member' : 'Private'})`);

      let groupMetadata: any = null;
      let groupSubject = 'WhatsApp Group';
      if (isGroup && this.sock?.groupMetadata) {
        try {
          groupMetadata = await this.sock.groupMetadata(senderJid);
          groupSubject = groupMetadata?.subject || groupSubject;
        } catch (e) {}
      }

      const cmdCtx: CommandContext = {
        sock: this.sock,
        msg,
        senderJid: participantJid,
        senderNumber,
        senderName,
        isGroup,
        groupJid: isGroup ? senderJid : undefined,
        groupName: isGroup ? groupSubject : undefined,
        groupMetadata,
        isAdmin: true,
        isBotAdmin: true,
        isOwner,
        command: commandName,
        args,
        rawText: text,
        config: this.config,
        allPlugins: pluginRegistry.getAllUniquePlugins(),
        startTime: this.startTime
      };

      const result = await pluginRegistry.execute(commandName, cmdCtx);
      if (result) {
        if (result.replyType === 'image' && result.mediaUrl) {
          let imageContent: any;
          if (result.mediaUrl.startsWith('/') || (!result.mediaUrl.startsWith('http://') && !result.mediaUrl.startsWith('https://'))) {
            const cleanRel = result.mediaUrl.replace(/^\/+/, '');
            const localFile = path.resolve(process.cwd(), cleanRel);
            if (fs.existsSync(localFile)) {
              imageContent = fs.readFileSync(localFile);
            } else {
              imageContent = { url: result.mediaUrl };
            }
          } else {
            imageContent = { url: result.mediaUrl };
          }

          await this.sock.sendMessage(senderJid, {
            image: imageContent,
            caption: result.caption || result.replyText || '',
            mentions: result.mentions || []
          }, { quoted: msg });
        } else if (result.replyType === 'sticker' && result.mediaUrl) {
          await this.sock.sendMessage(senderJid, {
            sticker: { url: result.mediaUrl }
          }, { quoted: msg });
        } else if (result.replyText) {
          await this.sock.sendMessage(senderJid, {
            text: result.replyText,
            mentions: result.mentions || []
          }, { quoted: msg });
        }
        this.messagesSent++;
        this.addLog('success', `Replied to command ${prefix}${commandName}`);
      }
      return;
    }

    // 8. If not command, check Auto-Replies
    const autoReplyCheck = autoReplyManager.matchMessage(text, {
      isGroup,
      pushName: senderName,
      userJid: participantJid,
      groupName: isGroup ? 'WhatsApp Group' : undefined,
      botName: this.config.botName,
      ownerName: this.config.ownerName,
      ownerNumber: this.config.ownerNumber
    });

    if (autoReplyCheck.matched && autoReplyCheck.interpolatedReply) {
      if (autoReplyCheck.rule?.delayMs) {
        await new Promise(r => setTimeout(r, autoReplyCheck.rule!.delayMs));
      }
      await this.sock.sendMessage(senderJid, {
        text: autoReplyCheck.interpolatedReply
      }, autoReplyCheck.rule?.replyWithQuoted ? { quoted: msg } : undefined);
      this.messagesSent++;
      this.addLog('info', `Auto-reply triggered for: "${text.slice(0, 20)}..."`);
    }
  }

  // Direct dispatcher execution for Simulator in the web UI!
  public async simulateMessage(req: {
    senderJid: string;
    senderName: string;
    isGroup: boolean;
    groupJid?: string;
    groupName?: string;
    isAdmin?: boolean;
    isOwner?: boolean;
    messageText: string;
  }) {
    const startTime = Date.now();
    const text = req.messageText || '';
    const logs: string[] = [];

    logs.push(`[SIM] Inbound message: "${text}" from ${req.senderName}`);

    // Check anti-bug
    if (this.config.antiBug) {
      const bugCheck = securityManager.analyzeForBugs(text);
      if (bugCheck.isBug) {
        logs.push(`[SIM SECURITY] Bug code filtered: ${bugCheck.threatType}`);
        return {
          replyText: `🛡️ *[NEXUS BUG SHIELD]* Malicious crash payload detected and dropped: ${bugCheck.threatType}`,
          replyType: 'alert' as const,
          latencyMs: Date.now() - startTime,
          logs
        };
      }
    }

    // Check anti-link
    if (req.isGroup && this.config.antiLink) {
      const linkCheck = securityManager.checkLink(text);
      if (linkCheck.hasLink && !req.isAdmin && !req.isOwner) {
        logs.push(`[SIM SECURITY] Anti-Link caught link`);
        return {
          replyText: `⚠️ *[ANTI-LINK]* Unauthorized link detected. Action: ${this.config.antiLinkAction.toUpperCase()}`,
          replyType: 'alert' as const,
          latencyMs: Date.now() - startTime,
          logs
        };
      }
    }

    // Check command
    const prefix = this.config.prefix;
    if (text.startsWith(prefix)) {
      const trimmed = text.slice(prefix.length).trim();
      const parts = trimmed.split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      logs.push(`[SIM] Routing to plugin executor: ${commandName}`);

      let simulatedGroupMeta: any = null;
      if (req.isGroup) {
        simulatedGroupMeta = {
          subject: req.groupName || '₭€Ñ¥Δ ҒL€Ж ĆLŨβ',
          participants: [
            { id: '254711111101@s.whatsapp.net', admin: 'superadmin' },
            { id: '254711111102@s.whatsapp.net', admin: 'admin' },
            { id: '254711111103@s.whatsapp.net', admin: 'admin' },
            { id: '254711111104@s.whatsapp.net', admin: 'admin' },
            { id: '254711111105@s.whatsapp.net', admin: null },
            { id: '254711111106@s.whatsapp.net', admin: null },
            { id: '254711111107@s.whatsapp.net', admin: null },
            { id: '254711111108@s.whatsapp.net', admin: null },
            { id: '254711111109@s.whatsapp.net', admin: null },
            { id: '254711111110@s.whatsapp.net', admin: null },
          ]
        };
      }

      const cmdCtx: CommandContext = {
        senderJid: req.senderJid,
        senderNumber: req.senderJid.split('@')[0],
        senderName: req.senderName,
        isGroup: req.isGroup,
        groupJid: req.groupJid,
        groupName: req.groupName || '₭€Ñ¥Δ ҒL€Ж ĆLŨβ',
        groupMetadata: simulatedGroupMeta,
        isAdmin: Boolean(req.isAdmin),
        isBotAdmin: true,
        isOwner: Boolean(req.isOwner),
        command: commandName,
        args,
        rawText: text,
        config: this.config,
        allPlugins: pluginRegistry.getAllUniquePlugins(),
        startTime: this.startTime
      };

      const result = await pluginRegistry.execute(commandName, cmdCtx);
      const latencyMs = Date.now() - startTime;
      logs.push(`[SIM] Executed in ${latencyMs}ms`);

      return {
        replyText: result.replyText,
        replyType: result.replyType || 'text',
        mediaUrl: result.mediaUrl,
        caption: result.caption,
        latencyMs,
        logs,
        executedPlugin: commandName
      };
    }

    // Check Auto-Reply
    const autoReplyCheck = autoReplyManager.matchMessage(text, {
      isGroup: req.isGroup,
      pushName: req.senderName,
      userJid: req.senderJid,
      groupName: req.groupName || 'Nexus MD Group',
      botName: this.config.botName,
      ownerName: this.config.ownerName,
      ownerNumber: this.config.ownerNumber
    });

    if (autoReplyCheck.matched && autoReplyCheck.interpolatedReply) {
      logs.push(`[SIM] Auto-reply matched trigger: "${autoReplyCheck.rule?.trigger}"`);
      return {
        replyText: autoReplyCheck.interpolatedReply,
        replyType: 'text' as const,
        latencyMs: Date.now() - startTime,
        logs
      };
    }

    return {
      replyText: undefined,
      replyType: 'none' as const,
      latencyMs: Date.now() - startTime,
      logs: [...logs, '[SIM] No command or auto-reply matched. Message ignored.']
    };
  }
}

export const baileysBot = new BaileysBotService();
