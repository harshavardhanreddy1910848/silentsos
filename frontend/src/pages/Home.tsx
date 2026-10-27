import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPinIcon,
  CameraIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  EyeOffIcon,
  ClockIcon,
  ChevronRightIcon } from
'lucide-react';
import { useApp } from '../context/AppContext';
import { useGps } from '../hooks/useGps';
import { useVoiceTrigger } from '../hooks/useVoiceTrigger';
import { fmtCoord, ALERT_META } from '../lib/mock';
import { AlertType } from '../lib/types';
import { Toggle } from '../components/ui/Toggle';
import { DiscreetOverlay } from '../components/DiscreetOverlay';

const QUICK: {type: AlertType;}[] = [
{ type: 'medical' },
{ type: 'fire' },
{ type: 'police' },
{ type: 'danger' }];


import { GoogleMapView } from '../components/GoogleMapView';
import { SimCameraFeed } from '../components/SimCameraFeed';

export function Home() {
  const nav = useNavigate();
  const { profile, capture, setCapture, settings, setSettings, contacts } = useApp();
  const { point, accuracy, isRealGps } = useGps(true);
  const [showMap, setShowMap] = useState(true);
  const [showHomeCamera, setShowHomeCamera] = useState(true);
  const [discreet, setDiscreet] = useState(false);
  const fire = useCallback((type: AlertType) => nav('/alert', { state: { type } }), [nav]);

  const selectedTriggers = profile.selectedGestures || [profile.gesture || 'camera-gesture'];
  const isVoiceMode = selectedTriggers.includes('voice-mode') || profile.gesture === 'voice-mode';
  const isCameraGesture = selectedTriggers.includes('camera-gesture') || profile.gesture === 'camera-gesture';
  const fireSos = useCallback(() => fire('sos'), [fire]);
  const { lastTranscript, simulateHelp } = useVoiceTrigger(isVoiceMode, fireSos);

  // triple-tap detection on the SOS button
  const taps = useRef<number[]>([]);

  const onSosTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 700), now];
    if (taps.current.length >= 3) {
      taps.current = [];
    }
    // single tap already arms the countdown; triple-tap simply reinforces intent
    fire('sos');
  };

  const armed = contacts.length > 0;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {discreet &&
      <DiscreetOverlay
        onExit={() => setDiscreet(false)}
        onTrigger={() => {
          setDiscreet(false);
          fire('sos');
        }} />

      }

      {/* top status */}
      <header className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            SilentSOS
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: armed ? '#00e676' : '#ff9100' }} />
            
            <span className="text-sm font-bold" style={{ color: armed ? '#00e676' : '#ff9100' }}>
              {armed ? 'System Armed & Ready' : 'Add a contact to arm'}
            </span>
          </div>
        </div>
        <button
          onClick={() => nav('/history')}
          aria-label="Alert history"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
          
          <ClockIcon size={20} color="#fff" />
        </button>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
        {/* SOS BUTTON */}
        <div className="flex flex-col items-center py-8">
          <button
            onClick={onSosTap}
            aria-label="Send emergency SOS alert"
            className="relative flex h-56 w-56 items-center justify-center rounded-full focus:outline-none">
            
            {[0, 1].map((i) =>
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: 'rgba(255,23,68,0.25)' }}
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 2, delay: i * 1 }} />

            )}
            <motion.span
              className="absolute inset-4 rounded-full"
              style={{ backgroundColor: 'rgba(255,23,68,0.15)' }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }} />
            
            <span
              className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full text-white shadow-[0_0_60px_rgba(255,23,68,0.6)]"
              style={{ backgroundColor: '#ff1744' }}>
              
              <span className="text-4xl font-black tracking-tight">SOS</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-white/80">
                Tap to alert
              </span>
            </span>
          </button>
          <p className="mt-6 text-center text-xs text-white/40">
            Tap once — a 5s countdown starts before evidence is captured & sent.
          </p>
        </div>

        {/* quick actions */}
        <div className="grid grid-cols-4 gap-2.5">
          {QUICK.map(({ type }) => {
            const m = ALERT_META[type];
            return (
              <button
                key={type}
                onClick={() => fire(type)}
                className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/5 py-3 active:scale-95 transition-transform hover:border-white/20">
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[11px] font-bold text-white/90">{m.short}</span>
                <span className="text-[10px] font-mono font-extrabold" style={{ color: m.color }}>
                  {m.emergencyNumber}
                </span>
              </button>
            );
          })}
        </div>

        {/* GPS Location & Live Google Map */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: 'rgba(0,230,118,0.25)' }}
                  animate={{ scale: [0.6, 1.4], opacity: [0.6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                />
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#00e676]">
                  <MapPinIcon size={16} color="#000" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white/50">Live GPS Location</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${isRealGps ? 'bg-[#00e676]/20 text-[#00e676]' : 'bg-amber-500/20 text-amber-400'}`}>
                    {isRealGps ? 'Real GPS Active' : 'Acquiring GPS'}
                  </span>
                </div>
                <p className="font-mono text-sm font-bold text-[#00e676]">
                  {fmtCoord(point.lat, point.lng)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMap(!showMap)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
              >
                {showMap ? 'Hide Map' : 'Show Map'}
              </button>
            </div>
          </div>

          {showMap && (
            <div className="mt-3">
              <GoogleMapView
                lat={point.lat}
                lng={point.lng}
                accuracy={accuracy}
                height="210px"
                title="Your Real GPS Location"
              />
            </div>
          )}
        </div>

        {/* active panic triggers */}
        <div className="mt-3 space-y-2.5">
          {/* Camera Gesture Status */}
          {isCameraGesture && (
            <div className="rounded-2xl border border-[#00e676]/30 bg-[#00e676]/10 p-4 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div
                  onClick={() => nav('/gestures')}
                  className="flex cursor-pointer items-center gap-3 active:scale-[0.99] flex-1 min-w-0"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00e676] text-black shrink-0">
                    <CameraIcon size={22} color="#000" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white truncate">Camera Gesture Detection</p>
                      <span className="flex h-2 w-2 rounded-full bg-[#00e676] animate-pulse shrink-0" />
                    </div>
                    <p className="text-xs text-[#00e676]">
                      Active — Automatic alert on any trigger gesture
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowHomeCamera(!showHomeCamera)}
                    className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/20 transition-colors"
                  >
                    {showHomeCamera ? 'Hide Feed' : 'Live Feed'}
                  </button>
                  <button
                    type="button"
                    onClick={() => nav('/gestures')}
                    className="flex items-center gap-1 rounded-xl border border-[#00e676]/30 bg-[#00e676]/20 px-2.5 py-1 text-[11px] font-extrabold text-[#00e676] hover:bg-[#00e676]/30 transition-colors"
                  >
                    <span>Full Scanner</span>
                    <ChevronRightIcon size={13} />
                  </button>
                </div>
              </div>

              {/* Embedded live camera feed for instant automated gesture detection */}
              {showHomeCamera && (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/15">
                  <SimCameraFeed
                    detecting={isCameraGesture}
                    facing={settings.cameraChoice === 'rear' ? 'rear' : 'front'}
                    cameraChoice={settings.cameraChoice}
                    audioQuality={settings.audioQuality}
                    sensitivity={settings.sensitivity}
                    className="aspect-video w-full max-h-52 object-cover"
                    onGestureDetected={(gestureName) => {
                      try {
                        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
                      } catch {}
                      nav('/alert', {
                        state: {
                          type: 'sos',
                          triggerGesture: gestureName,
                          instant: true
                        }
                      });
                    }}
                  />
                </div>
              )}

              {/* 1-tap Trigger Gestures quick row */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                  Tap any trigger gesture to automatically fire SOS alert:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'palm', name: 'Raised palm / wave', icon: '✋', label: 'Palm / Wave' },
                    { id: 'blink', name: 'Blink pattern', icon: '👁️', label: 'Blink pattern' },
                    { id: 'arms', name: 'Crossed arms', icon: '🙅', label: 'Crossed arms' },
                    { id: 'mouth', name: 'Open mouth hold', icon: '👄', label: 'Open mouth' }
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        try {
                          if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
                        } catch {}
                        nav('/alert', { state: { type: 'sos', triggerGesture: g.name, instant: true } });
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-bold text-white hover:border-[#ff1744]/60 hover:bg-[#ff1744]/15 active:scale-95 transition-all text-left"
                    >
                      <span>{g.icon}</span>
                      <span className="truncate">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voice Mode Status */}
          {isVoiceMode && (
            <div className="flex flex-col gap-2 rounded-2xl border border-[#ff1744]/30 bg-[#ff1744]/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff1744] text-white">
                  <MicIcon size={22} color="#fff" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">Voice Trigger Active</p>
                    <span className="flex h-2 w-2 rounded-full bg-[#00e676] animate-pulse" />
                  </div>
                  <p className="text-xs text-white/70">
                    Listening for <span className="font-bold text-[#00e676]">"help"</span> or <span className="font-bold text-[#00e676]">"emergency"</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-white/50">
                  {lastTranscript ? `Heard: "${lastTranscript}"` : 'Say "help" to trigger security alert'}
                </span>
                <button
                  onClick={simulateHelp}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/20">
                  Test voice alert
                </button>
              </div>
            </div>
          )}
        </div>

        {/* evidence toggles */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-white/40">
            Evidence capture
          </p>
          <ToggleRow
            Icon={ImageIcon}
            label="Photo burst"
            on={capture.photos}
            onChange={(v) => setCapture({ photos: v })} />
          
          <ToggleRow
            Icon={VideoIcon}
            label="Video recording"
            on={capture.video}
            onChange={(v) => setCapture({ video: v })} />
          
          <ToggleRow
            Icon={MicIcon}
            label="Audio recording"
            on={capture.audio}
            onChange={(v) => setCapture({ audio: v })}
            last />
          
        </div>

        {/* discreet mode */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <EyeOffIcon size={20} color="#fff" />
            <Toggle
              checked={settings.discreet}
              onChange={(v) => {
                setSettings({ discreet: v });
                if (v) setDiscreet(true);
              }}
              color="#ff9100"
              label="Discreet mode" />
            
          </div>
          <p className="text-sm font-bold">Discreet mode</p>
          <p className="text-[11px] text-white/50">Black screen, still recording</p>
        </div>
      </div>
    </div>);

}

function ToggleRow({
  Icon,
  label,
  on,
  onChange,
  last






}: {Icon: React.ComponentType<{ size?: number | string; color?: string }>;label: string;on: boolean;onChange: (v: boolean) => void;last?: boolean;}) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${
      last ? '' : 'border-b border-white/5'}`
      }>
      
      <Icon size={20} color={on ? '#fff' : '#666'} />
      <span className={`flex-1 text-sm font-semibold ${on ? 'text-white' : 'text-white/40'}`}>
        {label}
      </span>
      <Toggle checked={on} onChange={onChange} />
    </div>);

}