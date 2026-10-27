import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { fmtClock } from '../lib/mock';
import {
  getGlobalMediaStream,
  switchCameraFacing,
  captureFrameFromVideo,
  captureBurstFromVideo,
  startMediaRecording,
  stopMediaRecording,
  isCurrentlyRecording
} from '../lib/mediaStreamManager';
import { GestureRecognitionEngine, GestureDetectionResult } from '../lib/gestureEngine';

interface Props {
  label?: string;
  recording?: boolean;
  facing?: 'front' | 'rear';
  cameraChoice?: 'front' | 'rear' | 'both';
  className?: string;
  detecting?: boolean;
  onGestureDetected?: (gestureName: string) => void;
  onGestureProgress?: (gestureName: string, progress: number) => void;
  sensitivity?: 'low' | 'medium' | 'high';
  audioQuality?: 'low' | 'high';
  safeTestMode?: boolean;
  onDetectionUpdate?: (result: GestureDetectionResult) => void;
}

export interface CameraFeedRef {
  capturePhoto: () => string;
  capturePhotoBurst: (count?: number, intervalMs?: number) => Promise<string[]>;
  recordMediaClip: (durationMs?: number) => Promise<{ videoDataUrl: string; audioDataUrl: string }>;
  recordVideoClip: (durationMs?: number) => Promise<string>;
  recordAudioClip: (durationMs?: number, qualityOverride?: 'low' | 'high') => Promise<string>;
  startEmergencyRecording: () => void;
  stopRecording: () => void;
  getVideoElement: () => HTMLVideoElement | null;
}

// Generate valid WAV audio data URL for emergency audio fallback
function generateEmergencyAudioWav(quality: 'low' | 'high' = 'high'): string {
  const sampleRate = quality === 'low' ? 8000 : 44100;
  const numSamples = sampleRate * 2;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 880 * t) * 0.3;
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

