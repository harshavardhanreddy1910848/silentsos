import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import {
  ArrowLeft,
  Camera,
  Video,
  Mic,
  Clock,
  BatteryCharging,
  Sliders,
  CheckCircle2,
  RefreshCw,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CaptureSettings() {
  const navigate = useNavigate();
  const { state, updateSettings } = useApp();

  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleUpdate = async (updates: any) => {
    await updateSettings(updates);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const resetTemplate = () => {
    const defaultTemplate =
      '🚨 EMERGENCY ALERT — SilentSOS\nFrom: {name}\nTime: {time}\nType: {type}\n\n📍 GPS Location: {gps_link}\n\n⚠️ Please respond immediately or call emergency services. Updates every 5 minutes until you acknowledge.';
    handleUpdate({ messageTemplate: defaultTemplate });
  };

  return (
    <div className="flex-1 w-full bg-[#07090e] text-slate-100 flex flex-col overflow-y-auto no-scrollbar pb-28 select-none">
      
      {/* ─── TOP HEADER ────────────────────────────────────────────────── */}
      <header className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Settings
        </button>

        <span className="text-xs font-mono text-cyan-400 font-semibold px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30">
          Hardware &amp; Media Buffers
        </span>
      </header>

      {/* ─── MAIN CONTENT ──────────────────────────────────────────────── */}
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 flex flex-col gap-6">
        
        {/* Title Area */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-7 h-7 text-cyan-400" />
            Capture &amp; Surveillance Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure automatic burst photography, rolling video recording buffers, noise-filtered audio, and telemetry transmission protocols.
          </p>
        </div>

        {/* Live Saved Notification */}
        <AnimatePresence>
          {savedFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-400 flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Capture parameters updated &amp; armed successfully!
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── CARD 1: PHOTO BURST CAPTURE ─────────────────────────────── */}
        <section className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              Photo Burst Protocol
            </h2>
            <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
              {state.settings.photoBurstCount} Frames Burst
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 font-medium mb-2">
              <span>Burst Count (Consecutive Frames)</span>
              <span className="text-slate-400 font-mono">{state.settings.photoBurstCount} Photos @ 60fps</span>
            </div>
            <input
              type="range"
              min="3"
              max="10"
              step="1"
              value={state.settings.photoBurstCount}
              onChange={(e) => handleUpdate({ photoBurstCount: parseInt(e.target.value) })}
              className="w-full accent-emerald-500 h-2 bg-slate-900 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5">
              <span>3 Shots (Fastest)</span>
              <span>5 Shots (Balanced)</span>
              <span>10 Shots (High Density)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Camera Facing Angle
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'front', label: 'Front (Selfie)' },
                { id: 'rear', label: 'Rear (Surround)' },
                { id: 'both', label: 'Both (Dual Angle)' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleUpdate({ cameraPreference: opt.id })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    state.settings.cameraPreference === opt.id
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-400'
                      : 'bg-[#07090e] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CARD 2: HD VIDEO LOOP ──────────────────────────────────── */}
        <section className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-400" />
              HD Video Loop &amp; Rolling Buffer
            </h2>
            <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30">
              {state.settings.videoDuration}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Recording Buffer Length
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '30s', label: '30 Seconds' },
                { id: '1min', label: '1 Minute' },
                { id: 'continuous', label: 'Continuous Live' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleUpdate({ videoDuration: opt.id })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    state.settings.videoDuration === opt.id
                      ? 'bg-blue-950/40 border-blue-500/60 text-blue-400'
                      : 'bg-[#07090e] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Battery advisory banner */}
          <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-start gap-2.5">
            <BatteryCharging className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong>Power Preservation Tripwire:</strong> When device battery drops below 20%, high frame rates automatically scale to 720p 24fps to conserve remaining battery for telemetry broadcasting.
            </p>
          </div>
        </section>

        {/* ─── CARD 3: AUDIO SURVEILLANCE & NOISE FILTER ───────────────── */}
        <section className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Mic className="w-4 h-4 text-cyan-400" />
              Surveillance Audio Fidelity
            </h2>
            <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 uppercase">
              {state.settings.audioQuality}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'high',
                title: 'High Definition (Opus)',
                desc: '128kbps stereo with acoustic noise cancellation.'
              },
              {
                id: 'low',
                title: 'Low Bandwidth (GSM)',
                desc: '32kbps mono optimized for weak 2G/3G cellular signals.'
              }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate({ audioQuality: opt.id })}
                className={`p-3.5 rounded-xl text-left border transition-all ${
                  state.settings.audioQuality === opt.id
                    ? 'bg-cyan-950/40 border-cyan-500/60'
                    : 'bg-[#07090e] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${state.settings.audioQuality === opt.id ? 'text-cyan-400' : 'text-slate-200'}`}>
                    {opt.title}
                  </span>
                  {state.settings.audioQuality === opt.id && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ─── CARD 4: REPEAT TRANSMISSION & RETENTION ─────────────────── */}
        <section className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            Automatic Telemetry Re-Broadcast Intervals
          </h2>

          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleUpdate({ autoRepeatInterval: mins })}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  state.settings.autoRepeatInterval === mins
                    ? 'bg-purple-950/40 border-purple-500/60 text-purple-400'
                    : 'bg-[#07090e] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Every {mins} Minutes
              </button>
            ))}
          </div>
        </section>

        {/* ─── CARD 5: EMERGENCY MESSAGE TEMPLATE ──────────────────────── */}
        <section className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              Automated Distress Message Template
            </h2>
            <button
              type="button"
              onClick={resetTemplate}
              className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Reset Default
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Available parameters: <code className="text-emerald-400 font-mono text-[11px]">{'{name}'}</code>, <code className="text-emerald-400 font-mono text-[11px]">{'{time}'}</code>, <code className="text-emerald-400 font-mono text-[11px]">{'{type}'}</code>, <code className="text-emerald-400 font-mono text-[11px]">{'{gps_link}'}</code>.
          </p>

          <textarea
            rows={5}
            value={state.settings.messageTemplate}
            onChange={(e) => handleUpdate({ messageTemplate: e.target.value })}
            className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl p-3.5 text-xs text-slate-200 font-mono leading-relaxed outline-none transition-colors resize-none"
          />
        </section>

        {/* ─── BOTTOM SUMMARY BAR ──────────────────────────────────────── */}
        <div className="p-4 bg-[#0a0d14] border border-slate-800/80 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <span className="text-xs text-slate-300 font-medium">
              All capture hardware changes synchronize instantaneously with device camera and mic tripwires.
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950/20 shrink-0"
          >
            Done
          </button>
        </div>

      </main>
    </div>
  );
}

export default CaptureSettings;
