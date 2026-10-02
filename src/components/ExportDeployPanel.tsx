import React, { useState } from 'react';
import { SessionInfo, BotConfig } from '../types';
import { DownloadCloud, KeyRound, Trash2, Copy, Check, Terminal, Server, Container, Smartphone, FileArchive, UploadCloud } from 'lucide-react';

interface ExportDeployPanelProps {
  session: SessionInfo;
  config: BotConfig;
  onClearSession: () => Promise<void>;
  onImportSession: (sessionStr: string) => Promise<void>;
}

export const ExportDeployPanel: React.FC<ExportDeployPanelProps> = ({
  session,
  config,
  onClearSession,
  onImportSession,
}) => {
  const [importInput, setImportInput] = useState('');
  const [copiedSession, setCopiedSession] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [activeDeployTab, setActiveDeployTab] = useState<'vps' | 'docker' | 'railway' | 'termux'>('vps');

  const handleExportZip = () => {
    window.location.href = '/api/export-project';
  };

  const handleCopySession = () => {
    if (session.sessionString) {
      navigator.clipboard.writeText(session.sessionString);
      setCopiedSession(true);
      setTimeout(() => setCopiedSession(false), 2000);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importInput.trim()) return;
    setIsImporting(true);
    try {
      await onImportSession(importInput.trim());
      setImportInput('');
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (e) {
      // error handled in parent
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1-Click Standalone Export Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-cyan-950/40 border border-emerald-800/60 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileArchive className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Download Standalone {config.botName} Repository
            </h2>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Get the full, production-ready Node.js Baileys bot codebase as a ZIP archive. Ready to deploy on any VPS, cloud server, Heroku, Railway, or Docker instance with zero modifications.
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-3">
            <span>Includes: package.json</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>index.js</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>All Plugins</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Dockerfile</span>
          </div>
        </div>

        <button
          onClick={handleExportZip}
          className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-emerald-950 transition-all hover:scale-[1.02]"
        >
          <DownloadCloud className="w-4 h-4" />
          <span>Download Bot ZIP</span>
        </button>
      </div>

      {/* Session Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Session ID */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <KeyRound className="w-4 h-4" />
              <h3 className="text-sm font-bold text-white">Session Credentials & Export</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Export your Baileys multi-device credentials string (SESSION_ID). Essential for hosting on ephemeral clouds (Heroku, Koyeb, Render) where local disk resets on sleep.
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5 mb-4">
              <div className="flex justify-between text-slate-400">
                <span>Auth Directory:</span>
                <span className="text-slate-200">./session_data</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Credentials Registered:</span>
                <span className={session.registered ? 'text-emerald-400' : 'text-amber-400'}>
                  {session.registered ? 'YES (Active)' : 'NO (Unpaired)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Files in Auth Cache:</span>
                <span className="text-slate-200">{session.fileCount || 0} files ({session.sizeKb || 0} KB)</span>
              </div>
            </div>

            {session.sessionString ? (
              <div className="space-y-2">
                <label className="block text-[11px] font-mono text-slate-400">Your Base64 Session String:</label>
                <div className="relative">
                  <input
                    readOnly
                    type="password"
                    value={session.sessionString}
                    className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300"
                  />
                  <button
                    onClick={handleCopySession}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    title="Copy Session String"
                  >
                    {copiedSession ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No active session string available. Please link with QR Code or Pairing Code first.
              </p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Need to link another number?</span>
            <button
              onClick={onClearSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 text-xs font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Session</span>
            </button>
          </div>
        </div>

        {/* Import Session ID */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <UploadCloud className="w-4 h-4" />
              <h3 className="text-sm font-bold text-white">Import Existing Session</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Already have a SESSION_ID from another deployment or backup? Paste it below to restore your WhatsApp login instantly without re-scanning.
            </p>

            <form onSubmit={handleImport} className="space-y-3">
              <textarea
                rows={4}
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder="Paste NEXUS-MD;;;base64... or raw creds.json here"
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />

              {importSuccess && (
                <div className="p-2 rounded bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-1.5 font-mono">
                  <Check className="w-3.5 h-3.5" />
                  <span>Session imported successfully! Restart bot to apply.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isImporting || !importInput.trim()}
                className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Import & Restore Session</span>
              </button>
            </form>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Accepts Base64 encoded auth strings or raw WhatsApp credentials JSON.
          </div>
        </div>
      </div>

      {/* Deployment Recipes Guide */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Deployment Recipes & Run Guides</h3>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {[
              { id: 'vps', label: 'Ubuntu / VPS', icon: Server },
              { id: 'docker', label: 'Docker', icon: Container },
              { id: 'railway', label: 'Railway / Render', icon: Terminal },
              { id: 'termux', label: 'Termux (Android)', icon: Smartphone },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveDeployTab(t.id as any)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeDeployTab === t.id
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipe Content */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2 overflow-x-auto">
          {activeDeployTab === 'vps' && (
            <div>
              <p className="text-emerald-400 font-semibold mb-2"># Ubuntu / Debian / VPS Setup Guide:</p>
              <pre className="text-slate-300 leading-relaxed">
{`# 1. Update package manager & install Node.js 20+
sudo apt update && sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Extract downloaded ZIP or clone repository
cd /opt/whatsapp-bot
npm install

# 3. Use PM2 for 24/7 background process management
sudo npm install -g pm2
pm2 start index.js --name "${config.botName.toLowerCase().replace(/[^a-z0-9]/g, '-')}"
pm2 save
pm2 startup`}
              </pre>
            </div>
          )}

          {activeDeployTab === 'docker' && (
            <div>
              <p className="text-cyan-400 font-semibold mb-2"># Docker Container Deployment:</p>
              <pre className="text-slate-300 leading-relaxed">
{`# Build Docker image
docker build -t whatsapp-md-bot .

# Run with persistent volume for session credentials
docker run -d \\
  --name nexus-bot \\
  --restart unless-stopped \\
  -v $(pwd)/session:/app/session \\
  whatsapp-md-bot

# Check logs for pairing code / QR
docker logs -f nexus-bot`}
              </pre>
            </div>
          )}

          {activeDeployTab === 'railway' && (
            <div>
              <p className="text-amber-400 font-semibold mb-2"># Railway / Render / Koyeb Cloud:</p>
              <pre className="text-slate-300 leading-relaxed">
{`1. Push the unzipped bot files to your GitHub repository.
2. Link your GitHub repo to Railway (railway.app) or Render.
3. Start command: node index.js
4. Add Environment Variable:
   SESSION_ID = your_exported_session_string
5. The bot will automatically authenticate and stay online 24/7.`}
              </pre>
            </div>
          )}

          {activeDeployTab === 'termux' && (
            <div>
              <p className="text-emerald-400 font-semibold mb-2"># Termux on Android Phone:</p>
              <pre className="text-slate-300 leading-relaxed">
{`pkg update && pkg install nodejs git
cd storage/downloads/whatsapp-bot
npm install
node index.js
# Select option 2 to pair with your phone number`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
