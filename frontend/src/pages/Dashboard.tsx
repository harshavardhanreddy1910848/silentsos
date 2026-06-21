import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, API_BASE } from '../AppContext';
import { useGeolocation } from '../hooks/useGeolocation';
import {
  ShieldAlert, MapPin, Camera, Mic, Video, EyeOff,
  ExternalLink, CheckCircle2, X, Square, Circle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Live Capture Modal ──────────────────────────────────────────────────────
function CaptureModal({ mode, onClose }: { mode: 'photo' | 'video' | 'audio'; onClose: () => void }) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<BlobPart[]>([]);

  const [status,   setStatus]   = useState<'starting' | 'live' | 'recording' | 'captured' | 'error'>('starting');
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [errMsg,   setErrMsg]   = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start camera / mic on mount
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

        // Auto-start recording for audio/video
        if (mode === 'audio' || mode === 'video') {
          startRecording(s);
        }
      } catch (e: any) {
        setErrMsg(e.name === 'NotReadableError'
          ? 'Camera is busy — close other apps or the Gesture page, then retry.'
          : e.name === 'NotAllowedError'
          ? 'Permission denied — allow camera/mic in browser settings.'
          : e.message);
        setStatus('error');
      }
    };
    start();
    return () => stopAll();
  }, []);

  const startRecording = (s: MediaStream) => {
    const mimeType =
      mode === 'audio'
        ? (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm')
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');

    const rec = new MediaRecorder(s, { mimeType });
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    rec.start(500);
    recorderRef.current = rec;
    setStatus('recording');
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const stopAll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  // Take a photo snapshot
  const takePhoto = () => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = vid.videoWidth  || 640;
    canvas.height = vid.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPhotoSrc(dataUrl);
    setStatus('captured');
  };

  // Save photo to evidence
  const savePhoto = async () => {
    if (!photoSrc) return;
    const res = await fetch(photoSrc);
    const blob = await res.blob();
    const form = new FormData();
    form.append('photo', blob, `test_photo_${Date.now()}.jpg`);
    // Use a test alertId or create one
    const alertId = 'test_' + Date.now();
    await fetch(`${API_BASE}/alerts/${alertId}/evidence`, { method: 'POST', body: form });
    // Also trigger download
    const a = document.createElement('a');
    a.href = photoSrc;
    a.download = `photo_${Date.now()}.jpg`;
    a.click();
    stopAll();
    onClose();
  };

  // Stop recording and download
  const stopAndSave = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const rec = recorderRef.current;
    if (!rec) return;
    rec.onstop = () => {
      const mime = rec.mimeType || (mode === 'audio' ? 'audio/webm' : 'video/webm');
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext  = mode === 'audio' ? 'webm' : 'webm';
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${mode}_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      stopAll();
      onClose();
    };
    rec.stop();
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
    >
      {/* Close */}
      <button onClick={() => { stopAll(); onClose(); }}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
        <X className="w-5 h-5" />
      </button>

      <h2 className="text-white font-bold text-lg mb-4 uppercase tracking-widest">
        {mode === 'photo' ? '📸 Camera Capture' : mode === 'video' ? '🎥 Video Recording' : '🎤 Audio Recording'}
      </h2>

      {/* Error state */}
      {status === 'error' && (
        <div className="bg-emergency/20 border border-emergency/40 rounded-xl p-4 max-w-sm text-center">
          <p className="text-emergency font-bold text-sm mb-2">⚠️ Cannot open camera</p>
          <p className="text-white/70 text-xs">{errMsg}</p>
          <button onClick={() => { stopAll(); onClose(); }}
            className="mt-3 px-4 py-2 bg-emergency text-white text-xs font-bold rounded-lg">
            Close
          </button>
        </div>
      )}

      {/* Camera / Video preview */}
      {mode !== 'audio' && status !== 'error' && (
        <div className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video mb-4">
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-safe border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
          {/* Captured photo overlay */}
          {photoSrc && (
            <img src={photoSrc} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* Recording indicator */}
          {status === 'recording' && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full">
              <span className="w-2 h-2 bg-emergency rounded-full animate-pulse" />
              <span className="text-white text-xs font-mono font-bold">{fmt(duration)}</span>
            </div>
          )}
        </div>
      )}

      {/* Audio visualizer */}
      {mode === 'audio' && status !== 'error' && (
        <div className="w-full max-w-lg rounded-2xl bg-surface border border-surfaceHighlight p-8 mb-4 flex flex-col items-center gap-4">
          {status === 'starting' && <div className="w-8 h-8 border-2 border-safe border-t-transparent rounded-full animate-spin" />}
          {status === 'recording' && (
            <>
              <div className="flex items-end gap-1 h-16">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-safe rounded-full"
                    animate={{ height: [8, Math.random() * 48 + 8, 8] }}
                    transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-emergency font-mono font-bold">
                <span className="w-2 h-2 bg-emergency rounded-full animate-pulse" />
                Recording — {fmt(duration)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      {status !== 'error' && (
        <div className="flex gap-3">
          {/* Photo: take snapshot */}
          {mode === 'photo' && status === 'live' && (
            <button onClick={takePhoto}
              className="px-6 py-3 bg-safe text-black font-extrabold text-sm rounded-xl flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-safe/20">
              <Circle className="w-4 h-4" /> Take Photo
            </button>
          )}
          {mode === 'photo' && status === 'captured' && (
            <button onClick={savePhoto}
              className="px-6 py-3 bg-safe text-black font-extrabold text-sm rounded-xl flex items-center gap-2 hover:opacity-90 transition-all">
              <CheckCircle2 className="w-4 h-4" /> Save & Download
            </button>
          )}

          {/* Video / Audio: stop and save */}
          {(mode === 'video' || mode === 'audio') && status === 'recording' && (
            <button onClick={stopAndSave}
              className="px-6 py-3 bg-emergency text-white font-extrabold text-sm rounded-xl flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-emergency/20">
              <Square className="w-4 h-4" /> Stop & Download
            </button>
          )}

          <button onClick={() => { stopAll(); onClose(); }}
            className="px-5 py-3 bg-surface border border-surfaceHighlight text-white font-bold text-sm rounded-xl hover:bg-surfaceHighlight transition-all">
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export function Dashboard() {
  const { state, triggerAlert, updateSettings } = useApp();
  const navigate = useNavigate();
  const location = useGeolocation();

  const [captureMode, setCaptureMode] = useState<'photo' | 'video' | 'audio' | null>(null);

  const handleSOS = async (type: string = 'General') => {
    try {
      await triggerAlert(type);
      navigate('/alert');
    } catch (e) {
      console.warn('SOS trigger canceled/aborted:', e);
    }
  };

  const openCapture = (mode: 'photo' | 'video' | 'audio') => {
    setCaptureMode(mode);
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-y-auto no-scrollbar pb-24">



      {/* Live Capture Modal */}
      <AnimatePresence>
        {captureMode && (
          <CaptureModal mode={captureMode} onClose={() => setCaptureMode(null)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <ShieldAlert className="w-6 h-6 text-safe mr-2" />
          <span className="font-bold text-safe">System Armed</span>
        </div>
        <button
          onClick={() => updateSettings({ stealthMode: !state.settings.stealthMode })}
          className={`p-2 rounded-full transition-colors ${state.settings.stealthMode ? 'bg-emergency/20 text-emergency' : 'bg-surface text-textMuted'}`}>
          <EyeOff className="w-5 h-5" />
        </button>
      </div>

      {/* SOS Button */}
      <div className="flex-1 flex flex-col items-center justify-center py-10">
        <motion.button
          onClick={() => handleSOS('Emergency')}
          className="relative w-64 h-64 rounded-full bg-emergency flex flex-col items-center justify-center shadow-[0_0_50px_rgba(255,23,68,0.3)] z-10"
          whileTap={{ scale: 0.95 }}
          animate={{ boxShadow: ['0 0 0 0 rgba(255,23,68,0.4)', '0 0 0 40px rgba(255,23,68,0)'] }}
          transition={{ duration: 2, repeat: Infinity }}>
          <span className="text-6xl font-black text-white tracking-widest mb-2">SOS</span>
          <span className="text-white/80 font-medium uppercase tracking-widest text-sm">Tap to Alert</span>
        </motion.button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { icon: '🏥', label: 'Medical', type: 'Medical' },
          { icon: '🔥', label: 'Fire',    type: 'Fire'    },
          { icon: '🚔', label: 'Police',  type: 'Police'  },
          { icon: '⚠️', label: 'Danger',  type: 'Danger'  },
        ].map((action) => (
          <button key={action.label} onClick={() => handleSOS(action.type)}
            className="bg-surface border border-surfaceHighlight rounded-xl p-3 flex flex-col items-center justify-center hover:bg-surfaceHighlight transition-colors">
            <span className="text-2xl mb-1">{action.icon}</span>
            <span className="text-[10px] font-bold text-textMuted uppercase">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Status Cards */}
      <div className="space-y-3">

        {/* GPS */}
        <div className="bg-surface rounded-xl p-4 border border-surfaceHighlight flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative mr-4">
              <MapPin className="w-5 h-5 text-safe" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-safe rounded-full animate-ping-slow" />
            </div>
            <div>
              <p className="text-sm font-bold">Live GPS Active</p>
              <p className="text-xs text-textMuted font-mono">
                {location.lat !== null && location.lng !== null
                  ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : location.error || 'Acquiring GPS signal...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {location.lat !== null && location.lng !== null && (
              <a href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1.5 bg-safe/10 hover:bg-safe/20 border border-safe/20 rounded-lg transition-all">
                <ExternalLink className="w-3.5 h-3.5 text-safe" />
              </a>
            )}
          </div>
        </div>

        {/* AUTO-CAPTURE — Tap to open live camera/mic */}
        <div className="bg-surface rounded-xl p-4 border border-surfaceHighlight">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-textMuted uppercase tracking-wider">Auto-Capture Armed</p>
            <button onClick={() => navigate('/gesture')}
              className="text-[9px] font-bold text-safe bg-safe/10 border border-safe/20 px-2 py-1 rounded-lg hover:bg-safe/20 transition-all">
              Test Gesture →
            </button>
          </div>

          <p className="text-[10px] text-textMuted text-center mb-3">
            Tap a button below to open live capture
          </p>

          <div className="flex justify-around">

            {/* Photos */}
            <motion.button
              onClick={() => openCapture('photo')}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-2 group"
              title="Open camera & take photo"
            >
              <div className="w-16 h-16 rounded-full bg-safe/15 border-2 border-safe text-safe flex items-center justify-center group-hover:bg-safe/30 group-hover:scale-105 transition-all shadow-lg shadow-safe/10">
                <Camera className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-semibold text-white">Photos</span>
              <span className="text-[9px] text-safe font-bold">Tap to Open</span>
            </motion.button>

            {/* Video */}
            <motion.button
              onClick={() => openCapture('video')}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-2 group"
              title="Open camera & record video"
            >
              <div className="w-16 h-16 rounded-full bg-purple-500/15 border-2 border-purple-500 text-purple-400 flex items-center justify-center group-hover:bg-purple-500/30 group-hover:scale-105 transition-all shadow-lg shadow-purple-500/10">
                <Video className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-semibold text-white">Video</span>
              <span className="text-[9px] text-purple-400 font-bold">Tap to Record</span>
            </motion.button>

            {/* Audio */}
            <motion.button
              onClick={() => openCapture('audio')}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-2 group"
              title="Open mic & record audio"
            >
              <div className="w-16 h-16 rounded-full bg-sky-500/15 border-2 border-sky-500 text-sky-400 flex items-center justify-center group-hover:bg-sky-500/30 group-hover:scale-105 transition-all shadow-lg shadow-sky-500/10">
                <Mic className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-semibold text-white">Audio</span>
              <span className="text-[9px] text-sky-400 font-bold">Tap to Record</span>
            </motion.button>

          </div>

          {/* All-in-one capture hint */}
          <div className="mt-4 bg-surfaceHighlight rounded-xl p-3 flex items-center gap-2 border border-white/5">
            <ShieldAlert className="w-4 h-4 text-emergency shrink-0" />
            <p className="text-[10px] text-textMuted">
              Triggering <span className="text-white font-bold">SOS</span> automatically captures photos, video &amp; audio from your camera and saves to Evidence Vault.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}