import React, { useState } from 'react';
import { BotConfig } from '../types';
import { Users, Megaphone, UserPlus, UserMinus, ShieldAlert, Link as LinkIcon, Lock, Unlock, Sparkles, Check, ArrowRight } from 'lucide-react';

interface GroupManagerPanelProps {
  config: BotConfig;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
  onExecuteCommand: (cmd: string) => void;
}

export const GroupManagerPanel: React.FC<GroupManagerPanelProps> = ({
  config,
  onUpdateConfig,
  onExecuteCommand,
}) => {
  const [tagallMessage, setTagallMessage] = useState('Important announcement for all group members!');
  const [hidetagMessage, setHidetagMessage] = useState('System maintenance tonight at 02:00 AM UTC.');
  const [phoneNumberToAdd, setPhoneNumberToAdd] = useState('');
  const [memberToKick, setMemberToKick] = useState('');
  const [welcomeText, setWelcomeText] = useState(config.welcomeMessage);
  const [goodbyeText, setGoodbyeText] = useState(config.goodbyeMessage);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveGreetings = async () => {
    setIsSaving(true);
    await onUpdateConfig({
      welcomeMessage: welcomeText,
      goodbyeMessage: goodbyeText,
    });
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleAntiLinkToggle = async (enabled: boolean) => {
    await onUpdateConfig({ antiLink: enabled });
  };

  const handleAntiLinkAction = async (action: 'delete' | 'warn' | 'kick') => {
    await onUpdateConfig({ antiLinkAction: action });
  };

  return (
    <div className="space-y-6">
      {/* Group Control Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Mass Tagall Broadcast Tool */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3 text-cyan-400">
              <Megaphone className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Mass TagAll Announcement</h3>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Mentions every participant in the group with your custom announcement banner.
            </p>
            <textarea
              rows={2}
              value={tagallMessage}
              onChange={(e) => setTagallMessage(e.target.value)}
              placeholder="Announcement text..."
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <button
            onClick={() => onExecuteCommand(`${config.prefix}tagall ${tagallMessage}`)}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <span>Execute .tagall in Simulator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidetag Invisible Mention */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3 text-emerald-400">
              <Users className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Hidetag Ghost Mention</h3>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Notifies all members invisibly without listing phone numbers in the message body.
            </p>
            <textarea
              rows={2}
              value={hidetagMessage}
              onChange={(e) => setHidetagMessage(e.target.value)}
              placeholder="Notice text..."
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <button
            onClick={() => onExecuteCommand(`${config.prefix}hidetag ${hidetagMessage}`)}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <span>Execute .hidetag</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Group Mute / Permissions */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3 text-amber-400">
              <Lock className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Group Chat Permissions</h3>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Mute group so only admins can send messages, or unmute to allow all members to chat.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => onExecuteCommand(`${config.prefix}group close`)}
                className="py-2.5 px-3 rounded-lg bg-slate-950 border border-rose-800/60 hover:bg-rose-950/40 text-rose-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Close (Mute)</span>
              </button>
              <button
                onClick={() => onExecuteCommand(`${config.prefix}group open`)}
                className="py-2.5 px-3 rounded-lg bg-slate-950 border border-emerald-800/60 hover:bg-emerald-950/40 text-emerald-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Open (Unmute)</span>
              </button>
            </div>
          </div>
          <button
            onClick={() => onExecuteCommand(`${config.prefix}link`)}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Get Group Invite Link (.link)</span>
          </button>
        </div>
      </div>

      {/* Anti-Link Group Protection Setting */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Anti-Link Guard (WhatsApp Invite Protection)</h3>
              <p className="text-xs text-slate-400">
                Automatically detects external group invite links (chat.whatsapp.com) posted by non-admin members.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleAntiLinkToggle(!config.antiLink)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                config.antiLink
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {config.antiLink ? 'Shield: ACTIVE' : 'Shield: DISABLED'}
            </button>
          </div>
        </div>

        {/* Action selector */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-slate-300 font-medium">Offense Penalty Action:</span>
          <div className="flex items-center gap-2">
            {(['delete', 'warn', 'kick'] as const).map((act) => (
              <button
                key={act}
                onClick={() => handleAntiLinkAction(act)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase transition-colors ${
                  config.antiLinkAction === act
                    ? 'bg-rose-900/50 text-rose-200 border border-rose-700 font-semibold'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {act}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Welcome & Goodbye Message Customizer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Participant Welcome & Goodbye Automation</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Available tags: <code className="text-emerald-400 font-mono">{'{user}'}</code> (mentions newcomer), <code className="text-emerald-400 font-mono">{'{group}'}</code> (group title), <code className="text-emerald-400 font-mono">{'{botName}'}</code>.
            </p>
          </div>
          <button
            onClick={handleSaveGreetings}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Templates</span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Welcome Template (New Member Joins):</label>
            <textarea
              rows={3}
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Goodbye Template (Member Leaves / Removed):</label>
            <textarea
              rows={3}
              value={goodbyeText}
              onChange={(e) => setGoodbyeText(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Preview of welcome */}
        <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
          <span className="text-[11px] font-mono text-slate-500 block mb-1">Live Render Preview:</span>
          <p className="text-slate-300 font-sans">
            {welcomeText.replace(/{user}/g, '@14155552671').replace(/{group}/g, 'Nexus MD Alpha Headquarters')}
          </p>
        </div>
      </div>
    </div>
  );
};
