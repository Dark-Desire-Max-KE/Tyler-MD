import React, { useState, useEffect } from 'react';
import { ConnectionStateInfo, SessionInfo } from '../types';
import {
  Smartphone,
  QrCode,
  KeyRound,
  Check,
  Copy,
  CheckCircle2,
  RefreshCw,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Database,
  Sparkles,
  Download,
  RotateCcw
} from 'lucide-react';

interface PairingPanelProps {
  status: ConnectionStateInfo;
  session: SessionInfo;
  onRequestPairingCode: (phone: string) => Promise<void>;
  onRefreshQR: () => void;
  onOpenAdminLogin: () => void;
  onResetPairing: () => Promise<void>;
  isLoading: boolean;
}

export const PairingPanel: React.FC<PairingPanelProps> = ({
  status,
  session,
  onRequestPairingCode,
  onRefreshQR,
  onOpenAdminLogin,
  onResetPairing,
  isLoading,
}) => {
  const [pairingMethod, setPairingMethod] = useState<'number' | 'qr'>('number');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSession, setCopiedSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState<number>(8);
  const [isResetting, setIsResetting] = useState(false);

  const [clientSessionId] = useState<string>(() => {
    let id = localStorage.getItem('tyler_client_session_id');
    if (!id) {
      id = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('tyler_client_session_id', id);
    }
    return id;
  });

  const [deviceSession, setDeviceSession] = useState<{
    sessionId: string;
    phoneNumber: string;
    pairingCode?: string;
    status: 'idle' | 'generating' | 'ready' | 'paired' | 'error';
    sessionCreds?: string;
    inbotSent?: boolean;
    userName?: string;
    errorMessage?: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll device-specific private session space every 2 seconds
  useEffect(() => {
    const pollDeviceSession = async () => {
      try {
        const res = await fetch(`/api/pair/session?clientSessionId=${clientSessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status) {
            setDeviceSession(data);
          }
        }
      } catch (e) {}
    };

    pollDeviceSession();
    const interval = setInterval(pollDeviceSession, 2000);
    return () => clearInterval(interval);
  }, [clientSessionId]);

  const isConnected = status.status === 'connected' || deviceSession?.status === 'paired';
  const pairedSession = deviceSession?.status === 'paired' ? {
    sessionId: deviceSession.sessionId,
    phoneNumber: deviceSession.phoneNumber,
    creds: deviceSession.sessionCreds || '',
    pairedAt: new Date().toISOString()
  } : status.lastPairedSession;

  // Auto-refresh countdown once paired
  useEffect(() => {
    let timer: any;
    if (isConnected || pairedSession) {
      setCountdown(8);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleResetForNextUser();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isConnected, pairedSession]);

  const handleResetForNextUser = async () => {
    setIsResetting(true);
    setPhoneNumber('');
    setErrorMsg('');
    try {
      await fetch('/api/pair/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSessionId })
      });
      await onResetPairing();
      setDeviceSession(null);
    } catch (e) {
      console.error('Failed to reset gateway:', e);
    } finally {
      setIsResetting(false);
    }
  };

  const handlePairingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber || cleanNumber.length < 9) {
      setErrorMsg('Please enter a valid international phone number with country code (e.g. 14155552671)');
      return;
    }
    setIsSubmitting(true);
    try {
      // First attempt private multi-tenant isolated pairing route
      const res = await fetch('/api/pair/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanNumber, clientSessionId })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setDeviceSession(data.session);
        }
      } else {
        // Fallback to standard request
        await onRequestPairingCode(cleanNumber);
      }
    } catch (err: any) {
      try {
        await onRequestPairingCode(cleanNumber);
      } catch (fallbackErr: any) {
        setErrorMsg(fallbackErr.message || err.message || 'Failed to request pairing code');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopySession = (sess: string) => {
    navigator.clipboard.writeText(sess);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 2000);
  };

  const handleDownloadSession = (sess: string) => {
    const blob = new Blob([sess], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tyler-md-session-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-2 pb-10">
      {/* Bot Brand & Identity */}
      <div className="text-center space-y-3">
        <div className="inline-block relative">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl overflow-hidden border-2 border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.3)] mx-auto relative group">
            <img
              src="/src/assets/images/tyler_md_avatar_1790893655486.jpg"
              alt="Tyler MD"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <span className="absolute -bottom-2 -right-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-purple-400 shadow-lg">
            🌸 v5.0
          </span>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <span>Tyler MD</span>
          </h1>
          <p className="text-xs sm:text-sm text-purple-300/80 font-mono mt-1">
            WhatsApp Multi-Device Direct API Gateway
          </p>

          {/* 1M+ Users Database Cluster Badge */}
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-500/40 text-[11px] font-mono text-purple-200 shadow-inner">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>High-Capacity Database Vault</span>
            <span className="text-slate-500">·</span>
            <span className="text-emerald-400 font-bold">1M+ Users Scaled</span>
          </div>
        </div>
      </div>

      {/* 🚀 Active Linked & Auto-Refresh Card */}
      {(isConnected || pairedSession) ? (
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900/95 to-purple-950/80 border border-emerald-500/50 rounded-2xl p-6 sm:p-7 shadow-[0_0_50px_rgba(16,185,129,0.2)] backdrop-blur-xl text-center space-y-4 animate-in zoom-in-95">
          <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/60 animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-extrabold text-white">🎉 WhatsApp Paired Successfully!</h3>
            <p className="text-xs text-emerald-300 font-mono mt-1">
              Linked User: +{deviceSession?.phoneNumber || status.phoneNumber || pairedSession?.phoneNumber || 'WhatsApp User'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Session securely saved in Cloud Database Vault.
            </p>
          </div>

          {/* 📩 Inbot Delivery Notice */}
          <div className="p-3.5 rounded-xl bg-purple-950/70 border border-purple-500/50 text-left flex items-start gap-2.5 text-xs text-purple-200 font-mono shadow-inner">
            <Sparkles className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-bold">Inbot Notification Delivered:</strong>
              <p className="text-[11px] text-purple-300 mt-0.5">
                Your unique <strong>Session ID</strong> and the official <strong>Tyler MD About card</strong> with Cyber Anime art were delivered directly to your WhatsApp inbot chat! ✨
              </p>
            </div>
          </div>

          {/* Generated Session ID */}
          {pairedSession?.creds && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-purple-500/40 text-left space-y-2 font-mono">
              <div className="flex items-center justify-between text-[11px] text-purple-300 font-bold">
                <span>PORTABLE SESSION ID:</span>
                <span className="text-[10px] text-slate-500">{pairedSession.sessionId}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/90 text-slate-300 text-xs truncate select-all border border-slate-800">
                {pairedSession.creds}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => handleCopySession(pairedSession.creds)}
                  className="px-3 py-1.5 rounded-lg bg-purple-900/70 hover:bg-purple-800 text-purple-200 border border-purple-600/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copiedSession ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSession ? 'Copied!' : 'Copy Session ID'}</span>
                </button>
                <button
                  onClick={() => handleDownloadSession(pairedSession.creds)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .txt</span>
                </button>
              </div>
            </div>
          )}

          {/* 🔄 Auto-Refresh Countdown & Ready for Another Request */}
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs font-mono text-purple-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-left">
              <RotateCcw className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>
                Refreshing in <strong className="text-white font-bold">{countdown}s</strong> for next user code request...
              </span>
            </div>

            <button
              onClick={handleResetForNextUser}
              disabled={isResetting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Pair Another Number Now</span>
            </button>
          </div>
        </div>
      ) : (
        /* Pairing Card */
        <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-6 sm:p-7 shadow-[0_0_50px_rgba(147,51,234,0.15)] backdrop-blur-xl space-y-5">
          {/* Method Selector Tabs: Phone Number vs QR Code */}
          <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setPairingMethod('number')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                pairingMethod === 'number'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Pairing Code</span>
            </button>
            <button
              onClick={() => setPairingMethod('qr')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                pairingMethod === 'qr'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR Code</span>
            </button>
          </div>

          {/* 1. Phone Number Pairing Code Form */}
          {pairingMethod === 'number' && (
            <div className="space-y-4">
              {/* Private Device Sandbox Badge */}
              <div className="flex items-center justify-between text-[11px] font-mono bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Safe & Private Device Sandbox</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Channel: {clientSessionId.slice(0, 12)}...
                </span>
              </div>

              <form onSubmit={handlePairingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-2">
                    Enter WhatsApp Phone Number (with Country Code):
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-400 font-mono text-sm font-bold">
                      +
                    </div>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="14155552671 (e.g. 1 for US, 44 for UK, 234 for Nigeria)"
                      className="w-full pl-8 pr-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="text-xs text-rose-400 flex items-center gap-2 bg-rose-950/40 p-3 rounded-xl border border-rose-900/60 font-mono">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || isSubmitting || deviceSession?.status === 'generating'}
                  className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-purple-950/60 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {(isLoading || isSubmitting || deviceSession?.status === 'generating') ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Requesting Private Code from WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Generate 8-Digit Pairing Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Display Generated Code */}
              {(deviceSession?.pairingCode || status.pairingCode) && (
                <div className="mt-4 p-5 rounded-xl bg-purple-950/50 border border-purple-500/50 text-center space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-purple-300 font-bold px-1">
                    <span>✨ Your Private WhatsApp Pairing Code</span>
                    <span className="text-emerald-400">● Device Isolated</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 py-1">
                    <span className="font-mono text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 tracking-[0.25em] select-all">
                      {deviceSession?.pairingCode || status.pairingCode}
                    </span>
                    <button
                      onClick={() => handleCopyCode((deviceSession?.pairingCode || status.pairingCode)!)}
                      className="p-2 rounded-lg bg-purple-900/70 hover:bg-purple-800 text-purple-200 border border-purple-500/40 transition-all"
                      title="Copy Code"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-left text-[11px] bg-slate-950/80 p-3 rounded-lg border border-purple-900/50 text-slate-300 font-mono space-y-1">
                    <p>1. Open WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device.</p>
                    <p>2. Tap "Link with phone number instead".</p>
                    <p>3. Enter the 8-digit code above.</p>
                    <p className="text-emerald-400 pt-1">
                      💡 Once confirmed, the bot will automatically push your Session ID and Tyler MD About card directly into your WhatsApp chat!
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Direct WhatsApp QR Code Tab */}
          {pairingMethod === 'qr' && (
            <div className="space-y-4 text-center">
              <p className="text-xs text-slate-300 font-mono">
                Scan this QR code with WhatsApp Camera on your mobile device
              </p>

              <div className="flex justify-center p-3">
                {status.qrCode ? (
                  <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-purple-500/40 inline-block animate-in zoom-in-95">
                    <img
                      src={status.qrCode}
                      alt="WhatsApp Direct API QR Code"
                      referrerPolicy="no-referrer"
                      className="w-52 h-52 sm:w-60 sm:h-60 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-52 h-52 sm:w-60 sm:h-60 bg-slate-900/80 rounded-2xl border-2 border-dashed border-purple-500/30 flex flex-col items-center justify-center p-4 text-slate-400">
                    <QrCode className="w-12 h-12 text-purple-400/60 mb-2 animate-pulse" />
                    <span className="text-xs font-mono">Ready to generate QR</span>
                    <button
                      onClick={onRefreshQR}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Start QR Socket</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-purple-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Generated directly from WhatsApp Baileys API</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
