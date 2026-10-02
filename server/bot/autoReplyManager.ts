import { AutoReplyRule } from '../types';

export class AutoReplyManager {
  private rules: AutoReplyRule[] = [
    {
      id: 'rule-greeting',
      trigger: 'hello',
      matchType: 'contains',
      response: '👋 Greetings {pushName}! I am *{botName}* (WhatsApp MD Bot). Type *.menu* to view my full command matrix.',
      enabled: true,
      replyWithQuoted: true,
      delayMs: 300,
    },
    {
      id: 'rule-bot-status',
      trigger: 'who are you',
      matchType: 'contains',
      response: '⚡ I am *{botName}*, a powerful Multi-Device WhatsApp Bot equipped with Group Management, Anti-Bug defenses, AI intelligence, and automation tools! Managed by {ownerName}.',
      enabled: true,
      replyWithQuoted: true,
      delayMs: 200,
    },
    {
      id: 'rule-group-rules',
      trigger: 'rules',
      matchType: 'exact',
      response: '📜 *GROUP RULES & POLICY*:\n1. Respect all members\n2. No spamming or bug payloads (Nexus Anti-Bug active)\n3. No external invite links without admin approval\n4. Type *.menu* for bot commands.',
      enabled: true,
      isGroupOnly: true,
      replyWithQuoted: true,
      delayMs: 200,
    },
    {
      id: 'rule-owner',
      trigger: 'who is owner',
      matchType: 'contains',
      response: '👑 The bot administrator is *{ownerName}*.\nContact: wa.me/{ownerNumber}',
      enabled: true,
      replyWithQuoted: true,
      delayMs: 200,
    },
    {
      id: 'rule-ping',
      trigger: 'ping bot',
      matchType: 'contains',
      response: '🏓 *PONG!* Bot engine is online and responsive. Active time: {time}.',
      enabled: true,
      delayMs: 150,
    }
  ];

  public getRules(): AutoReplyRule[] {
    return this.rules;
  }

  public addRule(rule: Omit<AutoReplyRule, 'id'>): AutoReplyRule {
    const newRule: AutoReplyRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    this.rules.unshift(newRule);
    return newRule;
  }

  public updateRule(id: string, updates: Partial<AutoReplyRule>): AutoReplyRule | null {
    const idx = this.rules.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.rules[idx] = { ...this.rules[idx], ...updates };
    return this.rules[idx];
  }

  public deleteRule(id: string): boolean {
    const initialLen = this.rules.length;
    this.rules = this.rules.filter(r => r.id !== id);
    return this.rules.length < initialLen;
  }

  public clearCustomRules(): number {
    const defaultIds = new Set(['rule-greeting', 'rule-bot-status', 'rule-group-rules', 'rule-owner', 'rule-ping']);
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => defaultIds.has(rule.id));
    return initialLength - this.rules.length;
  }

  public toggleRule(id: string): AutoReplyRule | null {
    const rule = this.rules.find(r => r.id === id);
    if (!rule) return null;
    rule.enabled = !rule.enabled;
    return rule;
  }

  public matchMessage(
    text: string,
    context: {
      isGroup: boolean;
      pushName: string;
      userJid: string;
      groupName?: string;
      botName: string;
      ownerName: string;
      ownerNumber: string;
    }
  ): { matched: boolean; rule?: AutoReplyRule; interpolatedReply?: string } {
    if (!text) return { matched: false };
    const cleanText = text.trim().toLowerCase();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.isGroupOnly && !context.isGroup) continue;
      if (rule.isPrivateOnly && context.isGroup) continue;

      const triggerPattern = rule.trigger.toLowerCase().trim();
      let isMatch = false;

      switch (rule.matchType) {
        case 'exact':
          isMatch = cleanText === triggerPattern;
          break;
        case 'contains':
          isMatch = cleanText.includes(triggerPattern);
          break;
        case 'startsWith':
          isMatch = cleanText.startsWith(triggerPattern);
          break;
        case 'regex':
          try {
            const regex = new RegExp(rule.trigger, 'i');
            isMatch = regex.test(text);
          } catch {
            isMatch = false;
          }
          break;
      }

      if (isMatch) {
        const interpolated = this.interpolateVariables(rule.response, context);
        return {
          matched: true,
          rule,
          interpolatedReply: interpolated
        };
      }
    }

    return { matched: false };
  }

  public interpolateVariables(
    template: string,
    context: {
      pushName: string;
      userJid: string;
      groupName?: string;
      botName: string;
      ownerName: string;
      ownerNumber: string;
    }
  ): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    const userNumber = context.userJid.split('@')[0];

    return template
      .replace(/{pushName}/g, context.pushName || 'Friend')
      .replace(/{user}/g, `@${userNumber}`)
      .replace(/{group}/g, context.groupName || 'this chat')
      .replace(/{botName}/g, context.botName)
      .replace(/{ownerName}/g, context.ownerName)
      .replace(/{ownerNumber}/g, context.ownerNumber)
      .replace(/{time}/g, timeStr)
      .replace(/{date}/g, dateStr);
  }
}

export const autoReplyManager = new AutoReplyManager();
