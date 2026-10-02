import React, { useState } from 'react';
import { AutoReplyRule, BotConfig } from '../types';
import { Bot, Plus, Trash2, Check, Sparkles, Clock, Play, Tag, Sliders, Eye, Smile } from 'lucide-react';

interface AutoRepliesPanelProps {
  rules: AutoReplyRule[];
  config: BotConfig;
  onAddRule: (rule: Omit<AutoReplyRule, 'id'>) => Promise<void>;
  onToggleRule: (id: string) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
}

export const AutoRepliesPanel: React.FC<AutoRepliesPanelProps> = ({
  rules,
  config,
  onAddRule,
  onToggleRule,
  onDeleteRule,
  onUpdateConfig,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [trigger, setTrigger] = useState('');
  const [matchType, setMatchType] = useState<AutoReplyRule['matchType']>('contains');
  const [response, setResponse] = useState('');
  const [isGroupOnly, setIsGroupOnly] = useState(false);
  const [isPrivateOnly, setIsPrivateOnly] = useState(false);
  const [delayMs, setDelayMs] = useState(200);

  // Test workbench state
  const [testInput, setTestInput] = useState('hello');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !response.trim()) return;

    await onAddRule({
      trigger: trigger.trim(),
      matchType,
      response: response.trim(),
      enabled: true,
      isGroupOnly,
      isPrivateOnly,
      replyWithQuoted: true,
      delayMs,
    });

    setTrigger('');
    setResponse('');
    setShowAddModal(false);
  };

  const handleInsertVariable = (v: string) => {
    setResponse((prev) => prev + v);
  };

  const runTestTrigger = () => {
    const clean = testInput.trim().toLowerCase();
    for (const r of rules) {
      if (!r.enabled) continue;
      let matched = false;
      const t = r.trigger.toLowerCase();
      if (r.matchType === 'exact' && clean === t) matched = true;
      if (r.matchType === 'contains' && clean.includes(t)) matched = true;
      if (r.matchType === 'startsWith' && clean.startsWith(t)) matched = true;
      if (r.matchType === 'regex') {
        try {
          matched = new RegExp(r.trigger, 'i').test(testInput);
        } catch {
          matched = false;
        }
      }
      if (matched) {
        const interpolated = r.response
          .replace(/{pushName}/g, 'Tyler')
          .replace(/{user}/g, '@14155552671')
          .replace(/{group}/g, 'Nexus HQ')
          .replace(/{botName}/g, config.botName)
          .replace(/{ownerName}/g, config.ownerName)
          .replace(/{time}/g, new Date().toLocaleTimeString());
        setTestResult(interpolated);
        return;
      }
    }
    setTestResult('No auto-reply rule matched this input.');
  };

  return (
    <div className="space-y-6">
      {/* Presence & Behavior Settings Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Automated Behavior & Chat Presence</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Auto Read */}
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-200 font-medium">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auto-Read Messages</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Sends blue double ticks on receive</p>
            </div>
            <button
              onClick={() => onUpdateConfig({ autoRead: !config.autoRead })}
              className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                config.autoRead
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.autoRead ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Auto Typing */}
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-200 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-Typing Presence</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Shows "typing..." before reply</p>
            </div>
            <button
              onClick={() => onUpdateConfig({ autoTyping: !config.autoTyping })}
              className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                config.autoTyping
                  ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.autoTyping ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Auto React */}
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-200 font-medium">
                <Smile className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-React Emojis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Emoji: {config.autoReactEmoji}</p>
            </div>
            <button
              onClick={() => onUpdateConfig({ autoReact: !config.autoReact })}
              className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                config.autoReact
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.autoReact ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Reply Rule Manager Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>Keyword Auto-Responders ({rules.length})</span>
          </h2>
          <p className="text-xs text-slate-400">
            Automate WhatsApp replies when incoming messages match specified triggers.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Auto-Reply Rule</span>
        </button>
      </div>

      {/* Rules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
              rule.enabled ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-950/40 border-slate-900 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    "{rule.trigger}"
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">
                    [{rule.matchType}]
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleRule(rule.id)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                      rule.enabled
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    {rule.enabled ? 'ACTIVE' : 'MUTED'}
                  </button>
                  <button
                    onClick={() => onDeleteRule(rule.id)}
                    className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 text-xs font-mono text-slate-300 whitespace-pre-wrap mb-3 leading-relaxed">
                {rule.response}
              </div>
            </div>

            {/* Metadata unboxed */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <div className="flex items-center gap-2">
                <span>{rule.isGroupOnly ? 'Groups only' : rule.isPrivateOnly ? 'Private only' : 'All chats'}</span>
                <span aria-hidden="true">·</span>
                <span>{rule.delayMs || 200}ms delay</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Trigger Tester Workbench */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider mb-2 flex items-center gap-2">
          <Play className="w-3.5 h-3.5 text-cyan-400" />
          <span>Interactive Auto-Reply Test Sandbox</span>
        </h4>
        <p className="text-xs text-slate-400 mb-3">
          Type sample text to simulate what the bot will reply with based on your active rules.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Type message to test e.g. hello, rules..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={runTestTrigger}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
          >
            Test Trigger
          </button>
        </div>

        {testResult && (
          <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-cyan-800/40 text-xs font-mono text-cyan-300 whitespace-pre-wrap">
            <span className="text-[10px] text-slate-500 block mb-1">Simulated Output:</span>
            {testResult}
          </div>
        )}
      </div>

      {/* Modal: Create Auto-Reply Rule */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create Automated Reply Rule</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-mono text-slate-300 mb-1">Trigger Text / Keyword:</label>
                <input
                  type="text"
                  required
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder="e.g. price, account, support, promo"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-mono text-slate-300 mb-1">Matching Rule Type:</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value="contains">Contains Trigger Keyword (Flexible)</option>
                  <option value="exact">Exact Match Only (Strict)</option>
                  <option value="startsWith">Starts With Trigger</option>
                  <option value="regex">Regular Expression Pattern</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-slate-300">Bot Response Template:</label>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-slate-500">Insert tag:</span>
                    {['{user}', '{pushName}', '{group}', '{botName}', '{time}'].map((v) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => handleInsertVariable(v)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={4}
                  required
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Hello {pushName}, thank you for contacting {botName}!"
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGroupOnly}
                    onChange={(e) => setIsGroupOnly(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-300">Groups only</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivateOnly}
                    onChange={(e) => setIsPrivateOnly(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-300">Private DMs only</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Save Auto-Reply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
