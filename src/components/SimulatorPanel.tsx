import React, { useState, useRef, useEffect } from 'react';
import { BotConfig, ChatMessage } from '../types';
import { Send, Bot, Shield, CheckCheck, Trash2, Sparkles, Terminal, Phone, Users } from 'lucide-react';

interface SimulatorPanelProps {
  config: BotConfig;
  chatHistory: ChatMessage[];
  onSendMessage: (text: string, persona: { isGroup: boolean; isAdmin: boolean; isOwner: boolean }) => Promise<void>;
  onClearHistory: () => void;
  isLoading: boolean;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  config,
  chatHistory,
  onSendMessage,
  onClearHistory,
  isLoading,
}) => {
  const [inputText, setInputText] = useState('');
  const [persona, setPersona] = useState<'member' | 'admin' | 'owner'>('owner');
  const [isGroup, setIsGroup] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const text = inputText;
    setInputText('');
    await onSendMessage(text, {
      isGroup,
      isAdmin: persona === 'admin' || persona === 'owner',
      isOwner: persona === 'owner',
    });
  };

  const handleQuickCmd = (cmd: string) => {
    onSendMessage(cmd, {
      isGroup,
      isAdmin: persona === 'admin' || persona === 'owner',
      isOwner: persona === 'owner',
    });
  };

  // Helper to parse WhatsApp markdown (*bold*, _italic_, ~strike~, `code`)
  const formatWhatsAppText = (text: string) => {
    if (!text) return '';

    // Simple formatting transformer
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let formatted = line;

      // Bold: *text*
      formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      // Italic: _text_
      formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
      // Code: `text`
      formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 py-0.5 rounded font-mono text-emerald-300 text-xs">$1</code>');

      return (
        <span
          key={idx}
          className="block min-h-[1.2em]"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    });
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Simulator Control & Persona Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-slate-300">
            <span>Context:</span>
            <button
              onClick={() => setIsGroup(!isGroup)}
              className={`px-2.5 py-1 rounded-md border font-semibold transition-colors ${
                isGroup
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {isGroup ? 'Group Chat (Nexus HQ)' : 'Private DM with Bot'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-slate-300">
            <span>Sender Role:</span>
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
              {(['member', 'admin', 'owner'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setPersona(r)}
                  className={`px-2.5 py-1 rounded capitalize transition-colors ${
                    persona === r
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onClearHistory}
          className="flex items-center gap-1.5 px-2.5 py-1 text-slate-400 hover:text-rose-300 transition-colors"
          title="Clear simulator chat history"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* WhatsApp Simulated Phone Screen */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-2xl bg-[#0b141a] flex flex-col h-[580px]">
        {/* Top Phone / Chat Header */}
        <div className="bg-[#202c33] px-4 py-3 border-b border-[#2a3942] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-purple-500/50 shadow-md shrink-0">
              <img
                src="/src/assets/images/tyler_md_avatar_1790893655486.jpg"
                alt="Tyler MD"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                {isGroup ? 'Tyler MD Cyber Anime HQ' : config.botName}
                <CheckCheck className="w-3.5 h-3.5 text-purple-400" />
              </h3>
              <p className="text-[11px] text-purple-300 font-mono">
                {isLoading ? 'bot typing...' : `${config.botName} · online 🌸`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
            <span className="hidden sm:inline">Multi-Device Engine</span>
          </div>
        </div>

        {/* Chat History Canvas */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 wa-chat-bg">
          {/* Welcome disclaimer bubble */}
          <div className="flex justify-center">
            <div className="bg-[#182229]/90 border border-[#222e35] px-3.5 py-1.5 rounded-lg text-[11px] text-slate-400 text-center max-w-md shadow-sm">
              🔒 Tyler MD Baileys Engine Active. Type <code className="text-purple-300">{config.prefix}menu</code> to view anime card & commands.
            </div>
          </div>

          {chatHistory.map((msg) => {
            const isBot = msg.sender === 'bot';
            const isSystem = msg.sender === 'system';
            const isMenuMessage = msg.text.includes('TYLER MD') || msg.text.includes('𝗧𝗬𝗟𝗘𝗥') || msg.text.includes('𝚻𝐘𝐋𝐄𝐑') || msg.replyType === 'image' || Boolean(msg.bannerUrl);

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-rose-950/40 border border-rose-800/60 px-3 py-1 rounded text-[11px] text-rose-300 font-mono">
                    {msg.text}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-3 shadow-md text-xs relative ${
                    isBot
                      ? 'bg-[#202c33] text-slate-100 border border-[#2a3942] rounded-tl-none'
                      : 'bg-[#005c4b] text-white rounded-tr-none'
                  }`}
                >
                  {/* Sender Name in group */}
                  {isGroup && (
                    <div
                      className={`text-[11px] font-semibold mb-1 font-mono ${
                        isBot ? 'text-purple-300' : 'text-amber-300'
                      }`}
                    >
                      {msg.senderName}
                    </div>
                  )}

                  {/* 🌸 Anime & Media Image for Bot responses */}
                  {isBot && (msg.replyType === 'image' || Boolean(msg.mediaUrl) || isMenuMessage) && (
                    <div className="mb-2.5 rounded-lg overflow-hidden border border-purple-500/40 shadow-lg">
                      <img
                        src={msg.mediaUrl || (isMenuMessage ? '/src/assets/images/tyler_md_banner_1790893643188.jpg' : '/src/assets/images/anime_waifu_portrait_1790926081341.jpg')}
                        alt="Tyler MD Anime Response"
                        referrerPolicy="no-referrer"
                        className="w-full max-h-64 object-cover object-center"
                      />
                    </div>
                  )}

                  {/* Body Text */}
                  <div className="whitespace-pre-wrap leading-relaxed break-words font-sans">
                    {formatWhatsAppText(msg.text)}
                  </div>

                  {/* Timestamp & double checkmarks */}
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400/80 mt-1.5 select-none font-mono">
                    {msg.latencyMs !== undefined && (
                      <span className="text-emerald-400/70 mr-1">{msg.latencyMs}ms ·</span>
                    )}
                    <span>{msg.timestamp}</span>
                    <CheckCheck className={`w-3.5 h-3.5 ${isBot ? 'text-cyan-400' : 'text-cyan-300'}`} />
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#202c33] rounded-xl px-3.5 py-2 border border-[#2a3942] flex items-center gap-1.5 text-xs text-slate-400">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse delay-100">●</span>
                <span className="animate-pulse delay-200">●</span>
                <span className="text-[11px] font-mono ml-1 text-slate-500">Processing command...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Command Suggestions */}
        <div className="bg-[#111b21] px-3 py-2 border-t border-[#202c33] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-mono text-slate-500 shrink-0">Quick run:</span>
          {[
            `${config.prefix}menu`,
            `${config.prefix}ping`,
            `${config.prefix}alive`,
            `${config.prefix}tagall Meeting Now!`,
            `${config.prefix}ai What is Baileys?`,
            `${config.prefix}calc 250*4+9`,
            `${config.prefix}sticker`,
            'hello',
            'rules',
          ].map((cmd) => (
            <button
              key={cmd}
              onClick={() => handleQuickCmd(cmd)}
              className="px-2 py-0.5 rounded bg-[#202c33] hover:bg-[#2a3942] text-slate-300 hover:text-emerald-300 text-[11px] font-mono whitespace-nowrap transition-colors border border-slate-800"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Bottom Input Area */}
        <form
          onSubmit={handleSend}
          className="bg-[#202c33] px-3 py-2.5 flex items-center gap-2 border-t border-[#2a3942]"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Type a command (e.g. ${config.prefix}menu) or message...`}
            className="flex-1 bg-[#2a3942] border border-transparent rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
