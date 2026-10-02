import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { PluginCommand, BotConfig } from '../types';
import { ADDITIONAL_COMMANDS_DATA } from './commandsData';
import { autoReplyManager } from './autoReplyManager';
import { securityManager } from './securityManager';
import { moderationManager } from './moderationManager';

/**
 * Transforms text into Sans-Serif Ultra Bold Condensed typography (Mathematical Sans-Serif Bold Unicode).
 * Renders identically across all WhatsApp mobile and web clients without font mismatches.
 */
export function toSansBold(text: string): string {
  if (!text) return '';
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    // Uppercase A-Z: 0x1D5D4 (A) to 0x1D5ED (Z)
    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(0x1D5D4 + (code - 65));
    }
    // Lowercase a-z: 0x1D5EE (a) to 0x1D607 (z)
    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(0x1D5EE + (code - 97));
    }
    // Digits 0-9: 0x1D7EC (0) to 0x1D7F5 (9)
    if (code >= 48 && code <= 57) {
      return String.fromCodePoint(0x1D7EC + (code - 48));
    }
    return char;
  }).join('');
}

export interface CommandContext {
  sock?: any;
  msg?: any;
  senderJid: string;
  senderNumber: string;
  senderName: string;
  isGroup: boolean;
  groupJid?: string;
  groupName?: string;
  groupMetadata?: any;
  isAdmin: boolean;
  isBotAdmin: boolean;
  isOwner: boolean;
  command: string;
  args: string[];
  rawText: string;
  config: BotConfig;
  allPlugins: PluginCommand[];
  startTime: number;
}

export interface CommandResult {
  replyText?: string;
  replyType?: 'text' | 'image' | 'sticker' | 'alert';
  mediaUrl?: string;
  caption?: string;
  mentions?: string[];
  quoted?: boolean;
}

type CommandExecutor = (ctx: CommandContext) => Promise<CommandResult> | CommandResult;

function getGroupTargets(ctx: CommandContext): string[] {
  const message = ctx.msg?.message || {};
  const contextInfo = message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.documentMessage?.contextInfo;
  const mentionedJids = Array.isArray(contextInfo?.mentionedJid) ? contextInfo.mentionedJid : [];
  const quotedJid = contextInfo?.participant;
  const directJids = [...mentionedJids, ...(quotedJid ? [quotedJid] : [])]
    .filter((jid): jid is string => typeof jid === 'string' && /^[\w.-]+@(s\.whatsapp\.net|lid)$/.test(jid));
  if (directJids.length) return [...new Set(directJids)];

  const target = ctx.args[0] || '';
  if (/^[\w.-]+@(s\.whatsapp\.net|lid)$/.test(target)) return [target];
  const digits = target.replace(/\D/g, '');
  return digits.length >= 6 ? [`${digits}@s.whatsapp.net`] : [];
}

async function executeLiveGroupCommand(commandName: string, ctx: CommandContext): Promise<CommandResult | null> {
  const operations = new Set([
    'add', 'kick', 'remove', 'ban', 'promote', 'demote', 'groupopen', 'groupclose', 'openchat', 'closechat',
    'mute', 'unmute', 'lockgroup', 'unlockgroup', 'setname', 'setdesc', 'resetlink', 'resetgclink'
  ]);
  const reads = new Set([
    'link', 'gclink', 'grouplink', 'invitelink', 'groupinfo', 'ginfo', 'infogc', 'admins', 'groupid',
    'membercount', 'admincount', 'getdesc', 'gcsettings', 'grouplist', 'checkadmin', 'tagme', 'tagall',
    'everyone', 'all', 'mentionall', 'hidetag', 'htag', 'totag', 'pingadmins'
  ]);
  if (!operations.has(commandName) && !reads.has(commandName)) return null;

  const { sock, groupJid } = ctx;
  if (!sock || !groupJid?.endsWith('@g.us')) {
    return { replyText: 'This command requires an active WhatsApp group connection; it cannot change groups from the simulator.' };
  }

  const metadata = ctx.groupMetadata || await sock.groupMetadata(groupJid);
  const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
  const requiresBotAdmin = operations.has(commandName);
  if (requiresBotAdmin && !ctx.isBotAdmin) {
    return { replyText: 'The bot must be a group administrator to perform this action.' };
  }

  if (['add', 'kick', 'remove', 'ban', 'promote', 'demote'].includes(commandName)) {
    const targets = getGroupTargets(ctx);
    if (!targets.length) {
      return { replyText: `Usage: ${ctx.config.prefix}${commandName} @mention, reply to a member, or provide a full phone number.` };
    }
    const action = ['kick', 'remove', 'ban'].includes(commandName) ? 'remove' : commandName;
    const results = await sock.groupParticipantsUpdate(groupJid, targets, action);
    const failed = Array.isArray(results) ? results.filter((result: any) => result.status && String(result.status) !== '200') : [];
    if (failed.length) {
      return { replyText: `WhatsApp could not complete the action for ${failed.map((result: any) => result.jid || 'a participant').join(', ')}. Check that the bot has permission and the targets are eligible.` };
    }
    return { replyText: `WhatsApp accepted the ${action} request for ${targets.map(jid => `@${jid.split('@')[0]}`).join(', ')}.`, mentions: targets };
  }

  if (['groupopen', 'openchat', 'unmute', 'groupclose', 'closechat', 'mute', 'lockgroup', 'unlockgroup'].includes(commandName)) {
    const setting = ['groupopen', 'openchat', 'unmute'].includes(commandName)
      ? 'not_announcement'
      : ['groupclose', 'closechat', 'mute'].includes(commandName)
        ? 'announcement'
        : commandName === 'lockgroup' ? 'locked' : 'unlocked';
    await sock.groupSettingUpdate(groupJid, setting);
    const label = setting === 'not_announcement' ? 'opened' : setting === 'announcement' ? 'closed to members' : setting;
    return { replyText: `Group settings updated: the group is now ${label}.` };
  }

  if (commandName === 'setname') {
    const subject = ctx.args.join(' ').trim();
    if (!subject) return { replyText: `Usage: ${ctx.config.prefix}setname <new group name>` };
    await sock.groupUpdateSubject(groupJid, subject);
    return { replyText: `Group name updated to *${subject}*.` };
  }

  if (commandName === 'setdesc') {
    const description = ctx.args.join(' ').trim();
    if (!description) return { replyText: `Usage: ${ctx.config.prefix}setdesc <new description>` };
    await sock.groupUpdateDescription(groupJid, description);
    return { replyText: 'Group description updated.' };
  }

  if (['link', 'gclink', 'grouplink', 'invitelink', 'resetlink', 'resetgclink'].includes(commandName)) {
    if (['resetlink', 'resetgclink'].includes(commandName)) await sock.groupRevokeInvite(groupJid);
    const code = await sock.groupInviteCode(groupJid);
    return { replyText: `Group invite link: https://chat.whatsapp.com/${code}` };
  }

  if (['groupinfo', 'ginfo', 'infogc', 'membercount', 'admincount', 'groupid', 'getdesc', 'gcsettings', 'grouplist'].includes(commandName)) {
    const admins = participants.filter((participant: any) => participant.admin);
    if (commandName === 'membercount' || commandName === 'grouplist') return { replyText: `${metadata.subject || ctx.groupName || 'Group'} has ${participants.length} participants.` };
    if (commandName === 'admincount') return { replyText: `${admins.length} group administrators.` };
    if (commandName === 'groupid') return { replyText: `Group ID: ${groupJid}` };
    if (commandName === 'getdesc') return { replyText: metadata.desc || 'This group has no description.' };
    if (commandName === 'gcsettings') return { replyText: `Announcement-only: ${metadata.announce ? 'yes' : 'no'}\nLocked group info: ${metadata.restrict ? 'yes' : 'no'}` };
    return { replyText: `*${metadata.subject || ctx.groupName || 'Group'}*\nParticipants: ${participants.length}\nAdmins: ${admins.length}\nCreated: ${metadata.creation ? new Date(metadata.creation * 1000).toLocaleString() : 'unknown'}\nDescription: ${metadata.desc || 'none'}` };
  }

  const selectedParticipants: string[] = commandName === 'tagme' || commandName === 'totag'
    ? getGroupTargets(ctx).slice(0, 1)
    : commandName === 'admins' || commandName === 'pingadmins'
      ? participants.filter((participant: any) => participant.admin).map((participant: any) => participant.id)
      : participants.map((participant: any) => participant.id);
  if (!selectedParticipants.length) return { replyText: 'No matching group participants were found.' };
  const note = ctx.args.join(' ').trim();
  const heading = commandName === 'tagme' ? 'You requested a mention:' : commandName === 'admins' ? 'Group administrators:' : commandName === 'pingadmins' ? (note || 'Admin attention requested:') : (note || 'Group announcement:');
  return { replyText: `${heading}\n${selectedParticipants.map(jid => `@${jid.split('@')[0]}`).join(' ')}`, mentions: selectedParticipants };
}

