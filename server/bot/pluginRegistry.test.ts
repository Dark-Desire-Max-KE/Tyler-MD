import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { BotConfig } from '../types';
import { CommandContext, pluginRegistry } from './pluginRegistry';
import { AutoReplyManager } from './autoReplyManager';
import { ModerationManager } from './moderationManager';

const config: BotConfig = {
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
  antiToxic: false,
  antiDemote: false,
  welcomeMessage: '',
  goodbyeMessage: '',
  maxMessageLength: 4000
};

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    senderJid: '254712345600@s.whatsapp.net',
    senderNumber: '254712345600',
    senderName: 'Test User',
    isGroup: true,
    groupJid: '120363000000000000@g.us',
    isAdmin: true,
    isBotAdmin: true,
    isOwner: false,
    command: 'test',
    args: [],
    rawText: '',
    config: { ...config },
    allPlugins: pluginRegistry.getAllUniquePlugins(),
    startTime: Date.now() - 1000,
    groupMetadata: { subject: 'Test Group', participants: [] },
    sock: {
      groupParticipantsUpdate: async () => [{ jid: '254712345601@s.whatsapp.net', status: '200' }],
      groupMetadata: async () => ({ subject: 'Test Group', participants: [] })
    },
    ...overrides
  };
}

describe('PluginRegistry live command behavior', () => {
  it('uses Baileys to remove the mentioned group participant', async () => {
    let requestedAction = '';
    let requestedTargets: string[] = [];
    const context = makeContext({
      sock: {
        groupParticipantsUpdate: async (_jid: string, targets: string[], action: string) => {
          requestedAction = action;
          requestedTargets = targets;
          return [{ jid: targets[0], status: '200' }];
        }
      },
      msg: {
        message: {
          extendedTextMessage: {
            contextInfo: { mentionedJid: ['254712345601@s.whatsapp.net'] }
          }
        }
      }
    });

    const result = await pluginRegistry.execute('kick', context);

    assert.equal(requestedAction, 'remove');
    assert.deepEqual(requestedTargets, ['254712345601@s.whatsapp.net']);
    assert.match(result.replyText || '', /accepted the remove request/);
  });

  it('rejects group mutations when the sender is not an admin', async () => {
    let actionCalled = false;
    const context = makeContext({
      isAdmin: false,
      isOwner: false,
      sock: {
        groupParticipantsUpdate: async () => {
          actionCalled = true;
          return [];
        }
      }
    });

    const result = await pluginRegistry.execute('kick', context);

    assert.equal(actionCalled, false);
    assert.match(result.replyText || '', /Admin Permission Required/);
  });

  it('runs local utility commands instead of generic catalog replies', async () => {
    const result = await pluginRegistry.execute('base64enc', makeContext({ args: ['hello'] }));

    assert.equal(result.replyText, 'aGVsbG8=');
  });

  it('reports unsupported catalog features without claiming success', async () => {
    const result = await pluginRegistry.execute('tiktokmp3', makeContext({ args: ['https://www.tiktok.com/example'] }));

    assert.match(result.replyText || '', /no working handler/);
    assert.match(result.replyText || '', /No action was performed/);
  });
});

describe('ModerationManager persistence', () => {
  it('persists group warnings, limits, and filtered words', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tyler-md-moderation-'));
    const statePath = path.join(directory, 'moderation.json');

    try {
      const manager = new ModerationManager(statePath);
      manager.setWarningLimit('group@g.us', 4);
      manager.addWarning('group@g.us', 'user@s.whatsapp.net', 'spam');
      manager.addBadWord('group@g.us', 'no-spam');

      const reloaded = new ModerationManager(statePath);
      assert.equal(reloaded.getWarningLimit('group@g.us'), 4);
      assert.equal(reloaded.getWarning('group@g.us', 'user@s.whatsapp.net').count, 1);
      assert.equal(reloaded.findBadWord('group@g.us', 'please no-spam here'), 'no-spam');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('AutoReplyManager custom rules', () => {
  it('clears custom rules without removing defaults', () => {
    const manager = new AutoReplyManager();
    const added = manager.addRule({
      trigger: 'custom test',
      matchType: 'exact',
      response: 'custom response',
      enabled: true
    });

    assert.equal(manager.clearCustomRules(), 1);
    assert.equal(manager.updateRule(added.id, { enabled: false }), null);
    assert.ok(manager.getRules().some(rule => rule.id === 'rule-greeting'));
  });
});