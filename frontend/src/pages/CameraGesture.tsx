import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { useCamera } from '../hooks/useCamera';
import {
  Camera,
  EyeOff,
  Hand,
  Eye,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CameraGesture() {
  const { state, updateSettings, triggerAlert } = useApp();
  const navigate = useNavigate();
  const { error, isMock, videoRef } = useCamera('user');
  
  const [isScanning, setIsScanning] = useState(true);
  const [selectedGesture, setSelectedGesture] = useState<'palm' | 'blink' | 'both'>('both');
  
  // Real-time tracking mock states for aesthetics
  const [landmarks, setLandmarks] = useState<{ x: number; y: number }[]>([]);
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Discrete Mode Toggle
  const toggleDiscreet = () => {
    updateSettings({
      stealthMode: !state.settings.stealthMode
    });
  };

  // Trigger scanning tracking landmarks animation
  useEffect(() => {
    if (isScanning && !state.settings.stealthMode) {
      // Simulate real-time tracking points moving slightly
      trackingIntervalRef.current = setInterval(() => {
        const points = [];
        // Face/Eye points
        if (selectedGesture === 'blink' || selectedGesture === 'both') {
          points.push(
            { x: 40 + Math.random() * 5, y: 35 + Math.random() * 5 }, // Left eye
            { x: 60 + Math.random() * 5, y: 35 + Math.random() * 5 }, // Right eye
            { x: 50 + Math.random() * 3, y: 45 + Math.random() * 5 }  // Nose bridge
          );
        }
        // Palm/Hand points
        if (selectedGesture === 'palm' || selectedGesture === 'both') {
          points.push(
            { x: 30 + Math.random() * 15, y: 65 + Math.random() * 10 }, // Wrist
            { x: 25 + Math.random() * 10, y: 55 + Math.random() * 10 }, // Thumb
            { x: 35 + Math.random() * 10, y: 50 + Math.random() * 10 }, // Index
            { x: 45 + Math.random() * 10, y: 52 + Math.random() * 10 }, // Ring
            { x: 55 + Math.random() * 10, y: 58 + Math.random() * 10 }  // Pinky
          );
        }
        setLandmarks(points);
      }, 150);
    } else {
      setLandmarks([]);
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    }

    return () => {
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    };
  }, [isScanning, selectedGesture, state.settings.stealthMode]);

  // Handle detection simulation loop
  useEffect(() => {
    if (isScanning && !countdown && !detectedGesture) {
      // Simulate auto-detecting user gesture within 2 seconds
      timerRef.current = setTimeout(() => {
        const gestureName = selectedGesture === 'blink' 
          ? 'Blink Pattern' 
          : selectedGesture === 'palm' 
            ? 'Raised Palm' 
            : Math.random() > 0.5 ? 'Raised Palm' : 'Blink Pattern';
        
        handleGestureTrigger(gestureName);
      }, 2500); // Trigger detection mock after 2.5s
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isScanning, selectedGesture, countdown, detectedGesture]);

  // Actual Trigger Sequence
  const handleGestureTrigger = (gestureName: string) => {
    // Highlight the detected gesture
    setDetectedGesture(gestureName);
    setIsScanning(false);
    
    // Start the strict 2-second alert countdown
    setCountdown(2);
    
    let currentCount = 2;
    countdownIntervalRef.current = setInterval(() => {
      currentCount -= 1;
      setCountdown(currentCount);
      
      if (currentCount <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        triggerAlert(`Gesture Activation (${gestureName})`)
          .then(() => {
            navigate('/alert');
          })
          .catch((e) => {
            console.error('Gesture SOS trigger failed due to location error:', e);
            setIsScanning(true);
            setCountdown(null);
            setDetectedGesture(null);
          });
      }
    }, 1000);
  };

  // Cancel Pending SOS
  const handleCancelCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(null);
    setDetectedGesture(null);
    setIsScanning(true);
  };

  if (state.settings.stealthMode) {
    return (
      <div
        className="flex flex-col h-full bg-black p-6 cursor-pointer"
        onClick={toggleDiscreet}>
        {/* Discreet layout */}
        <div className="absolute top-4 right-4 w-2 h-2 bg-safe rounded-full animate-pulse opacity-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-y-auto no-scrollbar pb-24 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gesture Detection</h1>
          <p className="text-xs text-textMuted mt-0.5">Blink or raise hand to alert contacts</p>
        </div>
        <button
          onClick={toggleDiscreet}
          className="p-2.5 bg-surfaceHighlight hover:bg-surface border border-white/5 rounded-xl text-textMuted hover:text-white transition-all">
          <EyeOff className="w-5 h-5" />
        </button>
      </div>

      {/* Camera Preview Box */}
      <div className="relative w-full aspect-[4/5] bg-surface border border-surfaceHighlight rounded-2xl overflow-hidden mb-5">
        
        {/* Video feed or fallback mock */}
        {isMock || error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            <Camera className="w-12 h-12 text-white/20 mb-3" />
            <p className="text-xs text-textMuted px-6 text-center">
              {error ? 'Webcam block active. Running visual simulation.' : 'Interactive Tracking Sandbox'}
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          />
        )}

        {/* Dynamic visual tracking grids & landmarks */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Pulsing Scan bar */}
            <motion.div 
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-safe to-transparent shadow-[0_0_10px_#00e676]" 
            />

            {/* Scanning bracket borders */}
            <div className="absolute top-6 left-6 right-6 bottom-6 border border-safe/25 rounded-xl">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-safe" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-safe" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-safe" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-safe" />
            </div>

            {/* Glowing Tracker Landmarks */}
            {landmarks.map((pt, idx) => (
              <motion.div
                key={idx}
                style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-safe shadow-[0_0_8px_#00e676]"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: idx * 0.1 }}
              />
            ))}
          </div>
        )}

        {/* Status Bar */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center border border-white/5 z-20">
          {isScanning ? (
            <>
              <span className="w-2.5 h-2.5 bg-safe rounded-full animate-ping mr-2 shrink-0" />
              <span className="text-[10px] font-bold tracking-wider text-safe uppercase">SCANNING CAMERA FEED</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 bg-warning rounded-full mr-2 shrink-0 animate-pulse" />
              <span className="text-[10px] font-bold tracking-wider text-warning uppercase">DETECTION PAUSED</span>
            </>
          )}
        </div>

        {/* Quick Simulation Overlay Buttons */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-2 z-20">
          <button
            onClick={() => handleGestureTrigger('Raised Palm')}
            className="flex-1 py-2 px-3 bg-black/60 hover:bg-black/80 backdrop-blur border border-white/10 hover:border-safe/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
            <Hand className="w-3.5 h-3.5 text-safe" />
            Raise Palm
          </button>
          <button
            onClick={() => handleGestureTrigger('Blink Pattern')}
            className="flex-1 py-2 px-3 bg-black/60 hover:bg-black/80 backdrop-blur border border-white/10 hover:border-safe/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
            <Eye className="w-3.5 h-3.5 text-safe" />
            Blink Eyes
          </button>
        </div>

        {/* 🚨 2-Second Alarm Countdown Overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-16 h-16 rounded-full bg-emergency/20 border border-emergency/30 flex items-center justify-center mb-4 text-emergency"
              >
                <ShieldAlert className="w-9 h-9" />
              </motion.div>

              <h3 className="text-lg font-extrabold tracking-tight text-white mb-1">
                {detectedGesture} Detected!
              </h3>
              <p className="text-xs text-textMuted max-w-[220px] mb-5">
                Automatically triggering emergency response workflow:
              </p>

              {/* Strict 2-second visual countdown */}
              <div className="text-5xl font-black tracking-tighter text-emergency mb-6">
                {countdown > 0 ? `${countdown}.0s` : 'Sending...'}
              </div>

              <button
                onClick={handleCancelCountdown}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold tracking-wide transition-all border border-white/10"
              >
                Cancel Alert
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Configuration cards */}
      <div className="space-y-4">
        {/* Active Gesture Mode Configuration */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3.5">
            <Sliders className="w-4 h-4 text-safe" />
            <h2 className="text-sm font-bold tracking-tight">Active Detection Pattern</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'palm', label: 'Palm Only', icon: Hand },
              { id: 'blink', label: 'Blink Only', icon: Eye },
              { id: 'both', label: 'Both Active', icon: Sparkles }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSelectedGesture(mode.id as any)}
                className={`py-2 px-1 text-2xs font-bold rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                  selectedGesture === mode.id
                    ? 'bg-safe/15 border-safe text-white'
                    : 'bg-background border-surfaceHighlight text-textMuted hover:text-white'
                }`}
              >
                <mode.icon className={`w-4 h-4 ${selectedGesture === mode.id ? 'text-safe' : 'text-textMuted'}`} />
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sensitivity Selector */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold">Detection Sensitivity</span>
            <span className="text-2xs bg-surfaceHighlight text-safe font-bold px-2 py-0.5 rounded-full border border-safe/10">
              {state.settings.gestureSensitivity}
            </span>
          </div>
          <div className="flex gap-2">
            {['Low', 'Medium', 'High'].map((level) => (
              <button
                key={level}
                onClick={() => updateSettings({ gestureSensitivity: level as any })}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                  state.settings.gestureSensitivity === level
                    ? 'bg-safe text-black border-transparent font-extrabold'
                    : 'bg-background border-surfaceHighlight text-textMuted hover:text-white'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Quick simulator status info */}
        <div className="p-3 bg-safe/5 border border-safe/10 rounded-xl flex gap-3 items-start">
          <CheckCircle2 className="w-4 h-4 text-safe shrink-0 mt-0.5" />
          <p className="text-[10px] text-textMuted leading-relaxed">
            The scanner automatically checks coordinates and begins recording evidence media upon trigger. Live coordinates link is dispatched instantly.
          </p>
        </div>
      </div>
    </div>
  );
}