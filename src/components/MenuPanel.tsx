import React, { useState } from 'react';
import { PluginCommand, BotConfig } from '../types';
import { Search, Copy, Check, Play, Shield, Terminal, Sparkles, Filter, Code } from 'lucide-react';

interface MenuPanelProps {
  plugins: PluginCommand[];
  config: BotConfig;
  onTryCommand: (cmd: string) => void;
}

export const MenuPanel: React.FC<MenuPanelProps> = ({
  plugins,
  config,
  onTryCommand,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: `All Commands (${plugins.length})` },
    { id: 'general', label: '⚡ General' },
    { id: 'group', label: '👥 Group' },
    { id: 'moderation', label: '⚖️ Moderation' },
    { id: 'security', label: '🛡️ Anti-Bug' },
    { id: 'autoreply', label: '🤖 Auto-Reply' },
    { id: 'ai', label: '🧠 AI Studio' },
    { id: 'media', label: '📥 Media' },
    { id: 'stickers', label: '🎨 Stickers' },
    { id: 'anime', label: '🌸 Anime & Fun' },
    { id: 'tools', label: '🛠️ Utilities' },
    { id: 'owner', label: '👑 Owner' },
  ];

  const filteredPlugins = plugins.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.aliases && p.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  return (
    <div className="space-y-6">
      {/* 🌸 Tyler MD Cyber Anime Girl Banner & Header */}
      <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(168,85,247,0.15)] relative overflow-hidden backdrop-blur-xl">
        <div className="relative rounded-xl overflow-hidden border border-purple-500/40 mb-5 shadow-2xl group">
          <img
            src="/images/tyler_md_banner_1790893643188.jpg"
            alt="Tyler MD Cyber Anime Girl Banner"
            referrerPolicy="no-referrer"
            className="w-full h-52 sm:h-72 object-cover object-center transform group-hover:scale-[1.01] transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-cyan-300 uppercase bg-purple-950/80 px-2.5 py-1 rounded-md border border-purple-500/50 inline-block mb-1.5 font-bold">
                  CYBER ANIME EDITION · BAILEYS MULTI-DEVICE
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 drop-shadow-md">
                  <span>🌸 𝚻𝐘𝐋𝐄𝐑 𝐌𝐃 𝐕𝟓.𝟎 🌸</span>
                </h2>
                <p className="text-xs text-purple-200/90 font-mono mt-1">
                  Stylish Anime Command Matrix · {plugins.length}+ Commands Online
                </p>
              </div>

              <button
                onClick={() => onTryCommand(`${config.prefix}menu`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-purple-950/80"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Test .menu with Anime Card</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live WhatsApp Menu Text Preview (Stylish Fonts, Commands Only Without Explanation) */}
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-purple-300 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre selection:bg-purple-500/40 selection:text-white">
{`╔════════════════════════════════════════╗
   🌸 𝚻𝐘𝐋𝐄𝐑 𝐌𝐃 𝐕𝟓.𝟎 🌸
   ( 𝓒𝔂𝓫𝓮𝓻 𝓐𝓷𝓲𝓶𝓮 𝓔𝓭𝓲𝓽𝓲𝓸𝓷 )
╚════════════════════════════════════════╝

╭───〔 🌸 𝔘𝔖𝔈ℜ ℑ𝔑𝔉𝔒 🌸 〕
│ 👑 𝔒𝔴𝔫𝔢𝔯 : ${config.ownerName}
│ ⚙️ 𝔐𝔬𝔡𝔢 : ${config.workMode.toUpperCase()}
│ 🔑 𝔓𝔯𝔢𝔣𝔦𝔵 : [ ${config.prefix} ]
│ ⏱️ 𝔘𝔭𝔱𝔦𝔪𝔢 : 04h 32m 10s
│ 📶 𝔖𝔭𝔢𝔢𝔡 : 16ms
│ 🧠 ℜ𝔄𝔐 : 142 MB / 512 MB
│ 📦 ℭ𝔬𝔪𝔪𝔞𝔫𝔡𝔰 : ${plugins.length} Online
╰────────────────────────────────────────┈

╭───『 ⚡ 𝐆𝐄𝐍𝐄𝐑𝐀𝐋 & 𝐂𝐎𝐑𝐄 』
│ ⌲ ${config.prefix}menu
│ ⌲ ${config.prefix}help
│ ⌲ ${config.prefix}ping
│ ⌲ ${config.prefix}speed
│ ⌲ ${config.prefix}runtime
│ ⌲ ${config.prefix}alive
│ ⌲ ${config.prefix}owner
╰───────────────┈

╭───『 🌸 𝐀𝐍𝐈𝐌𝐄 & 𝐅𝐔𝐍 𝐆𝐀𝐌𝐄𝐒 』
│ ⌲ ${config.prefix}anime
│ ⌲ ${config.prefix}waifu
│ ⌲ ${config.prefix}neko
│ ⌲ ${config.prefix}husbando
│ ⌲ ${config.prefix}shinobu
│ ⌲ ${config.prefix}megumin
│ ⌲ ${config.prefix}kiss
│ ⌲ ${config.prefix}hug
│ ⌲ ${config.prefix}pat
│ ⌲ ${config.prefix}slap
╰───────────────┈

✨ 𝒯𝓎𝓅ℯ ${config.prefix}𝓂ℯ𝓃𝓊 <𝒸𝒶𝓉ℯℊℴ𝓇𝓎> 𝓉ℴ 𝒻𝒾𝓁𝓉ℯ𝓇.
🌸 𝚻𝐘𝐋𝐄𝐑 𝐌𝐃 𝚩𝚨𝚰𝐋𝚬𝐘𝐒 𝚵𝚴𝐆𝚰𝚴𝚵 🌸`}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Segmented Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-purple-900/80 to-slate-800 text-purple-200 border border-purple-500/60 font-semibold shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${plugins.length} commands...`}
            className="w-full pl-8 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>

      {/* Commands Only Grid (Without bulky explanations) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {filteredPlugins.map((plugin) => {
          const commandTrigger = `${config.prefix}${plugin.name}`;
          const isCopied = copiedCmd === commandTrigger;

          return (
            <div
              key={plugin.id}
              className="p-3 rounded-xl border bg-slate-900/70 border-slate-800/90 hover:border-purple-500/50 hover:bg-slate-900/90 backdrop-blur-md transition-all flex items-center justify-between group shadow-sm"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-purple-400 text-xs">⌲</span>
                <span className="font-mono text-xs font-bold text-white group-hover:text-purple-300 truncate">
                  {commandTrigger}
                </span>
              </div>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                <button
                  onClick={() => handleCopy(commandTrigger)}
                  className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy command"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => onTryCommand(commandTrigger)}
                  className="p-1 rounded bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 transition-colors"
                  title="Run in Simulator"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800/80">
          <Terminal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No commands found matching "{searchQuery}".</p>
        </div>
      )}
    </div>
  );
};
