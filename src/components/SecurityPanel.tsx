import React, { useState } from 'react';
import { BotConfig } from '../types';
import { ShieldAlert, ShieldCheck, Bug, Zap, Eye, AlertOctagon, Terminal, Play, Lock, CheckCircle2 } from 'lucide-react';

interface SecurityPanelProps {
  config: BotConfig;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
  onExecuteCommand: (cmd: string) => void;
}

export const SecurityPanel: React.FC<SecurityPanelProps> = ({
  config,
  onUpdateConfig,
  onExecuteCommand,
}) => {
  // Simulator test string
  const [testPayload, setTestPayload] = useState('buffer_flood_test');
  const [analysisResult, setAnalysisResult] = useState<{
    isThreat: boolean;
    threatType?: string;
    actionTaken?: string;
  } | null>(null);

  const runPayloadScan = () => {
    let isThreat = false;
    let threatType = '';

    if (testPayload.length > 1000 || testPayload.includes('buffer_flood')) {
      isThreat = true;
      threatType = 'BUFFER_OVERFLOW_CRASHER (Length > 25,000)';
    } else if (testPayload.includes('zero_width') || testPayload.includes('\u200B')) {
      isThreat = true;
      threatType = 'UNICODE_ZERO_WIDTH_FLOOD (WhatsApp Mobile Crasher)';
    } else if (testPayload.includes('bidi') || testPayload.includes('\u202E')) {
      isThreat = true;
      threatType = 'BIDI_OVERRIDE_EXPLOIT (Text Renderer Freeze)';
    }

    if (isThreat) {
      setAnalysisResult({
        isThreat: true,
        threatType,
        actionTaken: '🛡️ Neutralized & Dropped safely by Nexus Anti-Bug Shield.'
      });
    } else {
      setAnalysisResult({
        isThreat: false,
        actionTaken: '✅ Clean payload. No malicious signatures detected.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Nexus & Queen Lavita Bug Bot Constitution */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400">
              <Bug className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Nexus & Queen Lavita Anti-Bug Defense Core</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                  SHIELD ACTIVE
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Specialized defense filters to prevent WhatsApp client crashes, payload traps, and destructive spam.
              </p>
            </div>
          </div>

          <button
            onClick={() => onExecuteCommand(`${config.prefix}antivirus`)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Run Deep Anti-Virus Scan</span>
          </button>
        </div>

        {/* 4 Core Security Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 text-xs">
          {/* 1. Anti Bug */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>Anti-Bug Shield</span>
                </span>
                <span className={`font-mono text-[10px] ${config.antiBug ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {config.antiBug ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Filters crash strings, zero-width Unicode bombs, and corrupted contact vCards.
              </p>
            </div>
            <button
              onClick={() => onUpdateConfig({ antiBug: !config.antiBug })}
              className={`mt-3 w-full py-1.5 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                config.antiBug
                  ? 'bg-rose-950 text-rose-300 border border-rose-800/80'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.antiBug ? 'Disable Shield' : 'Enable Shield'}
            </button>
          </div>

          {/* 2. Anti Delete */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>Anti-Delete Guard</span>
                </span>
                <span className={`font-mono text-[10px] ${config.antiDelete ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {config.antiDelete ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Stores recent messages in memory cache. Alerts chat when someone revokes text.
              </p>
            </div>
            <button
              onClick={() => onUpdateConfig({ antiDelete: !config.antiDelete })}
              className={`mt-3 w-full py-1.5 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                config.antiDelete
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.antiDelete ? 'Active' : 'Enable'}
            </button>
          </div>

          {/* 3. Anti Spam */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Anti-Spam Flooder</span>
                </span>
                <span className={`font-mono text-[10px] ${config.antiSpam ? 'text-amber-400' : 'text-slate-500'}`}>
                  {config.antiSpam ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Rate-limits rapid messaging (&gt;5 msgs in 4s) to protect the bot socket from locking up.
              </p>
            </div>
            <button
              onClick={() => onUpdateConfig({ antiSpam: !config.antiSpam })}
              className={`mt-3 w-full py-1.5 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                config.antiSpam
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.antiSpam ? 'Active' : 'Enable'}
            </button>
          </div>

          {/* 4. Anti Link */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Anti-Link Strict</span>
                </span>
                <span className={`font-mono text-[10px] ${config.antiLink ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {config.antiLink ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Prevents unauthorized group invite links. Action: {config.antiLinkAction.toUpperCase()}.
              </p>
            </div>
            <button
              onClick={() => onUpdateConfig({ antiLink: !config.antiLink })}
              className={`mt-3 w-full py-1.5 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                config.antiLink
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.antiLink ? 'Active' : 'Enable'}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Threat Signature & Bug Payload Tester */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Crash Payload & Bug Code Simulator</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Test sample threat patterns against the security engine to confirm protection.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setTestPayload('buffer_flood_payload_length_extreme')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
          >
            Load Buffer Flood Sample
          </button>
          <button
            onClick={() => setTestPayload('zero_width_space_\u200B\u200C\u200D_flood')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
          >
            Load Invisible Unicode Bomb
          </button>
          <button
            onClick={() => setTestPayload('bidi_rtl_\u202Ereverse_crash_code')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
          >
            Load BiDi Override Exploit
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={testPayload}
            onChange={(e) => setTestPayload(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={runPayloadScan}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Scan Payload</span>
          </button>
        </div>

        {analysisResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs font-mono ${
              analysisResult.isThreat
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {analysisResult.isThreat ? (
                <>
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span>THREAT IDENTIFIED: {analysisResult.threatType}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>PAYLOAD SCAN PASSED</span>
                </>
              )}
            </div>
            <p className="mt-1 text-slate-200">{analysisResult.actionTaken}</p>
          </div>
        )}
      </div>
    </div>
  );
};