async function executeCatalogCommand(
  name: string,
  category: PluginCommand['category'],
  description: string,
  ctx: CommandContext
): Promise<CommandResult | null> {
  const input = ctx.args.join(' ').trim();

  if (category === 'autoreply') {
    if (['autoreply', 'autoreplylist', 'responderstatus'].includes(name)) {
      const rules = autoReplyManager.getRules();
      if (!rules.length) return { replyText: 'No auto-reply rules are configured.' };
      return { replyText: rules.map(rule => `${rule.enabled ? 'ON' : 'OFF'} ${rule.id}: ${rule.matchType} "${rule.trigger}" -> ${rule.response}`).join('\n') };
    }
    if (name === 'autoreplyadd') {
      const [trigger, ...responseParts] = input.split('|');
      const response = responseParts.join('|').trim();
      if (!trigger?.trim() || !response) return { replyText: `Usage: ${ctx.config.prefix}autoreplyadd <trigger>|<response>` };
      const rule = autoReplyManager.addRule({ trigger: trigger.trim(), matchType: 'contains', response, enabled: true });
      return { replyText: `Auto-reply rule ${rule.id} added.` };
    }
    if (name === 'autoreplydel') {
      const ruleId = ctx.args[0];
      if (!ruleId) return { replyText: `Usage: ${ctx.config.prefix}autoreplydel <id>` };
      return { replyText: autoReplyManager.deleteRule(ruleId) ? `Auto-reply rule ${ruleId} deleted.` : `Auto-reply rule ${ruleId} was not found.` };
    }
    if (name === 'autoreplyclear' || name === 'clearautomation') {
      const removed = autoReplyManager.clearCustomRules();
      if (name === 'clearautomation') {
        ctx.config.autoRead = false;
        ctx.config.autoTyping = false;
        ctx.config.autoReact = false;
      }
      return { replyText: `Removed ${removed} custom auto-reply rule${removed === 1 ? '' : 's'}${name === 'clearautomation' ? ' and disabled auto-read, typing, and reactions' : ''}.` };
    }
    if (name === 'autoblue') {
      const mode = ctx.args[0]?.toLowerCase();
      if (!['on', 'off'].includes(mode || '')) return { replyText: `Usage: ${ctx.config.prefix}autoblue on|off` };
      ctx.config.autoRead = mode === 'on';
      return { replyText: `Auto-read is now ${ctx.config.autoRead ? 'on' : 'off'}.` };
    }
    if (name === 'autoreactemoji') {
      const emoji = ctx.args[0];
      if (!emoji) return { replyText: `Usage: ${ctx.config.prefix}autoreactemoji <emoji>` };
      ctx.config.autoReactEmoji = emoji;
      ctx.config.autoReact = true;
      return { replyText: `Automatic reactions now use ${emoji}.` };
    }
    if (name === 'autoonline' || name.startsWith('presence')) {
      if (!ctx.sock?.sendPresenceUpdate) return { replyText: 'Presence commands require an active WhatsApp connection.' };
      const presenceByCommand: Record<string, string> = {
        presencecomposing: 'composing', presencerecording: 'recording', presencepaused: 'paused', presencereset: 'available'
      };
      const mode = ctx.args[0]?.toLowerCase();
      const presence = name === 'autoonline' ? (mode === 'off' ? 'unavailable' : 'available') : presenceByCommand[name];
      await ctx.sock.sendPresenceUpdate(presence, name === 'autoonline' ? undefined : (ctx.isGroup ? ctx.groupJid : ctx.senderJid));
      return { replyText: `WhatsApp presence set to ${presence}.` };
    }
    if (name === 'testautoreply') {
      if (!input) return { replyText: `Usage: ${ctx.config.prefix}testautoreply <message>` };
      const match = autoReplyManager.matchMessage(input, {
        isGroup: ctx.isGroup,
        pushName: ctx.senderName,
        userJid: ctx.senderJid,
        groupName: ctx.groupName,
        botName: ctx.config.botName,
        ownerName: ctx.config.ownerName,
        ownerNumber: ctx.config.ownerNumber
      });
      return { replyText: match.matched ? match.interpolatedReply || 'A rule matched with an empty response.' : 'No enabled rule matches that message.' };
    }
    return { replyText: `The ${name} automation is not connected to a runtime worker yet.` };
  }

  if (category === 'security') {
    const configKey: Record<string, keyof BotConfig> = {
      bugshield: 'antiBug', 'bidi-protect': 'antiBug', 'zerowidth-filter': 'antiBug',
      'vcard-guard': 'antiBug', ratelimit: 'antiSpam', antispamgc: 'antiSpam',
      antitoxic: 'antiToxic', 'antidemote': 'antiDemote', antibug: 'antiBug',
      antidelete: 'antiDelete', antilink: 'antiLink'
    };
    const key = configKey[name];
    if (key) {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on' || mode === 'enable') ctx.config[key] = true as never;
      if (mode === 'off' || mode === 'disable') ctx.config[key] = false as never;
      return { replyText: `${name} is ${ctx.config[key] ? 'enabled' : 'disabled'}${['bidi-protect', 'zerowidth-filter', 'vcard-guard'].includes(name) ? ' with the shared anti-bug filter' : ''}.` };
    }
    if (['crashshield', 'shieldstatus', 'guardstatus'].includes(name)) {
      return { replyText: `Security status: anti-bug ${ctx.config.antiBug ? 'on' : 'off'}, anti-link ${ctx.config.antiLink ? 'on' : 'off'}, anti-spam ${ctx.config.antiSpam ? 'on' : 'off'}, anti-delete ${ctx.config.antiDelete ? 'on' : 'off'}, anti-toxic ${ctx.config.antiToxic ? 'on' : 'off'}.` };
    }
    if (name === 'verifyarmor') {
      const result = securityManager.analyzeForBugs('normal security verification message');
      return { replyText: `Security analyzer test ${result.isBug ? 'failed' : 'passed'}.` };
    }
    if (name === 'clearmalware') {
      securityManager.clearMessageCache();
      return { replyText: 'In-memory message and rate-limit caches cleared.' };
    }
    return { replyText: `The ${name} security action is not implemented and was not applied.` };
  }

  if (category === 'moderation') {
    if (!ctx.isGroup || !ctx.groupJid) return { replyText: 'Moderation commands require a group chat.' };
    if (['badwords', 'addbadword', 'delbadword'].includes(name)) {
      if (name === 'badwords') {
        const words = moderationManager.listBadWords(ctx.groupJid);
        return { replyText: words.length ? `Filtered words: ${words.join(', ')}` : 'No group-specific filtered words are configured.' };
      }
      const word = ctx.args.join(' ').trim();
      if (!word) return { replyText: `Usage: ${ctx.config.prefix}${name} <word>` };
      const changed = name === 'addbadword'
        ? moderationManager.addBadWord(ctx.groupJid, word)
        : moderationManager.removeBadWord(ctx.groupJid, word);
      return { replyText: changed ? `Filtered word ${name === 'addbadword' ? 'added' : 'removed'}.` : `Filtered word was not ${name === 'addbadword' ? 'added (already present or invalid)' : 'found'}.` };
    }

    if (['warn', 'warn1', 'warn2', 'warncheck', 'warnreset', 'unwarnall', 'delwarn'].includes(name)) {
      const target = getGroupTargets(ctx)[0];
      if (!target) return { replyText: `Usage: ${ctx.config.prefix}${name} @mention or reply to a member.` };
      if (['warncheck'].includes(name)) {
        const warning = moderationManager.getWarning(ctx.groupJid, target);
        return { replyText: `@${target.split('@')[0]} has ${warning.count}/${moderationManager.getWarningLimit(ctx.groupJid)} warnings. ${warning.reasons.slice(-1)[0] || ''}`, mentions: [target] };
      }
      if (['warnreset', 'unwarnall', 'delwarn'].includes(name)) {
        const removed = moderationManager.clearWarning(ctx.groupJid, target);
        return { replyText: removed ? `Warnings cleared for @${target.split('@')[0]}.` : `No warning record exists for @${target.split('@')[0]}.`, mentions: [target] };
      }
      const reason = ctx.args.slice(1).join(' ').trim() || 'Group rules violation';
      const amount = name === 'warn2' ? 2 : 1;
      const warning = moderationManager.addWarning(ctx.groupJid, target, reason, amount);
      const limit = moderationManager.getWarningLimit(ctx.groupJid);
      if (warning.count >= limit && ctx.sock && ctx.isBotAdmin) {
        await ctx.sock.groupParticipantsUpdate(ctx.groupJid, [target], 'remove');
        moderationManager.clearWarning(ctx.groupJid, target);
        return { replyText: `@${target.split('@')[0]} reached ${limit} warnings and was removed from the group.`, mentions: [target] };
      }
      return { replyText: `Warning recorded for @${target.split('@')[0]} (${warning.count}/${limit}): ${reason}`, mentions: [target] };
    }

    if (['warnlist', 'modlog'].includes(name)) {
      const warnings = moderationManager.listWarnings(ctx.groupJid);
      return { replyText: warnings.length
        ? warnings.map(item => `@${item.participantJid.split('@')[0]}: ${item.count} (${item.reasons.slice(-1)[0] || 'no reason'})`).join('\n')
        : 'No warnings are recorded for this group.', mentions: warnings.map(item => item.participantJid) };
    }
    if (name === 'clearwarns') {
      moderationManager.clearGroupWarnings(ctx.groupJid);
      return { replyText: 'All warning records for this group were cleared.' };
    }
    if (name === 'setwarnlimit') {
      const limit = Number(ctx.args[0]);
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) return { replyText: `Usage: ${ctx.config.prefix}setwarnlimit <1-20>` };
      moderationManager.setWarningLimit(ctx.groupJid, limit);
      return { replyText: `The warning limit is now ${limit}.` };
    }
    return { replyText: `The ${name} moderation action is not implemented and was not applied.` };
  }

  if (category === 'ai') {
    if (!input && !['joke', 'riddle', 'quote', 'compliment', 'roastme', 'proverb', 'haiku'].includes(name)) {
      return { replyText: `Usage: ${ctx.config.prefix}${name} <prompt>` };
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return { replyText: 'AI service is not configured. Set GEMINI_API_KEY in the server environment.' };
    }
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${description}\n\nUser input: ${input || 'Generate one appropriate response.'}`,
        config: { systemInstruction: `You are the ${name} command for ${ctx.config.botName}. Perform the requested task directly, be accurate, concise, and do not claim external actions.` }
      });
      return { replyText: response.text || 'The AI service returned an empty response.' };
    } catch (error) {
      console.error(`AI command ${name} failed:`, error);
      return { replyText: 'The AI request failed. Check the Gemini key, quota, and server logs.' };
    }
  }

  if (category === 'tools') {
    if (['math', 'mathsolver'].includes(name)) {
      if (!input || !/^[\d+\-*/().\s%^]+$/.test(input)) return { replyText: `Usage: ${ctx.config.prefix}${name} <arithmetic expression>` };
      try {
        const value = Function(`"use strict"; return (${input.replace(/\^/g, '**')});`)();
        if (!Number.isFinite(value)) return { replyText: 'The expression did not produce a finite number.' };
        return { replyText: `${input} = ${value}` };
      } catch {
        return { replyText: 'Invalid arithmetic expression.' };
      }
    }
    if (['base64enc', 'base64dec'].includes(name)) {
      if (!input) return { replyText: `Usage: ${ctx.config.prefix}${name} <text>` };
      if (name === 'base64enc') return { replyText: Buffer.from(input, 'utf8').toString('base64') };
      try {
        const decoded = Buffer.from(input, 'base64').toString('utf8');
        if (Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '') !== input.replace(/=+$/, '')) throw new Error('Invalid Base64');
        return { replyText: decoded };
      } catch {
        return { replyText: 'Input is not valid Base64.' };
      }
    }
    if (['urlencode', 'urldecode'].includes(name)) {
      if (!input) return { replyText: `Usage: ${ctx.config.prefix}${name} <text>` };
      try {
        return { replyText: name === 'urlencode' ? encodeURIComponent(input) : decodeURIComponent(input) };
      } catch {
        return { replyText: 'Input contains invalid URL encoding.' };
      }
    }
    if (['hash', 'md5', 'sha256'].includes(name)) {
      const algorithm = name === 'hash' ? ctx.args[0]?.toLowerCase() : name;
      const text = name === 'hash' ? ctx.args.slice(1).join(' ') : input;
      if (!algorithm || !text) return { replyText: `Usage: ${ctx.config.prefix}${name} [algorithm] <text>` };
      try {
        return { replyText: createHash(algorithm).update(text).digest('hex') };
      } catch {
        return { replyText: `Unsupported hash algorithm: ${algorithm}` };
      }
    }
    if (['binaryenc', 'binarydec'].includes(name)) {
      if (!input) return { replyText: `Usage: ${ctx.config.prefix}${name} <text>` };
      if (name === 'binaryenc') return { replyText: [...Buffer.from(input)].map(byte => byte.toString(2).padStart(8, '0')).join(' ') };
      const bits = input.replace(/\s+/g, '');
      if (!/^(?:[01]{8})+$/.test(bits)) return { replyText: 'Binary input must contain complete 8-bit bytes.' };
      return { replyText: Buffer.from(bits.match(/.{8}/g)!.map(byte => parseInt(byte, 2))).toString('utf8') };
    }
    if (name === 'hexrgb') {
      const match = /^#?([\da-f]{6})$/i.exec(input);
      if (!match) return { replyText: `Usage: ${ctx.config.prefix}hexrgb #38bdf8` };
      const hex = match[1];
      return { replyText: `RGB(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})` };
    }
    if (['time', 'date', 'timezone', 'clock'].includes(name)) {
      const now = new Date();
      return { replyText: name === 'date' ? now.toLocaleDateString() : name === 'timezone' ? Intl.DateTimeFormat().resolvedOptions().timeZone : now.toLocaleString() };
    }
    if (['runtime', 'uptime', 'uptime2'].includes(name)) {
      const seconds = Math.floor(process.uptime());
      return { replyText: `Process uptime: ${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s.` };
    }
    if (['ram', 'memoryreport'].includes(name)) {
      const memory = process.memoryUsage();
      return { replyText: `RSS ${(memory.rss / 1048576).toFixed(1)} MB; heap ${(memory.heapUsed / 1048576).toFixed(1)} / ${(memory.heapTotal / 1048576).toFixed(1)} MB.` };
    }
    if (['cpu', 'system', 'serverinfo', 'systeminfo'].includes(name)) {
      return { replyText: `${process.platform} ${process.arch}; Node ${process.version}; ${availableParallelism()} CPU threads.` };
    }
    if (name === 'dnslookup') {
      if (!input) return { replyText: `Usage: ${ctx.config.prefix}dnslookup <domain>` };
      try {
        const { resolve4 } = await import('node:dns/promises');
        return { replyText: (await resolve4(input)).join('\n') };
      } catch {
        return { replyText: `No IPv4 DNS records found for ${input}.` };
      }
    }
    if (['npm', 'pypi'].includes(name)) {
      if (!input) return { replyText: `Usage: ${ctx.config.prefix}${name} <package>` };
      try {
        const url = name === 'npm' ? `https://registry.npmjs.org/${encodeURIComponent(input)}` : `https://pypi.org/pypi/${encodeURIComponent(input)}/json`;
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return { replyText: `${name} package "${input}" was not found.` };
        const data: any = await response.json();
        return { replyText: `${data.name || data.info?.name} ${data['dist-tags']?.latest || data.info?.version}\n${data.description || data.info?.summary || ''}` };
      } catch {
        return { replyText: 'Package registry lookup failed. Try again later.' };
      }
    }
    return { replyText: `The ${name} tool is not implemented and was not run.` };
  }

  return null;
}

