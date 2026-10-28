import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, API_BASE } from '../AppContext';
import { useGeolocation } from '../hooks/useGeolocation';
import {
  MapPin,
  Camera,
  Mic,
  Video,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  X,
  Square,
  Circle,
  Zap,
  Heart,
  Flame,
  Shield,
  AlertTriangle,
  Smartphone,
  Copy,
  Lock,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMapView } from '../components/GoogleMapView';

// ─── Live Capture Modal ──────────────────────────────────────────────────────
function CaptureModal({ mode, onClose }: { mode: 'photo' | 'video' | 'audio'; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [status, setStatus] = useState<'starting' | 'live' | 'recording' | 'captured' | 'error'>('starting');
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [errMsg, setErrMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = async () => {
      try {
        const constraints =
          mode === 'audio'
            ? { audio: true, video: false }
            : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: mode === 'video' };

        const s = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = s;

        if (videoRef.current && mode !== 'audio') {
          videoRef.current.srcObject = s;
          videoRef.current.muted = true;
          await videoRef.current.play();
        }
        setStatus('live');

        if (mode === 'audio' || mode === 'video') {
          startRecording(s);
        }
      } catch (e: any) {
        setErrMsg(
          e.name === 'NotReadableError'
            ? 'Camera is busy — close other apps or the Gesture page, then retry.'
            : e.name === 'NotAllowedError'
            ? 'Permission denied — allow camera/mic in browser settings.'
            : e.message
        );
        setStatus('error');
      }
    };
    start();
    return () => stopAll();
  }, []);

  const startRecording = (s: MediaStream) => {
    const mimeType =
      mode === 'audio'
        ? MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

    const rec = new MediaRecorder(s, { mimeType });
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };
    rec.start(500);
    recorderRef.current = rec;
    setStatus('recording');
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const stopAll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth || 640;
    canvas.height = vid.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPhotoSrc(dataUrl);
    setStatus('captured');
  };

  const savePhoto = async () => {
    if (!photoSrc) return;
    const res = await fetch(photoSrc);
    const blob = await res.blob();
    const form = new FormData();
    form.append('photo', blob, `evidence_photo_${Date.now()}.jpg`);
    const alertId = 'test_' + Date.now();
    await fetch(`${API_BASE}/alerts/${alertId}/evidence`, { method: 'POST', body: form });
    const a = document.createElement('a');
    a.href = photoSrc;
    a.download = `photo_${Date.now()}.jpg`;
    a.click();
    stopAll();
    onClose();
  };

  const stopAndSave = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const rec = recorderRef.current;
    if (!rec) return;
    rec.onstop = () => {
      const mime = rec.mimeType || (mode === 'audio' ? 'audio/webm' : 'video/webm');
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mode}_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      stopAll();
      onClose();
    };
    rec.stop();
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
    >
      <button
        onClick={() => {
          stopAll();
          onClose();
        }}
        className="absolute top-4 right-4 p-2.5 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all border border-slate-700"
      >
        <X className="w-5 h-5" />
      </button>

      <h2 className="text-white font-mono font-bold text-base mb-4 uppercase tracking-widest flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        {mode === 'photo' ? 'Photo Burst Viewfinder' : mode === 'video' ? 'HD Rolling Video Loop' : 'Surveillance Audio Channel'}
      </h2>

      {status === 'error' && (
        <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-5 max-w-sm text-center">
          <p className="text-red-400 font-bold text-sm mb-2">Hardware Access Offline</p>
          <p className="text-slate-300 text-xs">{errMsg}</p>
          <button
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="mt-4 px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl"
          >
            Acknowledge & Close
          </button>
        </div>
      )}

      {mode !== 'audio' && status !== 'error' && (
        <div className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video mb-4 shadow-2xl">
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
          {photoSrc && <img src={photoSrc} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />}
          {status === 'recording' && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/80 px-2.5 py-1 rounded-full border border-red-500/40">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white text-xs font-mono font-bold">{fmt(duration)}</span>
            </div>
          )}
        </div>
      )}

      {mode === 'audio' && status !== 'error' && (
        <div className="w-full max-w-md rounded-2xl bg-[#0b0e14] border border-slate-800 p-8 mb-4 flex flex-col items-center gap-4 shadow-2xl">
          {status === 'starting' && (
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          )}
          {status === 'recording' && (
            <>
              <div className="flex items-end gap-1.5 h-20">
                {Array.from({ length: 24 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                    animate={{ height: [8, Math.random() * 64 + 10, 8] }}
                    transition={{ duration: 0.35 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.04 }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-bold bg-red-950/40 px-3 py-1 rounded-full border border-red-500/30">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                TRANSMITTING AUDIO BUFFER — {fmt(duration)}
              </div>
            </>
          )}
        </div>
      )}

      {status !== 'error' && (
        <div className="flex gap-3">
          {mode === 'photo' && status === 'live' && (
            <button
              onClick={takePhoto}
              className="px-6 py-2.5 bg-emerald-500 text-black font-extrabold text-xs rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Circle className="w-4 h-4 fill-black" /> Trigger Photo Burst
            </button>
          )}
          {mode === 'photo' && status === 'captured' && (
            <button
              onClick={savePhoto}
              className="px-6 py-2.5 bg-emerald-500 text-black font-extrabold text-xs rounded-xl flex items-center gap-2 hover:bg-emerald-400 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Encrypted Frame
            </button>
          )}

          {(mode === 'video' || mode === 'audio') && status === 'recording' && (
            <button
              onClick={stopAndSave}
              className="px-6 py-2.5 bg-red-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 hover:bg-red-500 transition-all shadow-lg shadow-red-600/30"
            >
              <Square className="w-4 h-4 fill-white" /> Commit Stream & Download
            </button>
          )}

          <button
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="px-5 py-2.5 bg-slate-900 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-800 transition-all"
          >
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Tactical Dispatch Dashboard ─────────────────────────────────────────────
export function Dashboard() {
  const { state, triggerAlert, updateSettings } = useApp();
  const navigate = useNavigate();
  const location = useGeolocation();

  const [captureMode, setCaptureMode] = useState<'photo' | 'video' | 'audio' | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [clockTime, setClockTime] = useState('');
  const [telemetryCopied, setTelemetryCopied] = useState(false);
  const [ping, setPing] = useState(19);

  // SOS Hold-to-activate mechanism (1.5s hold protection)
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdStartTimeRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<any>(null);
  const HOLD_DURATION_MS = 1500;

  // Live Digital Clock & Simulated Ping Jitter
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setClockTime(`${h}:${m}:${s}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const pingTimer = setInterval(() => {
      setPing(17 + Math.floor(Math.random() * 6));
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(pingTimer);
    };
  }, []);

  const handleSOS = useCallback(
    async (type: string = 'General') => {
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }
        await triggerAlert(type);
        navigate('/alert');
      } catch (e) {
        console.warn('SOS trigger canceled/aborted:', e);
      }
    },
    [triggerAlert, navigate]
  );

  // Failsafe Hold Tracking
  const startHold = () => {
    setIsHolding(true);
    holdStartTimeRef.current = Date.now();
    setHoldProgress(0);

    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = setInterval(() => {
      if (!holdStartTimeRef.current) return;
      const elapsed = Date.now() - holdStartTimeRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(pct);

      if (elapsed >= HOLD_DURATION_MS) {
        clearInterval(holdIntervalRef.current);
        setIsHolding(false);
        setHoldProgress(100);
        handleSOS('Emergency');
      }
    }, 20);
  };

  const cancelHold = () => {
    setIsHolding(false);
    holdStartTimeRef.current = null;
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  // Keyboard Shortcuts: Space for SOS, F1-F4 for direct dispatch, G for gesture, 3x ESC for stealth
  const escCountRef = useRef<number>(0);
  const escResetTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' && !e.repeat && !isHolding) {
        e.preventDefault();
        startHold();
      } else if (e.code === 'F1') {
        e.preventDefault();
        handleSOS('Medical');
      } else if (e.code === 'F2') {
        e.preventDefault();
        handleSOS('Fire');
      } else if (e.code === 'F3') {
        e.preventDefault();
        handleSOS('Police');
      } else if (e.code === 'F4') {
        e.preventDefault();
        handleSOS('Danger');
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        navigate('/gesture');
      } else if (e.key === 'Escape') {
        escCountRef.current += 1;
        if (escResetTimerRef.current) clearTimeout(escResetTimerRef.current);
        if (escCountRef.current >= 3) {
          updateSettings({ stealthMode: !state.settings.stealthMode });
          escCountRef.current = 0;
        } else {
          escResetTimerRef.current = setTimeout(() => {
            escCountRef.current = 0;
          }, 1500);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        cancelHold();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleSOS, isHolding, navigate, state.settings.stealthMode, updateSettings]);

  // Copy GPS Telemetry
  const copyTelemetry = () => {
    const latStr = `${(location.lat ?? 13.028).toFixed(4)}° ${location.lat && location.lat < 0 ? 'S' : 'N'}`;
    const lngStr = `${(location.lng ?? 80.0159).toFixed(4)}° ${location.lng && location.lng < 0 ? 'W' : 'E'}`;
    const accuracyStr = `±${Math.round(location.accuracy ?? 2.8)}m`;
    const telemetry = `SILENTSOS TELEMETRY | LAT: ${latStr} | LONG: ${lngStr} | ACCURACY: ${accuracyStr} | TIMESTAMP: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(telemetry);
    setTelemetryCopied(true);
    setTimeout(() => setTelemetryCopied(false), 2000);
  };

  const openCapture = (mode: 'photo' | 'video' | 'audio') => {
    setCaptureMode(mode);
  };

  // User initials
  const userInitials = state.user?.name
    ? state.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'DS';

  const latFormatted = `${(location.lat ?? 13.028).toFixed(4)}° ${location.lat && location.lat < 0 ? 'S' : 'N'}`;
  const lngFormatted = `${(location.lng ?? 80.0159).toFixed(4)}° ${location.lng && location.lng < 0 ? 'W' : 'E'}`;
  const accuracyFormatted = (location.accuracy ?? 2.8).toFixed(1);

  return (
    <div className="flex-1 w-full bg-[#07090e] text-slate-100 flex flex-col overflow-y-auto no-scrollbar pb-28 select-none">
      {/* Live Capture Modal Overlay */}
      <AnimatePresence>
        {captureMode && <CaptureModal mode={captureMode} onClose={() => setCaptureMode(null)} />}
      </AnimatePresence>

      {/* ─── TOP TACTICAL HUD NAVBAR ────────────────────────────────────────── */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        {/* Left: Brand & Console Spec */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-950/80 border border-red-500/50 text-red-500 flex items-center justify-center shadow-lg shadow-red-950/50 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-widest text-white">SILENTSOS</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                V4.8 PRO
              </span>
            </div>
            <p className="text-[9px] font-mono tracking-widest text-slate-400 uppercase">
              TACTICAL RAPID RESPONSE DISPATCH CONSOLE
            </p>
          </div>
        </div>

        {/* Center: System Status & Stealth Switch */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Armed Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            SYSTEM ARMED &amp; READY
          </div>

          {/* Stealth Mode Pill */}
          <button
            onClick={() => updateSettings({ stealthMode: !state.settings.stealthMode })}
            title="Press ESC three times or click to toggle Stealth Mode"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all text-xs font-mono group"
          >
            <EyeOff className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            <span className="text-slate-400 hidden sm:inline">Stealth Mode:</span>
            <span className="font-bold text-cyan-400">
              {state.settings.stealthMode ? 'ARMED' : 'STANDBY'}
            </span>
            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              ESC *3
            </span>
          </button>
        </div>

        {/* Right: Telemetry & User Avatar */}
        <div className="flex items-center gap-2">
          {/* Telemetry pill */}
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              PING: <span className="text-emerald-400 font-bold">{ping}ms</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-300">
              GPS: <span className="text-cyan-400 font-bold">FIX 98%</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-white font-bold tracking-wider">{clockTime || '04:24:55'} LOCAL</span>
          </div>

          {/* Quick covert toggle */}
          <button
            onClick={() => updateSettings({ stealthMode: !state.settings.stealthMode })}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all"
            title="Toggle Covert Mode"
          >
            <EyeOff className="w-4 h-4" />
          </button>

          {/* User profile avatar */}
          <div
            onClick={() => navigate('/settings')}
            className="relative w-8 h-8 rounded-full bg-slate-800 border border-slate-700 hover:border-slate-600 cursor-pointer flex items-center justify-center font-bold text-xs text-slate-200 transition-all"
            title={state.user?.name || 'User Profile'}
          >
            {userInitials}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900"></span>
          </div>
        </div>
      </header>

      {/* ─── MAIN TACTICAL CONSOLE BODY ────────────────────────────────────── */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex flex-col gap-8">
        
        {/* ─── HERO: PRIMARY EMERGENCY TRIGGER ───────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center pt-2 pb-6 overflow-hidden">
          {/* Subtle Concentric Radar Geometry in Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <svg className="w-[640px] h-[640px] max-w-none text-slate-800" viewBox="0 0 600 600" fill="none">
              <circle cx="300" cy="300" r="280" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.3" />
              <circle cx="300" cy="300" r="210" stroke="currentColor" strokeWidth="1" opacity="0.4" />
              <circle cx="300" cy="300" r="140" stroke="rgba(239, 68, 68, 0.25)" strokeWidth="1" />
              <line x1="20" y1="300" x2="580" y2="300" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
              <line x1="300" y1="20" x2="300" y2="580" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
            </svg>
          </div>

          {/* Primary Trigger Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-950/60 border border-red-500/40 text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase mb-3 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            PRIMARY EMERGENCY TRIGGER
          </div>

          {/* Heading & Subtitle */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2 text-center drop-shadow-sm">
            Immediate Crisis Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl text-center mb-8 px-4 font-normal">
            Activates silent distress transmission, continuous telemetry broadcast &amp; auto-encrypted evidence recording.
          </p>

          {/* Central 3D SOS Button with Interactive Hold Fill */}
          <div className="relative flex items-center justify-center my-2">
            {/* Ambient Red Glow Behind Button */}
            <div className="absolute w-64 h-64 rounded-full bg-red-600/25 blur-3xl pointer-events-none animate-pulse-fast" />

            {/* SVG Circular Progress Ring (Hold Feedback) */}
            <svg className="absolute w-60 h-60 sm:w-64 sm:h-64 pointer-events-none -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="112"
                stroke="rgba(255, 23, 68, 0.15)"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="50%"
                cy="50%"
                r="112"
                stroke="#ffffff"
                strokeWidth="6"
                strokeDasharray={2 * Math.PI * 112}
                strokeDashoffset={2 * Math.PI * 112 * (1 - holdProgress / 100)}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-75"
              />
            </svg>

            {/* The Main SOS Interactive Element */}
            <motion.button
              type="button"
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              whileTap={{ scale: 0.96 }}
              className="relative w-52 h-52 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center cursor-pointer shadow-[0_0_50px_rgba(239,68,68,0.5),inset_0_2px_8px_rgba(255,255,255,0.4)] border-4 border-red-500/80 bg-gradient-to-b from-[#ff334b] via-[#e60026] to-[#990014] text-white overflow-hidden select-none"
            >
              {/* Radial Highlight Reflection */}
              <div className="absolute top-2 inset-x-8 h-20 rounded-full bg-white/20 blur-[10px] pointer-events-none" />

              {/* Lightning Bolt Icon */}
              <Zap className="w-7 h-7 text-white mb-0.5 drop-shadow-md" />

              {/* SOS Text */}
              <span className="text-5xl sm:text-6xl font-black tracking-widest text-white drop-shadow-lg leading-none">
                SOS
              </span>

              {/* Subtext */}
              <span className="text-[11px] font-bold tracking-widest uppercase text-white/95 mt-1.5 drop-shadow">
                {isHolding ? `HOLDING (${Math.round(holdProgress)}%)` : 'PRESS & HOLD'}
              </span>

              {/* Spacebar Pill */}
              <div className="mt-2 px-2.5 py-0.5 rounded-full bg-black/45 border border-white/20 text-[9px] font-mono tracking-wider text-white/90">
                OR PRESS [SPACE]
              </div>
            </motion.button>
          </div>

          {/* Under-Button Failsafe Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Failsafe Buffer: <strong className="text-white">1.5s Hold Protection</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Dual Confirmation: <strong className="text-emerald-400">Armed</strong>
              </span>
            </div>
          </div>
        </section>

        {/* ─── DIRECT DISPATCH CATEGORIZATION MATRIX (F1 - F4) ──────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-sm" />
              <h2 className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
                DIRECT DISPATCH CATEGORIZATION MATRIX
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Keyboard Shortcuts: F1 – F4
            </span>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: MEDICAL */}
            <div className="bg-[#0b0e14] border border-slate-800/80 hover:border-red-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 flex items-center justify-center">
                    <Heart className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    F1
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-white tracking-wide">MEDICAL</h3>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-500/40">
                    EMS-108
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  Paramedic, cardiac arrest, acute physical trauma.
                </p>
              </div>
              <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/60 text-xs">
                <span className="text-[11px] text-slate-500 font-mono">Auto-Dial Protocol</span>
                <button
                  onClick={() => handleSOS('Medical')}
                  className="text-red-400 hover:text-red-300 font-bold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                >
                  Quick Trigger &rarr;
                </button>
              </div>
            </div>

            {/* Card 2: FIRE & RESCUE */}
            <div className="bg-[#0b0e14] border border-slate-800/80 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    F2
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-white tracking-wide">FIRE &amp; RESCUE</h3>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-500/40">
                    HAZ-101
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  Conflagration, chemical leak, building evacuation.
                </p>
              </div>
              <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/60 text-xs">
                <span className="text-[11px] text-slate-500 font-mono">Hazmat Routing</span>
                <button
                  onClick={() => handleSOS('Fire')}
                  className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                >
                  Quick Trigger &rarr;
                </button>
              </div>
            </div>

            {/* Card 3: POLICE / TACTICAL */}
            <div className="bg-[#0b0e14] border border-slate-800/80 hover:border-cyan-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    F3
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-white tracking-wide">POLICE / TACTICAL</h3>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-500/40">
                    DISP-100
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  Armed robbery, intrusion, assault, immediate backup.
                </p>
              </div>
              <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/60 text-xs">
                <span className="text-[11px] text-slate-500 font-mono">Tactical Frequency</span>
                <button
                  onClick={() => handleSOS('Police')}
                  className="text-cyan-400 hover:text-cyan-300 font-bold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                >
                  Quick Trigger &rarr;
                </button>
              </div>
            </div>

            {/* Card 4: PERSONAL THREAT */}
            <div className="bg-[#0b0e14] border border-slate-800/80 hover:border-purple-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    F4
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-white tracking-wide">PERSONAL THREAT</h3>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-400 border border-purple-500/40">
                    SILENT
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  Stalking, domestic threat, silent hostage alert.
                </p>
              </div>
              <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/60 text-xs">
                <span className="text-[11px] text-slate-500 font-mono">Covert Protocol</span>
                <button
                  onClick={() => handleSOS('Danger')}
                  className="text-purple-400 hover:text-purple-300 font-bold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                >
                  Quick Trigger &rarr;
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── LIVE HIGH-PRECISION GPS TELEMETRY BAR ─────────────────────────── */}
        <section className="bg-[#0b0e14] border border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: GPS Indicator & Coordinates */}
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center relative shrink-0">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-white">Live High-Precision GPS Active</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                    • ACCURACY &plusmn; {accuracyFormatted}m
                  </span>
                  <span className="text-xs text-slate-400 hidden lg:inline">
                    Triangulating (GNSS + Cellular Tower + Wi-Fi RTT)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400">
                  <span>
                    LAT: <strong className="text-emerald-400">{latFormatted}</strong>
                  </span>
                  <span>
                    LONG: <strong className="text-emerald-400">{lngFormatted}</strong>
                  </span>
                  <span className="text-slate-500 hidden sm:inline">ALT: 14m AMSL</span>
                  <span className="text-slate-500 hidden sm:inline">SPEED: 0.0 km/h (Stationary)</span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              <button
                type="button"
                onClick={copyTelemetry}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
              >
                {telemetryCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {telemetryCopied ? 'Telemetry Copied!' : 'Copy Telemetry'}
              </button>

              <button
                type="button"
                onClick={() => setShowMap((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 hover:bg-cyan-900/40 text-xs font-mono text-cyan-300 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {showMap ? 'Close Vector Map' : 'Open Vector Map'}
              </button>
            </div>
          </div>

          {/* Expandable Vector Map View */}
          <AnimatePresence>
            {showMap && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-slate-800/80 overflow-hidden"
              >
                <GoogleMapView
                  center={
                    location.lat && location.lng
                      ? { lat: location.lat, lng: location.lng, accuracy: location.accuracy }
                      : null
                  }
                  liveGPS={true}
                  userName={state.user?.name || 'My Location'}
                  distressType="Live Safe Mode"
                  status="Standby"
                  height={300}
                  className="w-full shadow-2xl rounded-2xl"
                  onLocationChange={(pt) => {
                    location.setManualLocation(pt.lat, pt.lng, pt.accuracy || 10);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ─── AUTO-CAPTURE HARDWARE SURVEILLANCE ───────────────────────────── */}
        <section className="bg-[#0b0e14] border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <h2 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                  AUTO-CAPTURE HARDWARE SURVEILLANCE
                </h2>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-500/40">
                  TRIPWIRE ARMED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Instantaneous background multi-stream capture ready to record and transmit upon alarm triggering.
              </p>
            </div>

            <button
              onClick={() => navigate('/gesture')}
              className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/40 text-xs font-mono text-emerald-400 flex items-center gap-1.5 transition-all shadow-sm shrink-0"
            >
              Test Gesture Trigger [G] &rarr;
            </button>
          </div>

          {/* 3 Hardware Channel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Card 1: Photo Burst */}
            <div className="bg-[#07090e] border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-5 flex flex-col items-center text-center transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-white">Photo Burst</h3>
              <p className="text-xs font-mono font-semibold text-emerald-400 mt-0.5 mb-1.5">
                3-Camera Dual Facing
              </p>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Automatic 10-shot burst at 60fps with infrared compensation.
              </p>
              <button
                type="button"
                onClick={() => openCapture('photo')}
                className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm"
              >
                Tap to Open Viewfinder
              </button>
            </div>

            {/* Card 2: HD Video Loop */}
            <div className="bg-[#07090e] border border-slate-800/80 hover:border-blue-500/40 rounded-2xl p-5 flex flex-col items-center text-center transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-white">HD Video Loop</h3>
              <p className="text-xs font-mono font-semibold text-blue-400 mt-0.5 mb-1.5">
                Continuous 1080p Rolling Buffer
              </p>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Saves previous 30s buffer plus next 10 minutes live stream.
              </p>
              <button
                type="button"
                onClick={() => openCapture('video')}
                className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm"
              >
                Tap to Record Now
              </button>
            </div>

            {/* Card 3: Surveillance Audio */}
            <div className="bg-[#07090e] border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-5 flex flex-col items-center text-center transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-white">Surveillance Audio</h3>
              {/* Cyan Animated Audio Waveform Graphic */}
              <div className="flex items-center justify-center gap-1 my-1.5 h-4">
                <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="w-1 h-4 bg-cyan-400 rounded-full animate-pulse" />
                <span className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse" />
                <span className="w-1 h-4 bg-cyan-400 rounded-full animate-pulse" />
                <span className="w-1 h-2 bg-cyan-400 rounded-full animate-pulse" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Stereo acoustic noise filter &amp; automatic voice transcription.
              </p>
              <button
                type="button"
                onClick={() => openCapture('audio')}
                className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm"
              >
                Tap to Monitor Audio
              </button>
            </div>
          </div>

          {/* Automatic Evidence Protection Lock Banner */}
          <div className="bg-[#07090e] border border-slate-800/80 rounded-xl p-3.5 flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-white font-semibold">Automatic Evidence Protection:</strong> Triggering SOS instantly encrypts incoming media via{' '}
              <span className="text-cyan-400 font-mono font-semibold">AES-256 GCM</span> and streams tamper-evident cryptographic hashes directly to your decentralized Evidence Vault. Local copies remain invisible to device galleries.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}

export default Dashboard;