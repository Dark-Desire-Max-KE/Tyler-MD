import React, { useState } from 'react';
import { BotConfig } from '../types';
import { Sliders, Save, Check, Sparkles, Key, Shield, User, Bot, AlertTriangle } from 'lucide-react';

interface SettingsPanelProps {
  config: BotConfig;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  onUpdateConfig,
}) => {
  const [botName, setBotName] = useState(config.botName);
  const [ownerName, setOwnerName] = useState(config.ownerName);
  const [ownerNumber, setOwnerNumber] = useState(config.ownerNumber);
  const [prefix, setPrefix] = useState(config.prefix);
  const [workMode, setWorkMode] = useState<BotConfig['workMode']>(config.workMode);
  const [autoReactEmoji, setAutoReactEmoji] = useState(config.autoReactEmoji);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onUpdateConfig({
      botName: botName.trim(),
      ownerName: ownerName.trim(),
      ownerNumber: ownerNumber.trim().replace(/[^0-9]/g, ''),
      prefix: prefix.trim() || '.',
      workMode,
      autoReactEmoji: autoReactEmoji.trim() || '⚡',
    });
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Core Bot Configuration & Identity</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Personalize bot metadata, command prefix, owner privileges, and response behavior.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-md disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved Changes!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>

        {/* Identity & Prefix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block font-mono text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bot Name (MD Branding):</span>
            </label>
            <input
              type="text"
              required
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g. Nexus MD, Queen Lavita, Alpha Bot"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-mono text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Command Prefix (Trigger Symbol):</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={3}
                required
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="."
                className="w-20 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono text-center text-sm font-bold focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                {['.', '!', '#', '/'].map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPrefix(p)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-200"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-mono text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Owner Display Name:</span>
            </label>
            <input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Tyler"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-mono text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Owner WhatsApp Phone (without +):</span>
            </label>
            <input
              type="text"
              required
              value={ownerNumber}
              onChange={(e) => setOwnerNumber(e.target.value)}
              placeholder="e.g. 14155552671"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Operational Work Mode */}
        <div className="pt-4 border-t border-slate-800">
          <label className="block text-xs font-mono text-slate-300 mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Work Mode (Privacy Scope):</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div
              onClick={() => setWorkMode('public')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                workMode === 'public'
                  ? 'bg-cyan-950/40 border-cyan-700 text-cyan-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white">Public Mode</span>
                <span className="font-mono text-[10px] text-cyan-400">DEFAULT</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Bot responds to commands sent by all group members and private chats.
              </p>
            </div>

            <div
              onClick={() => setWorkMode('self')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                workMode === 'self'
                  ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white">Self Mode (Private)</span>
                <span className="font-mono text-[10px] text-amber-400">OWNER ONLY</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Bot only responds to commands executed by you (owner). All other users ignored.
              </p>
            </div>
          </div>
        </div>

        {/* AI & Gemini Capabilities Info */}
        <div className="pt-4 border-t border-slate-800 bg-slate-950/50 -mx-6 -mb-6 p-6 rounded-b-xl text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white">AI Engine Integration (Gemini 2.5)</h4>
              <p className="text-slate-400 text-[11px] mt-0.5">
                The bot features native AI commands like <code className="text-emerald-400 font-mono">.ai &lt;prompt&gt;</code> and <code className="text-emerald-400 font-mono">.summarize</code> powered by Google Gemini. The system automatically reads <code className="text-slate-300 font-mono">GEMINI_API_KEY</code> from runtime environment.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