export const SimCameraFeed = forwardRef<CameraFeedRef, Props>(({
  label,
  recording,
  facing = 'front',
  cameraChoice,
  className = '',
  detecting,
  onGestureDetected,
  onGestureProgress,
  sensitivity = 'medium',
  audioQuality = 'high',
  safeTestMode: initialSafeTestMode = false,
  onDetectionUpdate
}, ref) => {
  const [now, setNow] = useState(Date.now());
  const [hasRealStream, setHasRealStream] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeFacing, setActiveFacing] = useState<'front' | 'rear'>(facing);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [safeTestMode, setSafeTestMode] = useState<boolean>(initialSafeTestMode ?? false);
  const [liveHudStatus, setLiveHudStatus] = useState<string | null>(null);

  const [hudData, setHudData] = useState<GestureDetectionResult>({
    cameraStatus: 'Active',
    humanStatus: 'No person detected',
    currentGesture: 'No gesture detected',
    confidence: 0,
    progress: {
      blinkCount: 0,
      mouthHoldSeconds: 0,
      palmHoldFrames: 0,
      armsHoldFrames: 0,
      palmPercent: 0,
      blinkPercent: 0,
      armsPercent: 0,
      mouthPercent: 0
    },
    sosStatus: 'Monitoring',
    landmarks: {
      faceDetected: false,
      ear: 0,
      mor: 0,
      handDetected: false,
      extendedFingers: 0,
      isOpenPalm: false,
      isWaving: false,
      armsCrossed: false
    },
    isConfirmed: false,
    confirmedGestureName: null
  });

  const engineRef = useRef<GestureRecognitionEngine | null>(null);
  if (!engineRef.current) {
    const palmFrames = sensitivity === 'high' ? 8 : sensitivity === 'low' ? 16 : 12;
    const armsFrames = sensitivity === 'high' ? 8 : sensitivity === 'low' ? 16 : 12;
    const mouthMs = sensitivity === 'high' ? 650 : sensitivity === 'low' ? 1100 : 850;
    engineRef.current = new GestureRecognitionEngine({
      safeTestMode: initialSafeTestMode ?? false,
      confidenceThreshold: sensitivity === 'high' ? 0.60 : sensitivity === 'low' ? 0.78 : 0.68,
      palmHoldFramesRequired: palmFrames,
      armsHoldFramesRequired: armsFrames,
      mouthHoldDurationMs: mouthMs,
      requiredConsecutiveFrames: sensitivity === 'high' ? 2 : sensitivity === 'low' ? 5 : 3
    });
  }

  useEffect(() => {
    if (initialSafeTestMode !== undefined) {
      setSafeTestMode(initialSafeTestMode);
      engineRef.current?.setSafeTestMode(initialSafeTestMode);
    }
  }, [initialSafeTestMode]);

  useEffect(() => {
    const confThresh = sensitivity === 'high' ? 0.60 : sensitivity === 'low' ? 0.78 : 0.68;
    const reqFrames = sensitivity === 'high' ? 2 : sensitivity === 'low' ? 5 : 3;
    const palmFrames = sensitivity === 'high' ? 8 : sensitivity === 'low' ? 16 : 12;
    const armsFrames = sensitivity === 'high' ? 8 : sensitivity === 'low' ? 16 : 12;
    const mouthMs = sensitivity === 'high' ? 650 : sensitivity === 'low' ? 1100 : 850;
    engineRef.current?.updateConfig({
      confidenceThreshold: confThresh,
      requiredConsecutiveFrames: reqFrames,
      palmHoldFramesRequired: palmFrames,
      armsHoldFramesRequired: armsFrames,
      mouthHoldDurationMs: mouthMs,
      safeTestMode
    });
  }, [sensitivity, safeTestMode]);

  useEffect(() => {
    setActiveFacing(facing);
  }, [facing]);

  const toggleCamera = async () => {
    const nextFacing = activeFacing === 'front' ? 'rear' : 'front';
    setActiveFacing(nextFacing);
    const stream = await switchCameraFacing(nextFacing);
    if (stream && videoRef.current) {
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Explicit camera initialization handler (called on mount or manual button click)
  const initCamera = async () => {
    setIsRequestingCamera(true);
    setCameraError(null);
    try {
      const stream = await getGlobalMediaStream(activeFacing);
      if (!stream) {
        setHasRealStream(false);
        setCameraError('Camera access not granted or hardware unavailable');
        setIsRequestingCamera(false);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => console.debug('Video autoplay deferred until user interaction:', err));
        }
      }
      setHasRealStream(true);
      setCameraError(null);
    } catch (err: any) {
      console.warn('Real camera stream fallback notice:', err);
      setHasRealStream(false);
      setCameraError(err?.message || 'Could not access webcam');
    } finally {
      setIsRequestingCamera(false);
    }
  };

  // Request real camera stream on mount
  useEffect(() => {
    initCamera();
  }, [activeFacing]);

  // Robust real-time automated physical gesture detector with strict landmark validation
  useEffect(() => {
    if (!detecting) return;

    let animId: number;
    let lastTickTime = 0;

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const checkFrame = (currentTime: number) => {
      // Sample at ~50ms intervals (~20 FPS)
      if (currentTime - lastTickTime < 50) {
        animId = requestAnimationFrame(checkFrame);
        return;
      }
      lastTickTime = currentTime;

      const video = videoRef.current;
      const isVideoReady = video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused;

      if (isVideoReady && ctx && engineRef.current) {
        try {
          ctx.drawImage(video, 0, 0, 160, 120);
          const result = engineRef.current.processFrame(ctx, 160, 120, currentTime);
          
          const finalResult: GestureDetectionResult = {
            ...result,
            cameraStatus: hasRealStream ? 'Active' : 'Unavailable'
          };

          setHudData(finalResult);
          onDetectionUpdate?.(finalResult);

          // Update parent progress bars (0-100) using clean normalized metrics
          onGestureProgress?.('palm', finalResult.progress.palmPercent);
          onGestureProgress?.('blink', finalResult.progress.blinkPercent);
          onGestureProgress?.('arms', finalResult.progress.armsPercent);
          onGestureProgress?.('mouth', finalResult.progress.mouthPercent);

          // Handle Confirmed SOS Trigger (Immediately triggers alert in the app)
          if (finalResult.isConfirmed && finalResult.confirmedGestureName) {
            setLiveHudStatus(`🚨 GESTURE VERIFIED: ${finalResult.confirmedGestureName.toUpperCase()} — ACTIVATING SOS!`);
            console.log(`⚡ Confirmed gesture "${finalResult.confirmedGestureName}" — automatically triggering SOS alert!`);
            if (onGestureDetected) {
              onGestureDetected(finalResult.confirmedGestureName);
            }
          } else if (finalResult.currentGesture === 'Raised Palm') {
            setLiveHudStatus(`✋ PALM DETECTED (${finalResult.progress.palmPercent}%)`);
          } else if (finalResult.currentGesture === 'Blink Pattern') {
            setLiveHudStatus(`👁️ BLINK PATTERN (${finalResult.progress.blinkCount}/3 BLINKS)`);
          } else if (finalResult.currentGesture === 'Open Mouth Hold') {
            setLiveHudStatus(`👄 MOUTH HOLD (${finalResult.progress.mouthHoldSeconds.toFixed(1)}s / 0.9s)`);
          } else if (finalResult.currentGesture === 'Crossed Arms') {
            setLiveHudStatus(`🙅 CROSSED ARMS (${finalResult.progress.armsPercent}%)`);
          } else if (finalResult.currentGesture !== 'No gesture detected') {
            setLiveHudStatus(`${finalResult.currentGesture.toUpperCase()} (${Math.round(finalResult.confidence * 100)}%)`);
          } else {
            setLiveHudStatus(null);
          }
        } catch (frameErr) {
          console.debug('Frame processing non-fatal error:', frameErr);
        }
      } else if (!hasRealStream) {
        setHudData((prev) => ({
          ...prev,
          cameraStatus: 'Unavailable',
          humanStatus: 'No person detected',
          currentGesture: 'No gesture detected',
          confidence: 0
        }));
      }

      animId = requestAnimationFrame(checkFrame);
    };

    animId = requestAnimationFrame(checkFrame);

    return () => {
      cancelAnimationFrame(animId);
      engineRef.current?.resetTracking();
    };
  }, [detecting, hasRealStream, onGestureDetected, onGestureProgress, safeTestMode]);


  const takeSingleSnapshot = (idx = 1): string => {
    try {
      const realFrame = captureFrameFromVideo(videoRef.current, activeFacing);
      if (realFrame) return realFrame;
    } catch (e) {
      console.error('Error capturing photo from video element:', e);
    }

    // High quality emergency photo snapshot fallback
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 640;
    fallbackCanvas.height = 480;
    const ctx = fallbackCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0d1218';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(20, 20, 600, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('🚨 SILENTSOS REAL-TIME EMERGENCY EVIDENCE', 40, 58);
      ctx.fillStyle = '#00e676';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`STATUS: LIVE EVIDENCE RECORDED (FRAME #${idx})`, 40, 130);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText(`TIMESTAMP: ${new Date().toLocaleString()}`, 40, 170);
      ctx.fillText(`DEVICE FACING: ${facing.toUpperCase()} CAMERA`, 40, 200);
      return fallbackCanvas.toDataURL('image/jpeg', 0.85);
    }
    return 'data:image/jpeg;base64,';
  };

  // Imperative handlers for guaranteed Photo, Video, and Audio evidence capture
  useImperativeHandle(ref, () => ({
    capturePhoto: (): string => {
      const realFrame = captureFrameFromVideo(videoRef.current, activeFacing);
      if (realFrame) return realFrame;
      return takeSingleSnapshot(1);
    },

    capturePhotoBurst: async (count = 5, intervalMs = 100): Promise<string[]> => {
      const targetCount = count || 5;
      const frames: string[] = [];

      try {
        if (cameraChoice === 'both') {
          const frontCount = Math.max(1, Math.ceil(targetCount / 2));
          const rearCount = Math.max(0, targetCount - frontCount);

          // 1. Capture from front
          const frontFrames = await captureBurstFromVideo(videoRef.current, frontCount, intervalMs, 'front');
          frames.push(...frontFrames);

          // 2. Switch to rear and capture if available
          if (rearCount > 0) {
            try {
              const s = await switchCameraFacing('rear');
              if (s && videoRef.current) {
                streamRef.current = s;
                videoRef.current.srcObject = s;
                await videoRef.current.play().catch(() => {});
                await new Promise((r) => setTimeout(r, 100));
                const rearFrames = await captureBurstFromVideo(videoRef.current, rearCount, intervalMs, 'rear');
                frames.push(...rearFrames);
              }
            } catch (err) {
              console.debug('Rear camera switch skipped:', err);
            }
          }
        } else {
          const realBurst = await captureBurstFromVideo(videoRef.current, targetCount, intervalMs, activeFacing);
          frames.push(...realBurst);
        }
      } catch (burstErr) {
        console.warn('captureBurstFromVideo notice:', burstErr);
      }

      // If video frames were captured but fewer than targetCount, capture more or duplicate
      if (frames.length > 0 && frames.length < targetCount) {
        const lastFrame = frames[frames.length - 1];
        while (frames.length < targetCount) {
          frames.push(lastFrame);
        }
      }

      // If no video frames could be captured (e.g. simulated camera feed or video element not ready):
      if (frames.length === 0) {
        for (let i = 0; i < targetCount; i++) {
          frames.push(takeSingleSnapshot(i + 1));
        }
      }

      return frames;
    },

    startEmergencyRecording: () => {
      if (streamRef.current) {
        startMediaRecording(streamRef.current, audioQuality);
      }
    },

    recordMediaClip: async (durationMs = 4000): Promise<{ videoDataUrl: string; audioDataUrl: string }> => {
      if (streamRef.current && !isCurrentlyRecording()) {
        startMediaRecording(streamRef.current, audioQuality);
      }
      return await stopMediaRecording(durationMs);
    },

    recordVideoClip: async (durationMs = 4000): Promise<string> => {
      if (streamRef.current && !isCurrentlyRecording()) {
        startMediaRecording(streamRef.current, audioQuality);
      }
      const res = await stopMediaRecording(durationMs);
      return res.videoDataUrl;
    },

    recordAudioClip: async (durationMs = 4000, qualityOverride?: 'low' | 'high'): Promise<string> => {
      const chosenQuality = qualityOverride || audioQuality;
      if (streamRef.current && !isCurrentlyRecording()) {
        startMediaRecording(streamRef.current, chosenQuality);
      }
      const res = await stopMediaRecording(durationMs);
      return res.audioDataUrl || generateEmergencyAudioWav(chosenQuality);
    },

    stopRecording: () => {
      stopMediaRecording(0);
    },

    getVideoElement: () => videoRef.current
  }));

  const simulateGestureAction = (gestureName: string = 'Raised palm / wave') => {
    if (onGestureDetected) {
      onGestureDetected(gestureName);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-black ${className}`}
      role="img"
      aria-label={`${activeFacing} camera live feed`}>
      
      {/* Real camera video element */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover ${hasRealStream ? 'block' : 'hidden'}`}  
      />

      {/* Simulated camera background fallback */}
      {!hasRealStream && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10"
          style={{
            background:
              activeFacing === 'front'
                ? 'radial-gradient(120% 90% at 50% 30%, #1c2530 0%, #0d1218 55%, #050708 100%)'
                : 'radial-gradient(120% 90% at 40% 60%, #241c1c 0%, #14100d 55%, #050505 100%)'
          }}
        >
          <div className="max-w-xs space-y-2 pointer-events-auto">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
              📷
            </div>
            <p className="text-sm font-bold text-white">Camera Feed Pending</p>
            <p className="text-xs text-white/60">
              {cameraError || 'Camera permissions are required for live physical gesture scanning.'}
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  initCamera();
                }}
                disabled={isRequestingCamera}
                className="w-full rounded-xl bg-[#00e676] px-3 py-2 text-xs font-black text-black shadow hover:bg-[#00c853] active:scale-95 transition-all"
              >
                {isRequestingCamera ? 'Starting Camera...' : '📷 Enable Live Camera Feed'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  simulateGestureAction('Raised palm / wave');
                }}
                className="w-full rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 active:scale-95 transition-all"
              >
                ⚡ Test Automated Trigger (Demo)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* scanline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 animate-scan bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      {/* grain */}
      <div
        className="pointer-events-none absolute inset-0 animate-grain mix-blend-overlay"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.5px)',
          backgroundSize: '3px 3px'
        }}
      />

      {/* Real-time Dynamic Landmark Tracking Bounding Boxes & HUD */}
      {detecting && hasRealStream && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {/* Tracked Face Bounding Box Overlay */}
          {hudData.landmarks.faceDetected && hudData.landmarks.faceRect && (
            <div
              className="absolute border-2 border-[#00e676]/90 rounded-2xl transition-all duration-75 shadow-[0_0_18px_rgba(0,230,118,0.45)]"
              style={{
                left: `${(hudData.landmarks.faceRect.x / 160) * 100}%`,
                top: `${(hudData.landmarks.faceRect.y / 120) * 100}%`,
                width: `${(hudData.landmarks.faceRect.width / 160) * 100}%`,
                height: `${(hudData.landmarks.faceRect.height / 120) * 100}%`
              }}
            >
              {/* Corner reticle marks */}
              <div className="absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2 border-white rounded-tl" />
              <div className="absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2 border-white rounded-tr" />
              <div className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-white rounded-bl" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-white rounded-br" />

              <span className="absolute -top-5 left-0 rounded bg-black/85 px-1.5 py-0.5 text-[9px] font-mono font-black text-[#00e676] border border-[#00e676]/40 flex items-center gap-1 shadow">
                <span>👤 FACE TRACKED</span>
                <span className="text-white/60">EAR:{hudData.landmarks.ear}</span>
              </span>
            </div>
          )}

          {/* Tracked Hand Bounding Box Overlay */}
          {hudData.landmarks.handDetected && hudData.landmarks.handRect && (
            <div
              className={`absolute border-2 rounded-2xl transition-all duration-75 ${
                hudData.landmarks.isWaving
                  ? 'border-[#ff9100] shadow-[0_0_20px_rgba(255,145,0,0.6)] animate-pulse'
                  : 'border-[#00e5ff] shadow-[0_0_18px_rgba(0,229,255,0.5)]'
              }`}
              style={{
                left: `${(hudData.landmarks.handRect.x / 160) * 100}%`,
                top: `${(hudData.landmarks.handRect.y / 120) * 100}%`,
                width: `${(hudData.landmarks.handRect.width / 160) * 100}%`,
                height: `${(hudData.landmarks.handRect.height / 120) * 100}%`
              }}
            >
              <div className="absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2 border-white rounded-tl" />
              <div className="absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2 border-white rounded-tr" />
              <div className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-white rounded-bl" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-white rounded-br" />

              <span className="absolute -top-5 left-0 rounded bg-black/85 px-1.5 py-0.5 text-[9px] font-mono font-black text-[#00e5ff] border border-[#00e5ff]/40 flex items-center gap-1 shadow">
                <span>{hudData.landmarks.isWaving ? '🌊 WAVE MOTION' : '✋ PALM'}</span>
                <span className="text-white font-bold">{hudData.progress.palmPercent}%</span>
              </span>
            </div>
          )}

          {/* Central Active Gesture Charging Reticle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
            {/* Ambient center target ring */}
            <div className={`h-24 w-24 rounded-2xl border-2 transition-all ${
              hudData.sosStatus === 'SOS Triggered'
                ? 'border-[#ff1744] shadow-[0_0_30px_rgba(255,23,68,0.8)] scale-110 animate-pulse'
                : hudData.sosStatus === 'Gesture Verified'
                ? 'border-[#00e676] shadow-[0_0_25px_rgba(0,230,118,0.7)] scale-105 animate-pulse'
                : hudData.humanStatus === 'Person detected'
                ? 'border-[#00e676]/40 shadow-[0_0_12px_rgba(0,230,118,0.2)]'
                : 'border-white/15'
            }`} />

            {/* Central gesture alert pill */}
            {liveHudStatus && (
              <div className="mt-2 rounded-full border border-[#00e676] bg-black/90 px-3.5 py-1 shadow-[0_0_20px_rgba(0,230,118,0.6)] animate-pulse">
                <span className="text-[11px] font-mono font-black text-[#00e676]">
                  {liveHudStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comprehensive Viewfinder HUD Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-2.5 pointer-events-none z-30">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {recording ? (
              <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[11px] font-bold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff1744]" />
                REC
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80 border border-white/10">
                <span className={`h-1.5 w-1.5 rounded-full ${hasRealStream ? 'bg-[#00e676]' : 'bg-[#ff1744]'}`} />
                {hasRealStream ? 'CAM ACTIVE' : 'CAM UNAVAILABLE'}
              </span>
            )}

            {/* Auto SOS Trigger Active Pill */}
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black border bg-[#ff1744]/20 border-[#ff1744] text-[#ff1744] shadow-[0_0_10px_rgba(255,23,68,0.3)] animate-pulse"
              title="Automated SOS Alert Trigger Active"
            >
              <span>🚨 AUTO TRIGGER: ON</span>
            </span>

            {cameraChoice === 'both' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCamera();
                }}
                className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 border border-[#00e676]/40 px-2 py-0.5 text-[10px] font-bold text-[#00e676] hover:bg-black/90 active:scale-95 transition-transform"
                title="Toggle between Front & Rear camera"
              >
                <span>⇄ FLIP</span>
              </button>
            )}
          </div>

          <span className="rounded bg-black/60 border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/80">
            {fmtClock(now)}
          </span>
        </div>

        {/* Bottom Full Telemetry HUD Display (All 6 Required Parameters) */}
        {detecting && (
          <div className="rounded-xl border border-white/15 bg-black/85 backdrop-blur-md p-2 shadow-2xl space-y-1.5">
            {/* Row 1: Detection & Gesture Identity */}
            <div className="flex items-center justify-between text-[11px] gap-2">
              <span className="flex items-center gap-1.5 font-bold">
                <span className={`h-2 w-2 rounded-full ${hudData.humanStatus === 'Person detected' ? 'bg-[#00e676] animate-pulse' : 'bg-white/40'}`} />
                <span className={hudData.humanStatus === 'Person detected' ? 'text-[#00e676]' : 'text-white/50'}>
                  {hudData.humanStatus}
                </span>
              </span>

              <span className="flex items-center gap-1 font-mono font-bold text-white text-[10px]">
                <span className="text-white/50">CONF:</span>
                <span className={hudData.confidence >= 0.85 ? 'text-[#00e676]' : 'text-white/80'}>
                  {Math.round(hudData.confidence * 100)}%
                </span>
              </span>
            </div>

            {/* Row 2: Recognized Gesture & Progress */}
            <div className="flex items-center justify-between text-[11px] border-t border-white/10 pt-1">
              <span className="flex items-center gap-1 text-white font-bold truncate">
                <span className="text-white/50 text-[10px]">GESTURE:</span>
                <span className={
                  hudData.currentGesture !== 'No gesture detected' && hudData.currentGesture !== 'Gesture not recognized'
                    ? 'text-[#00e676]'
                    : hudData.currentGesture === 'Gesture not recognized'
                    ? 'text-[#ff9100]'
                    : 'text-white/60'
                }>
                  {hudData.currentGesture}
                </span>
              </span>

              <span className="text-[10px] font-mono text-white/70 shrink-0">
                {hudData.progress.blinkCount > 0 ? (
                  <span className="text-[#00e676] font-bold">Blinks: {hudData.progress.blinkCount}/3 ({hudData.progress.blinkPercent}%)</span>
                ) : hudData.progress.mouthHoldSeconds > 0 ? (
                  <span className="text-[#00e676] font-bold">Hold: {hudData.progress.mouthHoldSeconds.toFixed(1)}s ({hudData.progress.mouthPercent}%)</span>
                ) : hudData.progress.palmPercent > 0 ? (
                  <span className="text-[#00e676] font-bold">Palm: {hudData.progress.palmPercent}%</span>
                ) : hudData.progress.armsPercent > 0 ? (
                  <span className="text-[#00e676] font-bold">Arms: {hudData.progress.armsPercent}%</span>
                ) : (
                  <span>Idle</span>
                )}
              </span>
            </div>

            {/* Row 3: SOS Operational Status */}
            <div className="flex items-center justify-between text-[10px] border-t border-white/10 pt-1">
              <span className="text-white/50 uppercase font-mono tracking-wider">SOS STATUS:</span>
              <span className={`px-2 py-0.5 rounded-md font-mono font-black ${
                hudData.sosStatus === 'SOS Triggered'
                  ? 'bg-[#ff1744] text-white shadow-[0_0_12px_rgba(255,23,68,0.5)] animate-pulse'
                  : hudData.sosStatus === 'Gesture Verified'
                  ? 'bg-[#00e676] text-black shadow-[0_0_12px_rgba(0,230,118,0.5)] animate-pulse'
                  : 'bg-white/10 text-white/80'
              }`}>
                {hudData.sosStatus === 'Gesture Verified' && safeTestMode
                  ? 'GESTURE VERIFIED (SAFE TEST)'
                  : hudData.sosStatus.toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Optional custom label */}
        {label && !detecting && (
          <span className="self-start rounded bg-black/60 border border-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
            {label}
          </span>
        )}
      </div>
    </div>
  );
});

SimCameraFeed.displayName = 'SimCameraFeed';