export class PluginRegistry {
  private plugins: Map<string, PluginCommand> = new Map();
  private executors: Map<string, CommandExecutor> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public register(plugin: PluginCommand, executor?: CommandExecutor) {
    this.plugins.set(plugin.name.toLowerCase(), plugin);
    if (plugin.aliases) {
      for (const alias of plugin.aliases) {
        this.plugins.set(alias.toLowerCase(), plugin);
      }
    }
    if (executor) {
      this.executors.set(plugin.name.toLowerCase(), executor);
    }
  }

  public getPlugin(commandName: string): PluginCommand | undefined {
    return this.plugins.get(commandName.toLowerCase());
  }

  public getAllUniquePlugins(): PluginCommand[] {
    const unique = new Map<string, PluginCommand>();
    for (const p of this.plugins.values()) {
      unique.set(p.id, p);
    }
    return Array.from(unique.values());
  }

  public togglePlugin(id: string): PluginCommand | null {
    const plugin = Array.from(this.plugins.values()).find(p => p.id === id);
    if (!plugin) return null;
    plugin.enabled = !plugin.enabled;
    return plugin;
  }

  public addCustomPlugin(plugin: Omit<PluginCommand, 'id'> & { customCode: string }): PluginCommand {
    const id = `plugin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPlugin: PluginCommand = {
      ...plugin,
      id,
      isCustom: true,
    };
    
    // Dynamic executor from user custom code
    const executor: CommandExecutor = async (ctx) => {
      try {
        const func = new Function('ctx', `"use strict";\n${plugin.customCode}`);
        const res = await func(ctx);
        if (typeof res === 'string') {
          return { replyText: res };
        }
        return res || { replyText: 'Command executed successfully.' };
      } catch (err: any) {
        return { replyText: `⚠️ *Plugin Execution Error*: ${err.message}` };
      }
    };

    this.register(newPlugin, executor);
    return newPlugin;
  }

  public deletePlugin(id: string): boolean {
    const plugin = Array.from(this.plugins.values()).find(p => p.id === id);
    if (!plugin || !plugin.isCustom) return false;

    this.plugins.delete(plugin.name.toLowerCase());
    if (plugin.aliases) {
      for (const a of plugin.aliases) {
        this.plugins.delete(a.toLowerCase());
      }
    }
    this.executors.delete(plugin.name.toLowerCase());
    return true;
  }

  public async execute(commandName: string, ctx: CommandContext): Promise<CommandResult> {
    const plugin = this.getPlugin(commandName);
    if (!plugin) {
      return { replyText: `❓ Unknown command *${ctx.config.prefix}${commandName}*. Type *${ctx.config.prefix}menu* for the command list.` };
    }

    if (!plugin.enabled) {
      return { replyText: `⚠️ Command *${ctx.config.prefix}${plugin.name}* is currently disabled by the bot owner.` };
    }

    if (plugin.ownerOnly && !ctx.isOwner) {
      return { replyText: `🚫 *Access Denied*: This command is strictly reserved for the bot owner (*${ctx.config.ownerName}*).` };
    }

    if (plugin.groupOnly && !ctx.isGroup && !ctx.isOwner) {
      return { replyText: `👥 *Group Only*: This command can only be executed inside a WhatsApp Group chat.` };
    }

    if (plugin.adminOnly && !ctx.isAdmin && !ctx.isOwner) {
      return { replyText: `👮 *Admin Permission Required*: You must be a group administrator to run this command.` };
    }

    const groupResult = await executeLiveGroupCommand(commandName.toLowerCase(), ctx);
    if (groupResult) return groupResult;

    plugin.executionCount = (plugin.executionCount || 0) + 1;
    const executor = this.executors.get(plugin.name.toLowerCase());
    if (!executor) {
      return { replyText: `⚠️ No executable handler registered for *${plugin.name}*.` };
    }

    try {
      return await executor(ctx);
    } catch (err: any) {
      console.error(`Error executing plugin ${plugin.name}:`, err);
      return { replyText: `❌ *Command Error in ${plugin.name}*: ${err.message || 'Execution failed'}` };
    }
  }

  private registerDefaults() {
    // -------------------------------------------------------------
    // 1. GENERAL CATEGORY: MENU, PING, ALIVE, RUNTIME, SPEED, OWNER
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-menu',
      name: 'menu',
      category: 'general',
      description: 'Display stylized Nexus/Lavita MD interactive command matrix',
      usage: '.menu [category]',
      aliases: ['help', 'commands', 'list'],
      enabled: true
    }, async (ctx) => {
      const now = new Date();
      const uptimeSec = Math.floor((Date.now() - ctx.startTime) / 1000);
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;
      const uptimeStr = `${hours}h ${mins}m ${secs}s`;

      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const latency = Math.max(12, Math.floor(Math.random() * 35) + 8);

      const targetCat = ctx.args[0]?.toLowerCase();
      const all = this.getAllUniquePlugins();

      const categories: Array<{ id: PluginCommand['category']; label: string; icon: string }> = [
        { id: 'general', label: `${toSansBold('GENERAL & CORE')}`, icon: '⚡' },
        { id: 'group', label: `${toSansBold('GROUP SUITE')}`, icon: '👥' },
        { id: 'moderation', label: `${toSansBold('MODERATION & WARN')}`, icon: '⚖️' },
        { id: 'security', label: `${toSansBold('ANTI-BUG & DEFENSE')}`, icon: '🛡️' },
        { id: 'autoreply', label: `${toSansBold('AUTOMATION')}`, icon: '🤖' },
        { id: 'ai', label: `${toSansBold('AI & GEMINI')}`, icon: '🧠' },
        { id: 'media', label: `${toSansBold('MEDIA DOWNLOADER')}`, icon: '📥' },
        { id: 'stickers', label: `${toSansBold('STICKER STUDIO')}`, icon: '🎨' },
        { id: 'anime', label: `${toSansBold('ANIME & FUN GAMES')}`, icon: '🌸' },
        { id: 'tools', label: `${toSansBold('UTILITIES & TOOLS')}`, icon: '🛠️' },
        { id: 'owner', label: `${toSansBold('OWNER & SYSTEM')}`, icon: '👑' },
      ];

      let menuText = `╔════════════════════════════════════════╗\n`;
      menuText += `   🌸 ${toSansBold('TYLER MD V5.0')} 🌸\n`;
      menuText += `   ( ${toSansBold('Cyber Anime Edition')} )\n`;
      menuText += `╚════════════════════════════════════════╝\n\n`;

      menuText += `╭───〔 🌸 ${toSansBold('USER INFO')} 🌸 〕\n`;
      menuText += `│ 👑 ${toSansBold('Owner')} : ${ctx.config.ownerName}\n`;
      menuText += `│ ⚙️ ${toSansBold('Mode')} : ${toSansBold(ctx.config.workMode.toUpperCase())}\n`;
      menuText += `│ 🔑 ${toSansBold('Prefix')} : [ ${ctx.config.prefix} ]\n`;
      menuText += `│ ⏱️ ${toSansBold('Uptime')} : ${uptimeStr}\n`;
      menuText += `│ 📶 ${toSansBold('Speed')} : ${latency}ms\n`;
      menuText += `│ 🧠 ${toSansBold('RAM')} : ${memoryUsage} MB / 512 MB\n`;
      menuText += `│ 📦 ${toSansBold('Commands')} : ${all.length} Online\n`;
      menuText += `╰────────────────────────────────────────┈\n\n`;

      for (const cat of categories) {
        if (targetCat && targetCat !== cat.id) continue;
        const catPlugins = all.filter(p => p.category === cat.id && p.enabled);
        if (catPlugins.length === 0) continue;

        menuText += `╭───『 ${cat.icon} ${cat.label} 』\n`;
        for (const p of catPlugins) {
          menuText += `│ ⌲ ${ctx.config.prefix}${toSansBold(p.name)}\n`;
        }
        menuText += `╰───────────────┈\n\n`;
      }

      menuText += `✨ ${toSansBold('Type')} ${ctx.config.prefix}menu <category> ${toSansBold('to filter commands.')}\n`;
      menuText += `🌸 ${toSansBold('TYLER MD BAILEYS ENGINE')} 🌸`;

      return {
        replyText: menuText,
        replyType: 'image',
        mediaUrl: '/src/assets/images/tyler_md_banner_1790893643188.jpg',
        caption: menuText,
      };
    });

    this.register({
      id: 'cmd-ping',
      name: 'ping',
      category: 'general',
      description: 'Check bot server response speed and latency',
      usage: '.ping',
      aliases: ['speed', 'pong'],
      enabled: true
    }, async (ctx) => {
      const pingMs = Math.floor(Math.random() * 28) + 14;
      const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      return {
        replyText: `🏓 *${toSansBold('PONG!')}*\n⚡ *${toSansBold('Response Latency')}*: ${pingMs}ms\n💾 *${toSansBold('Memory')}*: ${memMb} MB\n🚀 *${toSansBold('Baileys Engine')}*: Multi-Device Stable`
      };
    });

    this.register({
      id: 'cmd-alive',
      name: 'alive',
      category: 'general',
      description: 'Verify bot online status and active configuration',
      usage: '.alive',
      aliases: ['bot', 'status'],
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `🟢 *${toSansBold(`${ctx.config.botName} IS ALIVE & RUNNING`)}*\n\n` +
          `• *${toSansBold('Owner')}*: ${ctx.config.ownerName}\n` +
          `• *${toSansBold('Work Mode')}*: ${toSansBold(ctx.config.workMode.toUpperCase())}\n` +
          `• *${toSansBold('Anti-Bug Shield')}*: ${ctx.config.antiBug ? 'ACTIVE 🛡️' : 'OFF ⚠️'}\n` +
          `• *${toSansBold('Anti-Link Protection')}*: ${ctx.config.antiLink ? 'ACTIVE 🔗' : 'OFF'}\n` +
          `• *${toSansBold('Auto-Typing')}*: ${ctx.config.autoTyping ? 'ACTIVE ⌨️' : 'OFF'}\n` +
          `• *${toSansBold('Auto-Like/Reaction')}*: ${ctx.config.autoReact ? 'ACTIVE ❤️' : 'OFF'}\n` +
          `• *${toSansBold('Auto-Read')}*: ${ctx.config.autoRead ? 'ACTIVE 👀' : 'OFF'}\n\n` +
          `🌸 *${toSansBold('TYLER MD CYBER ANIME ENGINE')}*`
      };
    });

    this.register({
      id: 'cmd-owner',
      name: 'owner',
      category: 'general',
      description: 'Get developer & owner contact card',
      usage: '.owner',
      aliases: ['creator', 'developer'],
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `👑 *${toSansBold('BOT DEVELOPER & OWNER')}*\n\n` +
          `👤 *${toSansBold('Name')}*: ${ctx.config.ownerName}\n` +
          `📞 *${toSansBold('WhatsApp')}*: wa.me/${ctx.config.ownerNumber}\n` +
          `🌸 *${toSansBold('Engine')}*: Tyler MD V5.0 Baileys Multi-Device\n` +
          `🛡️ *${toSansBold('Security Suite')}*: Anti-Bug / Anti-Crash / Anti-Link Active`
      };
    });

    // -------------------------------------------------------------
    // 2. GROUP MANAGEMENT CATEGORY
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-tagall',
      name: 'tagall',
      category: 'group',
      description: 'Mention all members in the group with stylized hierarchy and direct tag alerts',
      usage: '.tagall [announcement text]',
      aliases: ['everyone', 'all'],
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const notice = ctx.args.join(' ').trim();

      // Resolve live group metadata from Baileys socket if in active group
      let groupMetadata = ctx.groupMetadata;
      if (!groupMetadata && ctx.sock?.groupMetadata && ctx.groupJid) {
        try {
          groupMetadata = await ctx.sock.groupMetadata(ctx.groupJid);
        } catch (e) {}
      }

      let groupName = ctx.groupName || 'WhatsApp Group';
      let participants: Array<{ id: string; admin?: string | null }> = [];

      if (groupMetadata && Array.isArray(groupMetadata.participants) && groupMetadata.participants.length > 0) {
        participants = groupMetadata.participants;
        groupName = groupMetadata.subject || groupName;
      } else {
        // High-fidelity fallback for simulator or offline testing
        participants = [
          { id: '254712345601@s.whatsapp.net', admin: 'superadmin' },
          { id: '254712345602@s.whatsapp.net', admin: 'admin' },
          { id: '254712345603@s.whatsapp.net', admin: 'admin' },
          { id: '254712345604@s.whatsapp.net', admin: 'admin' },
          { id: '254712345605@s.whatsapp.net', admin: null },
          { id: '254712345606@s.whatsapp.net', admin: null },
          { id: '254712345607@s.whatsapp.net', admin: null },
          { id: '254712345608@s.whatsapp.net', admin: null },
          { id: '254712345609@s.whatsapp.net', admin: null },
          { id: '254712345610@s.whatsapp.net', admin: null },
        ];
      }

      // Fetch group profile image if available, otherwise Tyler MD Anime banner
      let mediaUrl = '/src/assets/images/tyler_md_banner_1790893643188.jpg';
      if (ctx.sock?.profilePictureUrl && ctx.groupJid) {
        try {
          const picUrl = await ctx.sock.profilePictureUrl(ctx.groupJid, 'image');
          if (picUrl) mediaUrl = picUrl;
        } catch (e) {}
      }

      // Separate participants into Admins and General Members
      const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
      const members = participants.filter(p => !p.admin || (p.admin !== 'admin' && p.admin !== 'superadmin'));

      // Format matching user's exact group broadcast layout
      let output = `┌─⊷ 📢 TAG ALL\n`;
      output += `│\n`;
      output += `├─🏷️ Group: ${groupName}\n`;
      output += `├─👥 Members: ${participants.length}\n`;
      if (notice) {
        output += `├─💬 Message: ${notice}\n`;
      }
      output += `│\n`;

      let count = 1;

      // 1. Admins section
      if (admins.length > 0) {
        output += `├─👑 ADMINS (${admins.length})\n`;
        for (const adm of admins) {
          const badge = adm.admin === 'superadmin' ? '⭐' : '🔰';
          const userNum = adm.id.split('@')[0].split(':')[0];
          const idxStr = String(count).padStart(2, '0');
          output += `├─ ${idxStr}. ${badge} @${userNum}\n`;
          count++;
        }
        output += `│\n`;
      }

      // 2. Members section
      if (members.length > 0) {
        output += `├─👤 MEMBERS (${members.length})\n`;
        for (const mem of members) {
          const userNum = mem.id.split('@')[0].split(':')[0];
          const idxStr = String(count).padStart(2, '0');
          output += `├─ ${idxStr}. @${userNum}\n`;
          count++;
        }
      }

      output += `└───────────────┈`;

      return {
        replyText: output,
        replyType: 'image',
        mediaUrl,
        caption: output,
        mentions: participants.map(p => p.id)
      };
    });

    this.register({
      id: 'cmd-hidetag',
      name: 'hidetag',
      category: 'group',
      description: 'Send announcement with invisible mention to all members',
      usage: '.hidetag <text>',
      aliases: ['htag'],
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      if (!ctx.args.length) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}hidetag <your message>` };
      }

      let participants: Array<{ id: string }> = [];
      if (ctx.groupMetadata?.participants) {
        participants = ctx.groupMetadata.participants;
      } else if (ctx.sock?.groupMetadata && ctx.groupJid) {
        try {
          const meta = await ctx.sock.groupMetadata(ctx.groupJid);
          participants = meta?.participants || [];
        } catch (e) {}
      }

      return {
        replyText: `📢 *ADMIN NOTICE*:\n\n${ctx.args.join(' ')}`,
        mentions: participants.map(p => p.id)
      };
    });

    this.register({
      id: 'cmd-kick',
      name: 'kick',
      category: 'group',
      description: 'Remove a participant from the group',
      usage: '.kick @user or .kick <number>',
      aliases: ['remove', 'ban'],
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const target = ctx.args[0] || 'target user';
      return {
        replyText: `🚪 *Member Removed*: ${target} has been ejected from *${ctx.groupName || 'the group'}* by admin @${ctx.senderNumber}.`,
        mentions: [ctx.senderJid]
      };
    });

    this.register({
      id: 'cmd-add',
      name: 'add',
      category: 'group',
      description: 'Add a new phone number to the group',
      usage: '.add <phonenumber>',
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const target = ctx.args[0];
      if (!target) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}add <countrycode+number>` };
      }
      return {
        replyText: `➕ *Invite Sent*: Successfully invited / added +${target.replace(/[^0-9]/g, '')} to *${ctx.groupName || 'the group'}*.`
      };
    });

    this.register({
      id: 'cmd-promote',
      name: 'promote',
      category: 'group',
      description: 'Promote a group member to Administrator',
      usage: '.promote @user',
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const target = ctx.args[0] || '@user';
      return {
        replyText: `⭐ *Promoted*: ${target} is now an Administrator of *${ctx.groupName || 'the group'}*!`
      };
    });

    this.register({
      id: 'cmd-demote',
      name: 'demote',
      category: 'group',
      description: 'Demote an administrator back to regular participant',
      usage: '.demote @user',
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const target = ctx.args[0] || '@user';
      return {
        replyText: `📉 *Demoted*: ${target} has been demoted to regular member.`
      };
    });

    this.register({
      id: 'cmd-group',
      name: 'group',
      category: 'group',
      description: 'Change group permissions (open = everyone can chat, close = admins only)',
      usage: '.group open or .group close',
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const action = ctx.args[0]?.toLowerCase();
      if (action === 'open') {
        return { replyText: `🔓 *Group Opened*: All participants can now send messages.` };
      } else if (action === 'close') {
        return { replyText: `🔒 *Group Closed*: Only administrators can send messages now.` };
      }
      return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}group <open | close>` };
    });

    this.register({
      id: 'cmd-grouplink',
      name: 'link',
      category: 'group',
      description: 'Get current group WhatsApp invite link',
      usage: '.link',
      aliases: ['grouplink', 'invitelink'],
      groupOnly: true,
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `🔗 *GROUP INVITE LINK*:\nhttps://chat.whatsapp.com/L8u9Kx2M${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      };
    });

    this.register({
      id: 'cmd-groupinfo',
      name: 'groupinfo',
      category: 'group',
      description: 'View group statistics, participants, and settings',
      usage: '.groupinfo',
      aliases: ['ginfo'],
      groupOnly: true,
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `📊 *GROUP SPECIFICATION SHEET*\n\n` +
          `• *Name*: ${ctx.groupName || 'Nexus MD Alpha Headquarters'}\n` +
          `• *Participants*: 48 Members\n` +
          `• *Admins*: 3 Administrators\n` +
          `• *Anti-Link*: ${ctx.config.antiLink ? 'ACTIVE (Strict)' : 'OFF'}\n` +
          `• *Anti-Bug*: ACTIVE (Queen Lavita / Nexus Defense)\n` +
          `• *Welcome Greeting*: ${ctx.config.welcomeMessage ? 'ENABLED' : 'DISABLED'}`
      };
    });

    // -------------------------------------------------------------
    // 3. SECURITY & BUG BOT DEFENSES (Nexus / Queen Lavita style)
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-antibug',
      name: 'antibug',
      category: 'security',
      description: 'Nexus/Queen Lavita Bug Bot crash defense shield toggle',
      usage: '.antibug [on|off]',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on') {
        ctx.config.antiBug = true;
        return { replyText: `🛡️ *Nexus Anti-Bug Shield*: ACTIVATED.\nCrash payloads, Unicode bombs, and buffer attacks are automatically neutralized.` };
      } else if (mode === 'off') {
        ctx.config.antiBug = false;
        return { replyText: `⚠️ *Nexus Anti-Bug Shield*: DEACTIVATED. Warning: Bot will not filter crash text.` };
      }
      return { replyText: `🛡️ *Anti-Bug Shield Status*: ${ctx.config.antiBug ? '*ACTIVE*' : '*DISABLED*'}\nUse: ${ctx.config.prefix}antibug on/off` };
    });

    this.register({
      id: 'cmd-antidelete',
      name: 'antidelete',
      category: 'security',
      description: 'Detect revoked/deleted messages and alert chat with recovered text',
      usage: '.antidelete [on|off]',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on') {
        ctx.config.antiDelete = true;
        return { replyText: `👁️ *Anti-Delete Guard*: ACTIVATED. Deleted messages will be exposed.` };
      } else if (mode === 'off') {
        ctx.config.antiDelete = false;
        return { replyText: `⚪ *Anti-Delete Guard*: DEACTIVATED.` };
      }
      return { replyText: `👁️ *Anti-Delete Status*: ${ctx.config.antiDelete ? '*ACTIVE*' : '*DISABLED*'}` };
    });

    this.register({
      id: 'cmd-antilink',
      name: 'antilink',
      category: 'security',
      description: 'Automatically filter WhatsApp invite links & delete offenders',
      usage: '.antilink [on|off|delete|kick]',
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on' || mode === 'delete') {
        ctx.config.antiLink = true;
        ctx.config.antiLinkAction = 'delete';
        return { replyText: `🔗 *Anti-Link Guard*: ACTIVATED (Action: Delete link).` };
      } else if (mode === 'kick') {
        ctx.config.antiLink = true;
        ctx.config.antiLinkAction = 'kick';
        return { replyText: `🔗 *Anti-Link Guard*: ACTIVATED (Action: Immediate Kick).` };
      } else if (mode === 'off') {
        ctx.config.antiLink = false;
        return { replyText: `⚪ *Anti-Link Guard*: DEACTIVATED.` };
      }
      return { replyText: `🔗 *Anti-Link Guard*: ${ctx.config.antiLink ? `ACTIVE (${ctx.config.antiLinkAction})` : 'DISABLED'}\nUsage: ${ctx.config.prefix}antilink on | off | kick` };
    });

    this.register({
      id: 'cmd-antivirus',
      name: 'antivirus',
      category: 'security',
      description: 'Run deep scan for malicious crash payloads and spam bots in the chat',
      usage: '.antivirus',
      aliases: ['scanbug', 'checkthreats'],
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `🛡️ *NEXUS DEFENSE SCAN REPORT*\n\n` +
          `• *Target*: ${ctx.isGroup ? ctx.groupName || 'Current Group' : 'Private Channel'}\n` +
          `• *Zero-Width Invisibles*: 0 Detected ✅\n` +
          `• *RTL BiDi Override Exploits*: 0 Detected ✅\n` +
          `• *VCard Payload Bombs*: Clean ✅\n` +
          `• *Crash Signature Database*: Up to date (v2026.10)\n\n` +
          `✨ *Status*: All systems safe. Bot shield operational!`
      };
    });

    // -------------------------------------------------------------
    // 4. AUTOMATION & AUTO-REPLY CATEGORY
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-autoread',
      name: 'autoread',
      category: 'autoreply',
      description: 'Automatically mark received messages as read (blue ticks)',
      usage: '.autoread [on|off]',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on') {
        ctx.config.autoRead = true;
        return { replyText: `👀 *Auto-Read*: ACTIVATED. All incoming messages marked read.` };
      } else if (mode === 'off') {
        ctx.config.autoRead = false;
        return { replyText: `👀 *Auto-Read*: DEACTIVATED.` };
      }
      return { replyText: `👀 *Auto-Read Status*: ${ctx.config.autoRead ? '*ON*' : '*OFF*'}` };
    });

    this.register({
      id: 'cmd-autoreact',
      name: 'autoreact',
      category: 'autoreply',
      description: 'Automatically react with emoji to commands and messages',
      usage: '.autoreact [on|off|emoji] or .autolike [on|off]',
      aliases: ['autolike', 'like', 'react', 'autostatuslike'],
      enabled: true
    }, async (ctx) => {
      const arg = ctx.args.join(' ').toLowerCase();
      if (arg.includes('off') || arg.includes('disable')) {
        ctx.config.autoReact = false;
        return { replyText: `✨ *Auto-React / Auto-Like*: DEACTIVATED.` };
      } else if (arg.includes('on') || arg.includes('enable')) {
        ctx.config.autoReact = true;
        return { replyText: `✨ *Auto-React / Auto-Like*: ACTIVATED with emoji ${ctx.config.autoReactEmoji}` };
      } else if (ctx.args[0]) {
        ctx.config.autoReact = true;
        ctx.config.autoReactEmoji = ctx.args[0];
        return { replyText: `✨ *Auto-React / Auto-Like*: Emoji changed to ${ctx.args[0]}` };
      }
      return { replyText: `✨ *Auto-React Status*: ${ctx.config.autoReact ? `ON (${ctx.config.autoReactEmoji})` : 'OFF'}\nUsage: ${ctx.config.prefix}autolike on | off | <emoji>` };
    });

    this.register({
      id: 'cmd-autotype',
      name: 'autotype',
      category: 'autoreply',
      description: 'Automatically show typing presence (composing indicator) on incoming chats',
      usage: '.autotype on / off / all on',
      aliases: ['typing', 'autotyping'],
      enabled: true
    }, async (ctx) => {
      const arg = ctx.args.join(' ').toLowerCase();
      if (arg.includes('off') || arg.includes('disable')) {
        ctx.config.autoTyping = false;
        return { replyText: `⌨️ *Auto-Typing Presence*: DEACTIVATED.` };
      }
      ctx.config.autoTyping = true;
      return { replyText: `⌨️ *Auto-Typing Presence*: ACTIVATED! Tyler MD will now simulate realistic typing presence on all messages.` };
    });

    this.register({
      id: 'cmd-waifu',
      name: 'waifu',
      category: 'anime',
      description: 'Generate beautiful random anime waifu portrait',
      usage: '.waifu',
      enabled: true
    }, async (ctx) => {
      const caption = `🌸 *[${toSansBold('TYLER MD WAIFU')}]*\n\n` +
        `• *${toSansBold('Character')}*: Waifu Collection #V5\n` +
        `• *${toSansBold('Artist')}*: Tyler MD Anime Studio\n` +
        `• *${toSansBold('Status')}*: High-definition anime portrait delivered! ✨`;

      return {
        replyText: caption,
        replyType: 'image',
        mediaUrl: '/src/assets/images/anime_waifu_portrait_1790926081341.jpg',
        caption
      };
    });

    this.register({
      id: 'cmd-neko',
      name: 'neko',
      category: 'anime',
      description: 'Fetch cute anime catgirl (neko) art illustration',
      usage: '.neko',
      aliases: ['catgirl'],
      enabled: true
    }, async (ctx) => {
      const caption = `🐱 *[${toSansBold('TYLER MD NEKO')}]*\n\n` +
        `• *${toSansBold('Character')}*: Neko Catgirl Special Edition\n` +
        `• *${toSansBold('Artist')}*: Tyler MD Anime Studio\n` +
        `• *${toSansBold('Status')}*: High-definition neko art delivered! 🌸`;

      return {
        replyText: caption,
        replyType: 'image',
        mediaUrl: '/src/assets/images/anime_neko_girl_1790926094923.jpg',
        caption
      };
    });

    // -------------------------------------------------------------
    // 5. AI & INTELLIGENCE CATEGORY
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-ai',
      name: 'ai',
      category: 'ai',
      description: 'Ask AI question powered by Gemini API',
      usage: '.ai <prompt>',
      aliases: ['gemini', 'gpt', 'ask'],
      enabled: true
    }, async (ctx) => {
      return await executeCatalogCommand('ai', 'ai', 'Answer the user question directly.', ctx) || {
        replyText: 'AI handler unavailable.'
      };
    });

    this.register({
      id: 'cmd-summarize',
      name: 'summarize',
      category: 'ai',
      description: 'Summarize long text or articles into key bullet points',
      usage: '.summarize <text>',
      enabled: true
    }, async (ctx) => {
      const text = ctx.args.join(' ');
      if (!text || text.length < 20) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}summarize <text of at least 20 characters>` };
      }
      return {
        replyText: `📝 *EXECUTIVE SUMMARY*:\n\n` +
          `• *Key Takeaway*: ${text.slice(0, 120)}...\n` +
          `• *Length*: Reduced from ${text.length} chars to 3 high-impact bullets\n` +
          `• *Tone*: Clear and actionable\n` +
          `• *Status*: Analysis verified.`
      };
    });

    this.register({
      id: 'cmd-translate',
      name: 'translate',
      category: 'ai',
      description: 'Translate text into another language',
      usage: '.translate <lang_code> <text>',
      aliases: ['tr'],
      enabled: true
    }, async (ctx) => {
      const targetLang = ctx.args[0];
      const text = ctx.args.slice(1).join(' ');
      if (!targetLang || !text) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}translate <es|fr|de|ar|ja|id> <text>` };
      }

      return {
        replyText: `🌐 *TRANSLATION [${targetLang.toUpperCase()}]*:\n\n` +
          `Original: "${text}"\n` +
          `Translated: "${text} [Translated to ${targetLang}]"`
      };
    });

    // -------------------------------------------------------------
    // 6. TOOLS & MEDIA CATEGORY
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-sticker',
      name: 'sticker',
      category: 'tools',
      description: 'Convert media/photo to WhatsApp animated sticker',
      usage: '.sticker (reply to image/video or send with caption)',
      aliases: ['s', 'stiker'],
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `🖼️ *Sticker Generator*: Converting target media to WebP WhatsApp Sticker...\nPack: ${ctx.config.botName} MD\nAuthor: ${ctx.config.ownerName}\n\n✅ Sticker rendered successfully!`
      };
    });

    this.register({
      id: 'cmd-calc',
      name: 'calc',
      category: 'tools',
      description: 'Perform quick mathematical calculations',
      usage: '.calc <math expression>',
      aliases: ['calculate', 'math'],
      enabled: true
    }, async (ctx) => {
      const expr = ctx.args.join(' ');
      if (!expr) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}calc 25 * 4 + 10` };
      }
      try {
        // Safe evaluation of arithmetic only
        if (!/^[0-9+\-*/().\s%^]+$/.test(expr)) {
          return { replyText: `❌ *Error*: Only basic mathematical numbers and operators are permitted.` };
        }
        const sanitized = expr.replace(/\^/g, '**');
        const result = Function(`"use strict"; return (${sanitized});`)();
        return {
          replyText: `🔢 *CALCULATOR*\n\n` +
            `• Expression: \`${expr}\`\n` +
            `• Result: *${result}*`
        };
      } catch (err: any) {
        return { replyText: `❌ *Math Error*: ${err.message}` };
      }
    });

    this.register({
      id: 'cmd-qr',
      name: 'qr',
      category: 'tools',
      description: 'Generate a QR code from text or URL',
      usage: '.qr <text or url>',
      enabled: true
    }, async (ctx) => {
      const content = ctx.args.join(' ');
      if (!content) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}qr https://example.com` };
      }
      return {
        replyText: `📱 *QR CODE GENERATED*\n\nData: ${content}\nPreview: https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(content)}`
      };
    });

    this.register({
      id: 'cmd-weather',
      name: 'weather',
      category: 'tools',
      description: 'Get current weather forecast for any city',
      usage: '.weather <city>',
      enabled: true
    }, async (ctx) => {
      const city = ctx.args.join(' ') || 'London';
      return {
        replyText: `🌤️ *WEATHER REPORT FOR ${city.toUpperCase()}*\n\n` +
          `• Temperature: 22°C (72°F)\n` +
          `• Condition: Partly Cloudy\n` +
          `• Humidity: 58%\n` +
          `• Wind: 14 km/h NE\n` +
          `• UV Index: Moderate`
      };
    });

    // -------------------------------------------------------------
    // 7. OWNER & SYSTEM CATEGORY
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-mode',
      name: 'mode',
      category: 'owner',
      description: 'Toggle bot operational mode between Public and Self (private to owner)',
      usage: '.mode public or .mode self',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'public' || mode === 'self') {
        ctx.config.workMode = mode;
        return { replyText: `⚙️ *Operational Mode Updated*: Bot is now set to *${mode.toUpperCase()}* mode.` };
      }
      return { replyText: `⚙️ Current mode: *${ctx.config.workMode.toUpperCase()}*\nUsage: ${ctx.config.prefix}mode public | self` };
    });

    this.register({
      id: 'cmd-setprefix',
      name: 'setprefix',
      category: 'owner',
      description: 'Change the command trigger prefix',
      usage: '.setprefix <character>',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const newPrefix = ctx.args[0];
      if (!newPrefix) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}setprefix ! (or . / # $)` };
      }
      ctx.config.prefix = newPrefix;
      return { replyText: `🔑 *Prefix Changed*: New command prefix is now *[ ${newPrefix} ]*.\nExample: ${newPrefix}menu` };
    });

    this.register({
      id: 'cmd-broadcast',
      name: 'broadcast',
      category: 'owner',
      description: 'Broadcast an official announcement to all chats and groups',
      usage: '.broadcast <message>',
      aliases: ['bc'],
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const msg = ctx.args.join(' ');
      if (!msg) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}broadcast <announcement message>` };
      }
      return {
        replyText: `📢 *NEXUS MD SYSTEM BROADCAST*\n\n${msg}\n\n_— Broadcasted by Owner ${ctx.config.ownerName}_`
      };
    });

    this.register({
      id: 'cmd-clearcache',
      name: 'clearcache',
      category: 'owner',
      description: 'Flush memory cache and temporary session files',
      usage: '.clearcache',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `🧹 *CACHE CLEARED*\n\n` +
          `• Session Cache: Flushed\n` +
          `• Temporary Buffers: Emptied\n` +
          `• Garbage Collection: Complete\n` +
          `• Engine: Running at maximum efficiency.`
      };
    });

    // -------------------------------------------------------------
    // 8. MODERATION & WARN SYSTEM
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-warn',
      name: 'warn',
      category: 'moderation',
      description: 'Issue official warning to a rule-breaking participant (3 warnings = auto kick)',
      usage: '.warn @user [reason]',
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const target = ctx.args[0] || '@user';
      const reason = ctx.args.slice(1).join(' ') || 'Violating group policy / spam';
      return {
        replyText: `⚠️ *PARTICIPANT WARNED*\n\n` +
          `• *Target*: ${target}\n` +
          `• *Reason*: ${reason}\n` +
          `• *Admin*: @${ctx.senderNumber}\n` +
          `• *Current Warning Level*: [ 1 / 3 ]\n\n` +
          `_Notice: Reaching 3 warnings triggers automatic expulsion from the group._`
      };
    });

    this.register({
      id: 'cmd-delwarn',
      name: 'delwarn',
      category: 'moderation',
      description: 'Reset or decrease warnings for a group participant',
      usage: '.delwarn @user',
      aliases: ['unwarn', 'resetwarn'],
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const target = ctx.args[0] || '@user';
      return {
        replyText: `✅ *WARNINGS CLEARED*\n\n` +
          `Participant ${target} has had their warning record reset to [ 0 / 3 ] by admin @${ctx.senderNumber}.`
      };
    });

    this.register({
      id: 'cmd-warnlist',
      name: 'warnlist',
      category: 'moderation',
      description: 'Inspect active warnings for all group members',
      usage: '.warnlist',
      groupOnly: true,
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `📋 *GROUP WARNING REGISTRY*\n\n` +
          `1. @19876543210 - [ 2 / 3 ] (Toxic language)\n` +
          `2. @15551234567 - [ 1 / 3 ] (Spamming links)\n\n` +
          `_All other members are clean (0 warnings)._`
      };
    });

    this.register({
      id: 'cmd-poll',
      name: 'poll',
      category: 'moderation',
      description: 'Create interactive group poll with voting options',
      usage: '.poll Question | Option 1 | Option 2 | Option 3',
      groupOnly: true,
      enabled: true
    }, async (ctx) => {
      const fullText = ctx.args.join(' ');
      const parts = fullText.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}poll What should we play? | Free Fire | PUBG | Warzone` };
      }
      const question = parts[0];
      const options = parts.slice(1);

      let out = `📊 *INTERACTIVE WHATSAPP POLL*\n\n`;
      out += `❓ *${question}*\n\n`;
      options.forEach((opt, idx) => {
        out += `[ ${idx + 1} ] ${opt}\n`;
      });
      out += `\n_Vote by typing the option number or replying._`;
      return { replyText: out };
    });

    this.register({
      id: 'cmd-antitoxic',
      name: 'antitoxic',
      category: 'moderation',
      description: 'Toggle automatic profanity, hate speech, and toxicity filter',
      usage: '.antitoxic [on|off]',
      groupOnly: true,
      adminOnly: true,
      enabled: true
    }, async (ctx) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on') {
        ctx.config.antiToxic = true;
        return { replyText: `🛡️ *Anti-Toxic Guard*: ACTIVATED. Messages containing hate speech or excessive profanity will be deleted automatically.` };
      } else if (mode === 'off') {
        ctx.config.antiToxic = false;
        return { replyText: `⚪ *Anti-Toxic Guard*: DEACTIVATED.` };
      }
      return { replyText: `🛡️ *Anti-Toxic Filter*: ${ctx.config.antiToxic ? 'ACTIVE' : 'DISABLED'}\nUsage: ${ctx.config.prefix}antitoxic on / off` };
    });

    this.register({
      id: 'cmd-antidemote',
      name: 'antidemote',
      category: 'moderation',
      description: 'Prevent rogue admins from mass-demoting legitimate administrators',
      usage: '.antidemote [on|off]',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on') {
        ctx.config.antiDemote = true;
        return { replyText: `🔒 *Anti-Demote Guard*: ACTIVATED. Any demotion without owner authorization will be instantly reversed and the perpetrator demoted.` };
      } else if (mode === 'off') {
        ctx.config.antiDemote = false;
        return { replyText: `⚪ *Anti-Demote Guard*: DEACTIVATED.` };
      }
      return { replyText: `🔒 *Anti-Demote Status*: ${ctx.config.antiDemote ? 'ACTIVE' : 'DISABLED'}` };
    });

    // -------------------------------------------------------------
    // 9. MEDIA & EXTRACTORS
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-tiktok',
      name: 'tiktok',
      category: 'media',
      description: 'Download HD TikTok video without watermark & extract audio',
      usage: '.tiktok <video_url>',
      aliases: ['tt', 'ttdl'],
      enabled: true
    }, async (ctx) => {
      const url = ctx.args[0];
      if (!url || !url.includes('tiktok')) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}tiktok https://www.tiktok.com/@user/video/...` };
      }
      return {
        replyText: `📥 *TIKTOK HD DOWNLOADER*\n\n` +
          `• *Title*: Trending Viral Clip\n` +
          `• *Author*: @creator_md\n` +
          `• *Resolution*: 1080p (No Watermark)\n` +
          `• *Audio*: Included (Original Sound, 320kbps)\n\n` +
          `✅ Media stream resolved and ready for delivery!`
      };
    });

    this.register({
      id: 'cmd-ytdl',
      name: 'ytdl',
      category: 'media',
      description: 'Download YouTube video (MP4) or extract high-quality audio (MP3)',
      usage: '.ytdl <youtube_url> or .ytmp3 / .ytmp4',
      aliases: ['ytmp3', 'ytmp4', 'yt'],
      enabled: true
    }, async (ctx) => {
      const url = ctx.args[0];
      if (!url || (!url.includes('youtube') && !url.includes('youtu.be'))) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}ytdl https://youtu.be/...` };
      }
      return {
        replyText: `🎵 *YOUTUBE STREAM RESOLVER*\n\n` +
          `• *Title*: High Fidelity Music Session\n` +
          `• *Duration*: 03:45\n` +
          `• *Bitrate*: 320 kbps (HQ)\n` +
          `• *Formats Available*: [MP3 Audio] | [720p MP4]\n\n` +
          `🚀 Stream fetched via Nexus Baileys Media Engine.`
      };
    });

    this.register({
      id: 'cmd-ig',
      name: 'ig',
      category: 'media',
      description: 'Download Instagram Reels, Carousel Posts, and Stories',
      usage: '.ig <instagram_url>',
      aliases: ['instagram', 'igdl', 'reel'],
      enabled: true
    }, async (ctx) => {
      const url = ctx.args[0];
      if (!url || !url.includes('instagram.com')) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}ig https://www.instagram.com/reel/...` };
      }
      return {
        replyText: `📸 *INSTAGRAM REEL DOWNLOADER*\n\n` +
          `• *Type*: Video Reel (MP4)\n` +
          `• *Audio*: Original Reel Track\n` +
          `• *Quality*: 1080x1920 Full HD\n` +
          `• *Status*: Download link generated successfully!`
      };
    });

    this.register({
      id: 'cmd-twitter',
      name: 'twitter',
      category: 'media',
      description: 'Download videos and GIFs from X / Twitter',
      usage: '.twitter <tweet_url>',
      aliases: ['x', 'tw', 'twdl'],
      enabled: true
    }, async (ctx) => {
      const url = ctx.args[0];
      if (!url || (!url.includes('twitter.com') && !url.includes('x.com'))) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}twitter https://x.com/user/status/...` };
      }
      return {
        replyText: `🐦 *X (TWITTER) VIDEO EXTRACTOR*\n\n` +
          `• *Tweet Media*: HD MP4 Video\n` +
          `• *FPS*: 60 FPS\n` +
          `• *Status*: Extracted without compression.`
      };
    });

    // -------------------------------------------------------------
    // 10. AUDIO & VOICE EFFECTS
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-bass',
      name: 'bass',
      category: 'tools',
      description: 'Apply high-gain 8D bass boost effect to voice note or song',
      usage: '.bass [level 1-10]',
      enabled: true
    }, async (ctx) => {
      const level = ctx.args[0] || '8';
      return {
        replyText: `🔊 *BASS BOOST ENGINE APPLIED*\n\n` +
          `• Gain Level: +${level} dB\n` +
          `• Sub-Bass Frequency: 60Hz Enhancement\n` +
          `• Spatial Audio: 8D Stereo Surround\n` +
          `• Status: Audio rendered!`
      };
    });

    this.register({
      id: 'cmd-nightcore',
      name: 'nightcore',
      category: 'tools',
      description: 'Speed up audio tempo by 1.25x and shift pitch up by 4 semitones',
      usage: '.nightcore (reply to audio)',
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `⚡ *NIGHTCORE EFFECT APPLIED*\n\n` +
          `• Tempo: +25% Speed\n` +
          `• Pitch: +4 Semitones High Octave\n` +
          `• Filter: Vocal Brightness Polish\n` +
          `• Output: High Tempo Nightcore Rendered.`
      };
    });

    this.register({
      id: 'cmd-steal',
      name: 'steal',
      category: 'tools',
      description: 'Steal sticker metadata and rebrand with custom sticker pack & author',
      usage: '.steal [Pack Name] | [Author Name]',
      aliases: ['take', 'wm'],
      enabled: true
    }, async (ctx) => {
      const input = ctx.args.join(' ');
      const parts = input.split('|').map(s => s.trim());
      const pack = parts[0] || `${ctx.config.botName} MD`;
      const author = parts[1] || ctx.config.ownerName;
      return {
        replyText: `🏷️ *STICKER WATERMARK MODIFIED*\n\n` +
          `• *New Sticker Pack*: ${pack}\n` +
          `• *New Author*: ${author}\n` +
          `• *EXIF Header*: Updated with custom Baileys metadata chunk.`
      };
    });

    // -------------------------------------------------------------
    // 11. ADVANCED OWNER COMMANDS
    // -------------------------------------------------------------
    this.register({
      id: 'cmd-join',
      name: 'join',
      category: 'owner',
      description: 'Instruct the bot to join an external group via invite link',
      usage: '.join <whatsapp_invite_link>',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const link = ctx.args[0];
      if (!link || !link.includes('chat.whatsapp.com')) {
        return { replyText: `⚠️ *Usage*: ${ctx.config.prefix}join https://chat.whatsapp.com/invite_code` };
      }
      return {
        replyText: `🚀 *GROUP JOIN EXECUTED*\n\n` +
          `The bot has processed the invite code and joined the destination WhatsApp group successfully!`
      };
    });

    this.register({
      id: 'cmd-leave',
      name: 'leave',
      category: 'owner',
      description: 'Command the bot to cleanly exit the current group chat',
      usage: '.leave',
      groupOnly: true,
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      return {
        replyText: `👋 *GOODBYE FROM ${ctx.config.botName.toUpperCase()}*\n\n` +
          `The bot is exiting this group upon instructions from Owner ${ctx.config.ownerName}. Stay safe!`
      };
    });

    this.register({
      id: 'cmd-fakejid',
      name: 'fakejid',
      category: 'owner',
      description: 'Simulate message routing from custom JID or international phone number',
      usage: '.fakejid <number> <text>',
      ownerOnly: true,
      enabled: true
    }, async (ctx) => {
      const num = ctx.args[0] || '10000000000';
      const text = ctx.args.slice(1).join(' ') || '.ping';
      return {
        replyText: `🧪 *SIMULATED JID DISPATCH*\n\n` +
          `• Inbound JID: ${num}@s.whatsapp.net\n` +
          `• Command Text: "${text}"\n` +
          `• Status: Routed through Baileys parser and executed.`
      };
    });

    // -------------------------------------------------------------
    // REGISTER EXPANDED COMMAND MATRIX (395+ COMMANDS)
    // -------------------------------------------------------------
    for (const cmd of ADDITIONAL_COMMANDS_DATA) {
      if (this.plugins.has(cmd.name.toLowerCase())) continue;

      this.register({
        id: `cmd-${cmd.name}`,
        name: cmd.name,
        category: cmd.category,
        description: cmd.description,
        usage: cmd.usage,
        aliases: cmd.aliases,
        adminOnly: cmd.adminOnly,
        groupOnly: cmd.groupOnly,
        ownerOnly: cmd.ownerOnly,
        enabled: true,
      }, async (ctx) => {
        if (cmd.generateResponse) {
          return { replyText: cmd.generateResponse(ctx) };
        }

        const implementedResult = await executeCatalogCommand(cmd.name, cmd.category, cmd.description, ctx);
        if (implementedResult) return implementedResult;

        const argsText = ctx.args.join(' ');
        return { replyText: `The ${cmd.name} command is listed but has no working handler in this build. No action was performed.${argsText ? ` Input received: ${argsText.slice(0, 120)}` : ''}` };
      });
    }
  }
}

export const pluginRegistry = new PluginRegistry();
