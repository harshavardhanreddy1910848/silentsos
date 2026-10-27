import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HandIcon, EyeIcon, UsersIcon, SmileIcon, PlayIcon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';
import { Screen } from '../components/ui/Screen';
import { SimCameraFeed, CameraFeedRef } from '../components/SimCameraFeed';
import { useApp } from '../context/AppContext';
import { Toggle } from '../components/ui/Toggle';

const GESTURES = [
  { id: 'palm', Icon: HandIcon, name: 'Raised palm / wave', desc: 'Hold your open palm to the camera' },
  { id: 'blink', Icon: EyeIcon, name: 'Blink pattern', desc: 'Blink rapidly 3 times in a row' },
  { id: 'arms', Icon: UsersIcon, name: 'Crossed arms', desc: 'Cross both arms over your chest' },
  { id: 'mouth', Icon: SmileIcon, name: 'Open mouth hold', desc: 'Hold your mouth open for 1 second' },
];

const LEVELS = ['low', 'medium', 'high'] as const;

export function GestureDetection() {
  const nav = useNavigate();
  const { settings, setSettings } = useApp();
  const cameraRef = useRef<CameraFeedRef>(null);
  const [active, setActive] = useState(true);
  const [silent, setSilent] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const simulatingRef = useRef(false);
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);
  const [gestureProgress, setGestureProgress] = useState<Record<string, number>>({
    palm: 0,
    blink: 0,
    arms: 0,
    mouth: 0
  });

  const triggerGestureAlert = async (gestureName: string) => {
    if (!active || simulatingRef.current) return;
    simulatingRef.current = true;
    try {
      if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
    } catch {}

    setDetectedGesture(gestureName);
    setSimulating(true);

    // 1. Immediately start real camera & microphone recording from live active feed
    try {
      cameraRef.current?.startEmergencyRecording();
    } catch {}

    // 2. Capture instant camera photo snapshot
    const primaryPhoto = cameraRef.current?.capturePhoto();
    const gesturePhotos = primaryPhoto ? [primaryPhoto] : [];

    // 3. Automatically trigger the alert in the app immediately
    setTimeout(() => {
      simulatingRef.current = false;
      setSimulating(false);
      nav('/alert', {
        state: {
          type: 'sos',
          triggerGesture: gestureName,
          instant: true,
          gesturePhoto: primaryPhoto,
          gesturePhotos
        }
      });
    }, 150);
  };

  const simulateRandom = () => {
    const randomGesture = GESTURES[Math.floor(Math.random() * GESTURES.length)].name;
    triggerGestureAlert(randomGesture);
  };

  return (
    <Screen title="Camera Gestures" back>
      {/* Status banner */}
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="font-bold">Gesture Detection</p>
          <p className="text-xs font-semibold" style={{ color: active ? '#00e676' : '#ff9100' }}>
            {active ? '● Active — Watching for trigger gestures' : '○ Inactive — Detection paused'}
          </p>
        </div>
        <Toggle checked={active} onChange={setActive} />
      </div>

      {/* Automated Emergency Trigger Mode Banner */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#ff1744]/40 bg-[#ff1744]/10 p-4 shadow-[0_0_20px_rgba(255,23,68,0.2)]">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-white">Automated Alert Trigger</p>
            <span className="px-2 py-0.5 text-[10px] font-mono font-black rounded-full bg-[#ff1744] text-white">
              LIVE SOS ACTIVE
            </span>
          </div>
          <p className="text-xs text-white/70 mt-0.5">
            Perform <strong>any one</strong> of the trigger gestures in front of the camera — the app will automatically trigger the SOS emergency alert immediately.
          </p>
        </div>
      </div>

      {/* Live Camera Preview */}
      {silent && active ? (
        <div className="mb-4 flex h-48 items-center justify-center rounded-2xl border border-white/10 bg-black text-center text-sm text-white/40">
          Silent mode — camera active, screen hidden
        </div>
      ) : (
        <div className="relative mb-4">
          <SimCameraFeed
            ref={cameraRef}
            facing={settings.cameraChoice === 'rear' ? 'rear' : 'front'}
            cameraChoice={settings.cameraChoice}
            audioQuality={settings.audioQuality}
            className="aspect-video w-full max-h-72 object-cover mx-auto"
            detecting={active}
            safeTestMode={false}
            sensitivity={settings.sensitivity}
            onGestureDetected={(gestureName) => triggerGestureAlert(gestureName)}
            onGestureProgress={(gestureId, progress) => {
              setGestureProgress((prev) => ({ ...prev, [gestureId]: progress }));
            }}
            label={
              simulating && detectedGesture
                ? `🚨 GESTURE DETECTED: ${detectedGesture.toUpperCase()} — FIRING ALERT!`
                : active
                ? '🔴 LIVE AUTOMATED GESTURE SCANNER ACTIVE'
                : 'Detection paused'
            }
          />

          {/* Enforced User Settings Ribbon */}
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-white/50">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00e676]" />
              Sensitivity: <strong className="text-white capitalize">{settings.sensitivity}</strong>
            </span>
            <span>
              Mode: <strong className="text-[#ff1744]">Auto SOS Trigger</strong>
            </span>
            <span>
              Camera: <strong className="text-white uppercase">{settings.cameraChoice}</strong>
            </span>
            <span>
              Audio: <strong className="text-white">{settings.audioQuality === 'low' ? 'Low bw' : 'High'}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Gesture Trigger Confirmation Notification */}
      {simulating && detectedGesture && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 rounded-2xl border border-[#ff1744] bg-[#ff1744]/20 p-4 text-center font-black text-white shadow-[0_0_25px_rgba(255,23,68,0.4)]"
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2Icon className="animate-pulse text-[#ff1744]" size={22} />
            <span>
              Gesture Detected ({detectedGesture}) — Automatically Firing SOS Alert!
            </span>
          </div>
        </motion.div>
      )}

      {/* Silent mode */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="font-bold">Silent Mode</p>
          <p className="text-xs text-white/50">Camera runs with a black screen for discreet operation</p>
        </div>
        <Toggle checked={silent} onChange={setSilent} color="#ff9100" />
      </div>

      {/* Sensitivity */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="mb-3 font-bold">Detection Sensitivity</p>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => {
            const on = settings.sensitivity === l;
            return (
              <button
                key={l}
                onClick={() => setSettings({ sensitivity: l })}
                className="rounded-xl py-2.5 text-sm font-bold capitalize transition-colors"
                style={{
                  backgroundColor: on ? '#ff1744' : 'rgba(255,255,255,0.05)',
                  color: on ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trigger Gestures List */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wider text-[#00e676] flex items-center gap-1.5">
          <AlertCircleIcon size={14} /> LIVE CAMERA GESTURES (AUTOMATIC TRIGGER ACTIVE):
        </p>
      </div>

      <div className="space-y-2.5">
        {GESTURES.map((g) => {
          const prog = gestureProgress[g.id] || 0;
          const isDetectingThis = prog > 0;
          return (
            <button
              key={g.id}
              onClick={() => triggerGestureAlert(g.name)}
              disabled={!active || simulating}
              className={`relative overflow-hidden flex flex-col w-full rounded-2xl border p-4 text-left transition-all ${
                isDetectingThis
                  ? 'border-[#00e676] bg-[#00e676]/10 shadow-[0_0_18px_rgba(0,230,118,0.25)] scale-[1.01]'
                  : active && !simulating
                  ? 'border-white/10 bg-white/5 hover:border-[#ff1744]/70 hover:bg-white/10 active:scale-[0.98]'
                  : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
              }`}
            >
              {/* Real-time confidence fill bar */}
              {active && prog > 0 && (
                <div
                  className="absolute bottom-0 left-0 top-0 bg-[#00e676]/25 transition-all duration-150 pointer-events-none"
                  style={{ width: `${prog}%` }}
                />
              )}

              <div className="relative z-10 flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                    isDetectingThis
                      ? 'bg-[#00e676] border-[#00e676] text-black shadow-[0_0_12px_rgba(0,230,118,0.4)]'
                      : 'bg-gradient-to-br from-[#00e676]/20 to-[#00e676]/5 border-[#00e676]/30 text-[#00e676]'
                  }`}>
                    <g.Icon size={24} color={isDetectingThis ? '#000000' : '#00e676'} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-base">{g.name}</p>
                      {active && prog > 0 && (
                        <span className="rounded-md bg-[#00e676] px-1.5 py-0.5 text-[10px] font-mono font-black text-black animate-pulse">
                          {g.id === 'blink'
                            ? `${Math.max(1, Math.ceil((prog / 100) * 3))}/3 BLINKS`
                            : g.id === 'mouth'
                            ? `${(Math.min(100, prog) / 100).toFixed(1)}s / 1.0s`
                            : `${prog}% DETECTING`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">{g.desc}</p>
                  </div>
                </div>
                {active && (
                  <span className={`rounded-full px-3 py-1.5 text-[11px] font-black shrink-0 transition-colors ${
                    isDetectingThis
                      ? 'bg-[#00e676] text-black shadow-[0_0_12px_rgba(0,230,118,0.4)] animate-pulse'
                      : 'bg-[#ff1744] text-white shadow-[0_0_12px_rgba(255,23,68,0.35)]'
                  }`}>
                    {prog >= 100 ? '🚨 FIRING SOS!' : isDetectingThis ? `${prog}% CHARGING` : 'TRIGGER ALERT'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[#00e676]/30 bg-[#00e676]/10 p-3.5 text-center shadow-[0_0_15px_rgba(0,230,118,0.15)]">
        <p className="text-xs font-black text-[#00e676] flex items-center justify-center gap-1.5">
          <span>⚡ AUTOMATIC TRIGGER ACTIVE:</span>
        </p>
        <p className="mt-1 text-[11px] text-white/80">
          Perform <strong>any one</strong> of the 4 gestures above in front of the camera — it will automatically trigger the SOS alert without tapping any button.
        </p>
      </div>

      <button
        onClick={simulateRandom}
        disabled={!active || simulating}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 py-3 font-bold text-white/70 transition-transform active:scale-95 disabled:opacity-40 text-xs"
      >
        <PlayIcon size={14} /> Optional Manual SOS Trigger (Fallback)
      </button>
    </Screen>
  );
}