import React, { useState } from 'react';
import { PluginCommand, BotConfig } from '../types';
import { Puzzle, Plus, Trash2, Check, Code, Play, Search, Shield, Zap } from 'lucide-react';

interface PluginsPanelProps {
  plugins: PluginCommand[];
  config: BotConfig;
  onTogglePlugin: (id: string) => Promise<void>;
  onCreatePlugin: (plugin: any) => Promise<void>;
  onDeletePlugin: (id: string) => Promise<void>;
  onTryCommand: (cmd: string) => void;
}

export const PluginsPanel: React.FC<PluginsPanelProps> = ({
  plugins,
  config,
  onTogglePlugin,
  onCreatePlugin,
  onDeletePlugin,
  onTryCommand,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PluginCommand['category']>('tools');
  const [description, setDescription] = useState('');
  const [usage, setUsage] = useState('');
  const [groupOnly, setGroupOnly] = useState(false);
  const [adminOnly, setAdminOnly] = useState(false);
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [customCode, setCustomCode] = useState(
`// ctx contains: { sock, msg, text, args, senderNumber, senderName, isGroup, config }
const query = ctx.args.join(' ');
if (!query) {
  return \`⚠️ Please provide input for .\${ctx.command}\`;
}
return \`⚡ Custom Plugin Result for "\${query}" from \${ctx.config.botName}!\`;`
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !customCode.trim()) return;

    await onCreatePlugin({
      name: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      category,
      description,
      usage: usage || `.${name}`,
      aliases: [],
      adminOnly,
      groupOnly,
      ownerOnly,
      customCode,
    });

    setName('');
    setDescription('');
    setUsage('');
    setShowModal(false);
  };

  const filtered = plugins.filter((p) => {
    const matchCat = selectedCat === 'all' || p.category === selectedCat;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-emerald-400" />
            <span>Plugin Architecture & Dynamic Registry ({plugins.length})</span>
          </h2>
          <p className="text-xs text-slate-400">
            Modular Baileys command plugins. Enable, disable, or author custom plugins live without restarting.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Author Custom Plugin</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {['all', 'general', 'group', 'security', 'autoreply', 'ai', 'tools', 'owner'].map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                selectedCat === c
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Grid of Plugins */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const cmdTrigger = `${config.prefix}${p.name}`;

          return (
            <div
              key={p.id}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                p.enabled ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">
                      {cmdTrigger}
                    </span>
                    {p.isCustom ? (
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                        Custom
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">
                        Built-in
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTogglePlugin(p.id)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                        p.enabled
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      {p.enabled ? 'ENABLED' : 'DISABLED'}
                    </button>
                    {p.isCustom && (
                      <button
                        onClick={() => onDeletePlugin(p.id)}
                        className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300"
                        title="Delete custom plugin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-3">{p.description}</p>
                <div className="bg-slate-950/80 p-2 rounded text-[11px] font-mono text-slate-400 border border-slate-800/60 truncate mb-3">
                  <span className="text-slate-500">Usage: </span>
                  <span>{p.usage}</span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="capitalize">{p.category}</span>
                <button
                  onClick={() => onTryCommand(cmdTrigger)}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Test in Simulator</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Author Custom Plugin */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Author Custom Plugin (Live Sandbox)</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-slate-300 mb-1">Command Name (without prefix):</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. dice, weather, lookup, crypto"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-mono text-slate-300 mb-1">Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value="tools">Tools & Utilities</option>
                    <option value="general">General & Info</option>
                    <option value="group">Group Management</option>
                    <option value="security">Security & Defenses</option>
                    <option value="ai">AI & Intelligence</option>
                    <option value="owner">Owner Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-300 mb-1">Description:</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Roll virtual dice with custom number of sides"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminOnly}
                    onChange={(e) => setAdminOnly(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-300">Admin only</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupOnly}
                    onChange={(e) => setGroupOnly(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-300">Group only</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ownerOnly}
                    onChange={(e) => setOwnerOnly(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-300">Owner only</span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-slate-300">JavaScript Execution Handler:</label>
                  <span className="text-[10px] text-slate-500 font-mono">Runs securely with ctx</span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Save & Register Plugin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
