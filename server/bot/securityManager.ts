import { BotConfig, BotLog } from '../types';

interface CachedMessage {
  id: string;
  from: string;
  senderName: string;
  text: string;
  timestamp: number;
  isGroup: boolean;
  groupJid?: string;
}

export class SecurityManager {
  private messageRateMap = new Map<string, number[]>(); // jid -> timestamps
  private cachedMessages: CachedMessage[] = [];
  private blockedSpammers = new Set<string>();

  // Detect bug codes / crash payloads (Queen Lavita / Nexus Bot style)
  public analyzeForBugs(text: string, rawMsg?: any): { isBug: boolean; threatType?: string; sanitizedText: string } {
    if (!text && !rawMsg) {
      return { isBug: false, sanitizedText: '' };
    }

    const content = text || '';

    // 1. Extreme length buffer overflow attack
    if (content.length > 25000) {
      return {
        isBug: true,
        threatType: 'BUFFER_OVERFLOW_TEXT (Length > 25,000)',
        sanitizedText: '[CRASH PAYLOAD BLOCKED: Extreme Length]'
      };
    }

    // 2. Zero-Width character flood / invisible unicode bomb
    const zeroWidthRegex = /[\u200B-\u200D\uFEFF]/g;
    const zeroWidthMatches = content.match(zeroWidthRegex);
    if (zeroWidthMatches && zeroWidthMatches.length > 300) {
      return {
        isBug: true,
        threatType: 'UNICODE_ZERO_WIDTH_FLOOD (Crash Bug)',
        sanitizedText: '[CRASH PAYLOAD BLOCKED: Invisible Characters Bomb]'
      };
    }

    // 3. Repeated RTL / BiDi overrides (WhatsApp Android / iOS text renderer crasher)
    const bidiRegex = /[\u202E\u202D\u2066\u2067\u2068]/g;
    const bidiMatches = content.match(bidiRegex);
    if (bidiMatches && bidiMatches.length > 40) {
      return {
        isBug: true,
        threatType: 'BIDI_OVERRIDE_CRASHER (Text Renderer Exploit)',
        sanitizedText: '[CRASH PAYLOAD BLOCKED: BiDi Crash]'
      };
    }

    // 4. Trailing dots / repeated crash symbols / vcard bomb
    if (/(?:[\u2588\u2591\u2592\u2593\u2500-\u257F]){150,}/.test(content)) {
      return {
        isBug: true,
        threatType: 'ASCII_BLOCK_BOMB',
        sanitizedText: '[CRASH PAYLOAD BLOCKED: ASCII Block Bomb]'
      };
    }

    // 5. Raw vcard bomb check
    if (rawMsg?.contactMessage?.vcard && rawMsg.contactMessage.vcard.length > 10000) {
      return {
        isBug: true,
        threatType: 'VCARD_PAYLOAD_BOMB',
        sanitizedText: '[CRASH PAYLOAD BLOCKED: Malformed VCard]'
      };
    }

    return { isBug: false, sanitizedText: content };
  }

  // Check anti-link
  public checkLink(text: string): { hasLink: boolean; isWhatsAppInvite: boolean } {
    if (!text) return { hasLink: false, isWhatsAppInvite: false };

    const waInviteRegex = /(chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}|wa\.me\/[0-9]+)/i;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|io|me|xyz|top|link|online)\b)/i;

    const isWhatsAppInvite = waInviteRegex.test(text);
    const hasLink = isWhatsAppInvite || urlRegex.test(text);

    return { hasLink, isWhatsAppInvite };
  }

  // Check anti-spam
  public checkSpam(senderJid: string, maxMessages = 5, windowMs = 4000): { isSpam: boolean; count: number } {
    const now = Date.now();
    const timestamps = this.messageRateMap.get(senderJid) || [];

    // Filter within window
    const recent = timestamps.filter(t => now - t < windowMs);
    recent.push(now);
    this.messageRateMap.set(senderJid, recent);

    if (recent.length > maxMessages) {
      this.blockedSpammers.add(senderJid);
      return { isSpam: true, count: recent.length };
    }

    return { isSpam: false, count: recent.length };
  }

  // Message cache for Anti-Delete
  public cacheMessage(msg: { id: string; from: string; senderName: string; text: string; isGroup: boolean; groupJid?: string }) {
    this.cachedMessages.push({
      ...msg,
      timestamp: Date.now()
    });

    // Keep max 500
    if (this.cachedMessages.length > 500) {
      this.cachedMessages.shift();
    }
  }

  public getCachedMessage(id: string): CachedMessage | undefined {
    return this.cachedMessages.find(m => m.id === id);
  }

  public clearMessageCache() {
    this.cachedMessages = [];
    this.messageRateMap.clear();
    this.blockedSpammers.clear();
  }
}

export const securityManager = new SecurityManager();
