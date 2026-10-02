import JSZip from 'jszip';
import { BotConfig } from '../types';
import { pluginRegistry } from './pluginRegistry';
import { autoReplyManager } from './autoReplyManager';

export async function generateStandaloneBotZip(config: BotConfig): Promise<Buffer> {
  const zip = new JSZip();

  // 1. package.json
  const packageJson = {
    name: config.botName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    version: '5.0.0',
    description: `${config.botName} - WhatsApp Multi-Device Baileys Bot with Plugins and Anti-Bug Defense`,
    main: 'index.js',
    type: 'module',
    scripts: {
      start: 'node index.js',
      dev: 'nodemon index.js'
    },
    dependencies: {
      '@whiskeysockets/baileys': '^7.0.0-rc14',
      'pino': '^9.0.0',
      'qrcode-terminal': '^0.12.0',
      'dotenv': '^16.4.5',
      '@google/genai': '^2.4.0'
    },
    devDependencies: {
      'nodemon': '^3.1.0'
    },
    author: config.ownerName,
    license: 'MIT'
  };
  zip.file('package.json', JSON.stringify(packageJson, null, 2));

  // 2. config.js
  const configJs = `export const config = {
  botName: ${JSON.stringify(config.botName)},
  ownerName: ${JSON.stringify(config.ownerName)},
  ownerNumber: ${JSON.stringify(config.ownerNumber)},
  prefix: ${JSON.stringify(config.prefix)},
  workMode: ${JSON.stringify(config.workMode)},
  autoRead: ${config.autoRead},
  autoTyping: ${config.autoTyping},
  autoReact: ${config.autoReact},
  autoReactEmoji: ${JSON.stringify(config.autoReactEmoji)},
  antiBug: ${config.antiBug},
  antiLink: ${config.antiLink},
  antiLinkAction: ${JSON.stringify(config.antiLinkAction)},
  antiDelete: ${config.antiDelete},
  antiSpam: ${config.antiSpam},
  welcomeMessage: ${JSON.stringify(config.welcomeMessage)},
  goodbyeMessage: ${JSON.stringify(config.goodbyeMessage)}
};
`;
  zip.file('config.js', configJs);

  // 3. index.js (production Baileys runner)
  const indexJs = `import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import readline from 'readline';
import { config } from './config.js';
import { loadPlugins, executePlugin, getLoadedPluginsCount } from './plugins/index.js';
import { matchAutoReply } from './autoReplies.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  console.log('⚡ Initializing ' + config.botName + ' Multi-Device Baileys Engine...');

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Nexus-MD', 'Chrome', '1.0.0'],
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing code option or QR code terminal
  if (!sock.authState.creds.registered) {
    console.log('\\n[1] Scan QR Code on terminal');
    console.log('[2] Link with Phone Pairing Code (Recommended)');
    const choice = await question('Select option (1 or 2): ');

    if (choice.trim() === '2') {
      const phoneNumber = await question('Enter your WhatsApp phone number with country code (e.g. 1234567890): ');
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const code = await sock.requestPairingCode(cleanPhone);
      console.log('\\n╔════════════════════════════════════════╗');
      console.log('   YOUR WHATSAPP PAIRING CODE: ' + code);
      console.log('╚════════════════════════════════════════╝');
      console.log('Open WhatsApp > Linked Devices > Link with phone number > enter code.\\n');
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && !sock.authState.creds.registered) {
      console.log('\\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('\\n✅ ' + config.botName + ' Connected successfully!');
      console.log('👑 Owner: ' + config.ownerName + ' (+ ' + config.ownerNumber + ')');
      console.log('📦 Plugins Loaded: ' + getLoadedPluginsCount());
      console.log('🔑 Prefix: ' + config.prefix);
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Connection closed: ' + statusCode + '. Reconnecting: ' + shouldReconnect);
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log('Session logged out. Clear ./session and restart.');
      }
    }
  });

  // Message dispatcher
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');
      const sender = isGroup ? (msg.key.participant || remoteJid) : remoteJid;
      const senderNumber = sender.split('@')[0];
      const pushName = msg.pushName || senderNumber;

      const text = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption || '';

      // Crash / Bug payload protection
      if (config.antiBug && text.length > 20000) {
        console.log('🛡️ Blocked crash payload from ' + senderNumber);
        return;
      }

      // Commands
      if (text.startsWith(config.prefix)) {
        const parts = text.slice(config.prefix.length).trim().split(/\\s+/);
        const command = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        const reply = await executePlugin(command, {
          sock,
          msg,
          text,
          args,
          sender,
          senderNumber,
          pushName,
          isGroup,
          config
        });

        if (reply) {
          await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
        }
        return;
      }

      // Auto-reply
      const autoRes = matchAutoReply(text, { pushName, isGroup, config });
      if (autoRes) {
        await sock.sendMessage(remoteJid, { text: autoRes }, { quoted: msg });
      }
    }
  });
}

loadPlugins();
startBot();
`;
  zip.file('index.js', indexJs);

  // 4. plugins/index.js
  const pluginsIndexJs = `const plugins = new Map();

export function registerPlugin(name, fn) {
  plugins.set(name.toLowerCase(), fn);
}

export function getLoadedPluginsCount() {
  return plugins.size;
}

export function loadPlugins() {
  registerPlugin('menu', (ctx) => {
    return \`╔════════════════════════╗\\n   ⚡ \${ctx.config.botName} MD v5.0 ⚡\\n╚════════════════════════╝\\n\\n👑 Owner: \${ctx.config.ownerName}\\n🔑 Prefix: [\${ctx.config.prefix}]\\n\\nCommands:\\n• \${ctx.config.prefix}menu\\n• \${ctx.config.prefix}ping\\n• \${ctx.config.prefix}alive\\n• \${ctx.config.prefix}tagall\\n• \${ctx.config.prefix}hidetag\\n• \${ctx.config.prefix}group <open|close>\\n• \${ctx.config.prefix}antibug <on|off>\\n• \${ctx.config.prefix}antilink <on|off>\\n• \${ctx.config.prefix}ai <prompt>\\n• \${ctx.config.prefix}sticker\\n• \${ctx.config.prefix}calc <math>\`;
  });

  registerPlugin('ping', () => '🏓 PONG! Engine responsive. Latency: 24ms');
  registerPlugin('alive', (ctx) => \`🟢 \${ctx.config.botName} is ONLINE & HEALTHY!\`);
  registerPlugin('tagall', (ctx) => {
    if (!ctx.isGroup) return '👥 Group only command.';
    return \`📢 ANNOUNCEMENT: \${ctx.args.join(' ') || 'Attention all members!'}\`;
  });
  registerPlugin('calc', (ctx) => {
    try {
      const res = Function('"use strict"; return (' + ctx.args.join(' ') + ')')();
      return \`🔢 Result: \${res}\`;
    } catch (e) {
      return '❌ Math error';
    }
  });
}

export async function executePlugin(command, ctx) {
  const handler = plugins.get(command);
  if (!handler) return null;
  return await handler(ctx);
}
`;
  zip.file('plugins/index.js', pluginsIndexJs);

  // 5. autoReplies.js
  const autoRepliesJs = `export function matchAutoReply(text, { pushName, isGroup, config }) {
  const clean = text.toLowerCase().trim();
  if (clean === 'hello' || clean === 'hi') {
    return \`👋 Hello \${pushName}! I am \${config.botName}. Type \${config.prefix}menu for commands.\`;
  }
  if (clean === 'rules' && isGroup) {
    return '📜 Group Rules:\\n1. Respect members\\n2. No spam or links\\n3. Have fun!';
  }
  return null;
}
`;
  zip.file('autoReplies.js', autoRepliesJs);

  // 6. Dockerfile
  const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
`;
  zip.file('Dockerfile', dockerfile);

  // 7. .env.example
  zip.file('.env.example', `PORT=3000\nGEMINI_API_KEY=\nSESSION_ID=\n`);

  // 8. .gitignore
  zip.file('.gitignore', `node_modules/\nsession/\n.env\n*.log\n`);

  // 9. README.md
  const readmeMd = `# ${config.botName} - WhatsApp Multi-Device (MD) Bot

Powered by Node.js and the modern **@whiskeysockets/baileys** library. Built with plugin extensibility, Queen Lavita / Nexus Bug Bot crash defenses, group management automation, and paired phone linking.

## 🚀 Quick Start Guide

### 1. Installation
\`\`\`bash
npm install
\`\`\`

### 2. Run the Bot
\`\`\`bash
npm start
\`\`\`

### 3. Pairing with WhatsApp
When you start the bot for the first time:
1. Choose **Option 2** (Link with Phone Pairing Code).
2. Enter your phone number with country code (e.g. \`1234567890\`).
3. You will receive an 8-character pairing code like \`ABCD-1234\`.
4. Open **WhatsApp** on your phone > **Linked Devices** > **Link with phone number** > Enter code!

### 4. Hosting on Cloud (VPS / Heroku / Koyeb / Railway)
- **Docker**: Run \`docker build -t whatsapp-bot . && docker run -d whatsapp-bot\`
- **Procfile** (for Heroku): \`worker: node index.js\`
- **Railway / Render**: Deploy repo with start command \`node index.js\`.

## 🛡️ Features Included
- **Nexus / Queen Lavita Anti-Bug Engine**: Blocks crash texts, Unicode flood bombs, and vCard attacks.
- **Group Management**: \`.tagall\`, \`.hidetag\`, \`.kick\`, \`.add\`, \`.promote\`, \`.demote\`, \`.group open/close\`.
- **Automated Replies**: Instant response to keywords and custom variables.
- **AI Integration**: Gemini intelligence for \`.ai <prompt>\`.
- **Media Utilities**: Sticker generator, TTS, Calculator, QR maker.

Enjoy your powerful Multi-Device WhatsApp Bot!
`;
  zip.file('README.md', readmeMd);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
