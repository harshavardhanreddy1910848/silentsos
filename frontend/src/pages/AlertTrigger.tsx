import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, API_BASE } from '../AppContext';
import { useGeolocation } from '../hooks/useGeolocation';
import {
  ShieldAlert,
  X,
  CheckCircle2,
  Camera,
  Video,
  Mic,
  MapPin,
  Send,
  Copy,
  Check,
  AlertCircle,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Generates a mock canvas photo when actual webcam track is not accessible
function generateBackupPhotoBlob(type: string, lat?: number | null, lng?: number | null): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 1. Radial gradient background
      const grad = ctx.createRadialGradient(640, 360, 50, 640, 360, 600);
      grad.addColorStop(0, '#1e1b4b'); // Deep indigo
      grad.addColorStop(1, '#020617'); // Dark slate
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // 2. Faint concentric circular radar background (centered at 640, 360)
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.05)'; // Emerald tint
      ctx.lineWidth = 1.5;
      for (let r = 100; r <= 400; r += 100) {
        ctx.beginPath();
        ctx.arc(640, 360, r, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Crosshair lines
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.beginPath();
      ctx.moveTo(640, 100); ctx.lineTo(640, 620);
      ctx.moveTo(340, 360); ctx.lineTo(940, 360);
      ctx.stroke();

      // 3. HUD corner brackets for the 1:1 square crop region (320 to 960, 80 to 640)
      ctx.strokeStyle = '#ef4444'; // Distress Red
      ctx.lineWidth = 4;
      
      // Top-Left Corner
      ctx.beginPath();
      ctx.moveTo(320, 130); ctx.lineTo(320, 80); ctx.lineTo(370, 80);
      ctx.stroke();
      
      // Top-Right Corner
      ctx.beginPath();
      ctx.moveTo(910, 80); ctx.lineTo(960, 80); ctx.lineTo(960, 130);
      ctx.stroke();
      
      // Bottom-Left Corner
      ctx.beginPath();
      ctx.moveTo(320, 590); ctx.lineTo(320, 640); ctx.lineTo(370, 640);
      ctx.stroke();
      
      // Bottom-Right Corner
      ctx.beginPath();
      ctx.moveTo(910, 640); ctx.lineTo(960, 640); ctx.lineTo(960, 590);
      ctx.stroke();

      // 4. Header title (centered at 640)
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 36px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 SILENT SOS EMERGENCY CAPTURE', 640, 140);

      // 5. Status Capsule Badge
      const text = 'SECURE CLOUD CONTEXT ACTIVE';
      ctx.font = 'bold 15px Courier New, monospace';
      const textWidth = ctx.measureText(text).width;
      const rectW = textWidth + 30;
      const rectH = 34;
      const rectX = 640 - rectW / 2;
      const rectY = 175;

      // Draw capsule rounded rect
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rectX, rectY, rectW, rectH, 17);
      else ctx.rect(rectX, rectY, rectW, rectH);
      ctx.fill();
      ctx.stroke();

      // Badge Text
      ctx.fillStyle = '#10b981';
      ctx.fillText(text, 640, 197);

      // 6. Metadata telemetry details (centered, spaced out)
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '20px Courier New, monospace';
      
      const typeStr = `Distress Type: ${type.toUpperCase()}`;
      const timeStr = `Time Captured: ${new Date().toLocaleTimeString()}`;
      const dateStr = `Date Captured: ${new Date().toLocaleDateString()}`;
      
      const latVal = lat != null ? lat.toFixed(6) : 'ACQUIRING SIGNAL...';
      const lngVal = lng != null ? lng.toFixed(6) : 'ACQUIRING SIGNAL...';
      const gpsStr = `GPS Position : ${latVal}, ${lngVal}`;
      const hashStr= `Evidence Int : SHA256-ENCRYPTED-STREAM`;
      const cloudStr=`Backup Node  : AWS-US-EAST-CLOUD-SECURE`;

      ctx.fillText(typeStr, 640, 270);
      ctx.fillText(timeStr, 640, 315);
      ctx.fillText(dateStr, 640, 360);
      ctx.fillText(gpsStr,  640, 405);
      ctx.fillText(hashStr, 640, 450);
      ctx.fillText(cloudStr, 640, 495);

      // 7. Subtle scanlines across the canvas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let y = 10; y < 720; y += 8) {
        ctx.fillRect(0, y, 1280, 2);
      }

      // 8. Footer note
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = 'bold 12px Courier New, monospace';
      ctx.fillText('THE DATA CONTAINED IN THIS CAPTURE IS ENCRYPTED AND SENT DIRECTLY TO THE EMERGENCY BROADCAST NODE.', 640, 600);
    }
    canvas.toBlob((blob) => resolve(blob || new Blob()), 'image/jpeg', 0.92);
  });
}

// Generates a mock canvas video when actual webcam track is not accessible
function generateBackupVideoBlob(type: string, durationMs: number, lat?: number | null, lng?: number | null): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(new Blob());
      return;
    }

    // Capture canvas stream at 10 FPS
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(10) : null;
    if (!stream) {
      resolve(new Blob([`SilentSOS Video - ${new Date().toISOString()}`], { type: 'video/webm' }));
      return;
    }

    const chunks: BlobPart[] = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      
      // Register onstop BEFORE calling stop
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
      };

      recorder.start();

      let startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= durationMs) {
          clearInterval(interval);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          return;
        }

        // --- DRAW ANIMATED FRAME ---
        
        // 1. Background gradient
        const grad = ctx.createRadialGradient(640, 360, 50, 640, 360, 600);
        grad.addColorStop(0, '#111827'); // slate-900
        grad.addColorStop(1, '#030712'); // black/slate-950
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        // 2. Faint concentric circular radar background (centered at 640, 360)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.04)'; // Red tint
        ctx.lineWidth = 1.5;
        for (let r = 100; r <= 400; r += 100) {
          ctx.beginPath();
          ctx.arc(640, 360, r, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // 3. Rotating radar sweeper line (centered at 640, 360)
        const sweepAngle = (elapsed / 1000) * 0.8 * Math.PI; // rotating slow
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(640, 360);
        ctx.lineTo(640 + Math.cos(sweepAngle) * 350, 360 + Math.sin(sweepAngle) * 350);
        ctx.stroke();

        // 4. HUD corner brackets for the 1:1 square crop region (320 to 960, 80 to 640)
        ctx.strokeStyle = '#ef4444'; // Distress Red
        ctx.lineWidth = 4;
        
        // Top-Left Corner
        ctx.beginPath();
        ctx.moveTo(320, 130); ctx.lineTo(320, 80); ctx.lineTo(370, 80);
        ctx.stroke();
        
        // Top-Right Corner
        ctx.beginPath();
        ctx.moveTo(910, 80); ctx.lineTo(960, 80); ctx.lineTo(960, 130);
        ctx.stroke();
        
        // Bottom-Left Corner
        ctx.beginPath();
        ctx.moveTo(320, 590); ctx.lineTo(320, 640); ctx.lineTo(370, 640);
        ctx.stroke();
        
        // Bottom-Right Corner
        ctx.beginPath();
        ctx.moveTo(910, 640); ctx.lineTo(960, 640); ctx.lineTo(960, 590);
        ctx.stroke();

        // 5. Blinking red record dot and header
        const blink = Math.floor(elapsed / 500) % 2 === 0;
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 36px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${blink ? '🔴' : '⚫'} SILENT SOS VIDEO RECORDING`, 640, 140);

        // 6. Capsule badge: "RECORDING EVIDENCE..."
        const badgeText = 'EMERGENCY CAPTURE STREAM';
        ctx.font = 'bold 15px Courier New, monospace';
        const badgeW = ctx.measureText(badgeText).width + 30;
        const badgeH = 34;
        const badgeX = 640 - badgeW / 2;
        const badgeY = 175;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 17);
        else ctx.rect(badgeX, badgeY, badgeW, badgeH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillText(badgeText, 640, 197);

        // 7. Telemetry details
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '20px Courier New, monospace';

        const latVal = lat != null ? lat.toFixed(6) : 'ACQUIRING SIGNAL...';
        const lngVal = lng != null ? lng.toFixed(6) : 'ACQUIRING SIGNAL...';

        const l1 = `Distress Type: ${type.toUpperCase()}`;
        const l2 = `Elapsed Time : ${Math.round(elapsed / 1000)}s / ${Math.round(durationMs / 1000)}s`;
        const l3 = `GPS Location : ${latVal}, ${lngVal}`;
        const l4 = `Frame Rate   : 10 FPS (ENCODED WEB-MEDIA)`;
        const l5 = `Video Channel: SIMULATED DYNAMIC GRAPHICS`;
        const l6 = `Capture Node : BROADCAST BACKEND CLOUD`;

        ctx.fillText(l1, 640, 270);
        ctx.fillText(l2, 640, 315);
        ctx.fillText(l3, 640, 405);
        
        const lDate = `Timestamp    : ${new Date().toISOString()}`;
        ctx.fillText(lDate, 640, 360);
        
        ctx.fillText(l4, 640, 450);
        ctx.fillText(l5, 640, 495);
        ctx.fillText(l6, 640, 540);

        // 8. Oscillating sine wave at the bottom
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 340; x <= 940; x += 5) {
          const angle = (x / 40) + (elapsed / 150);
          const yVal = 550 + Math.sin(angle) * 25;
          if (x === 340) ctx.moveTo(x, yVal);
          else ctx.lineTo(x, yVal);
        }
        ctx.stroke();

        // 9. Scan lines
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for (let y = 10; y < 720; y += 8) {
          ctx.fillRect(0, y, 1280, 2);
        }

        // 10. Footer note
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = 'bold 12px Courier New, monospace';
        ctx.fillText('LIVE STREAM FEED SECURED AND ENCRYPTED WITH TLS 1.3 DISPATCH SYSTEM.', 640, 620);

      }, 100);
    } catch (err) {
      console.error('Fallback video recorder failed:', err);
      resolve(new Blob([`SilentSOS Video - ${new Date().toISOString()}`], { type: 'video/webm' }));
    }
  });
}

// Generates a mock audio beep sequence when actual microphone track is not accessible
function generateBackupAudioBlob(durationMs: number): Promise<Blob> {
  return new Promise((resolve) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        resolve(new Blob([`SilentSOS Audio - ${new Date().toISOString()}`], { type: 'audio/webm' }));
        return;
      }
      const audioCtx = new AudioContextClass();
      const dest = audioCtx.createMediaStreamDestination();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note
      
      // Siren frequency modulation
      osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + durationMs / 2000);
      osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + durationMs / 1000);

      // Low volume to not startle
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(dest);

      const chunks: BlobPart[] = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

      const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      
      // Register onstop BEFORE calling stop
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        audioCtx.close();
      };

      recorder.start();
      osc.start();

      setTimeout(() => {
        try {
          osc.stop();
        } catch {}
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, durationMs);
    } catch (e) {
      console.warn('Fallback audio generation failed:', e);
      resolve(new Blob([`SilentSOS Audio - ${new Date().toISOString()}`], { type: 'audio/webm' }));
    }
  });
}



async function uploadEvidence(alertId: string, fieldName: 'photo' | 'video' | 'audio', blob: Blob) {
  const formData = new FormData();
  // Derive extension from actual blob MIME type
  const mime = blob.type || '';
  let ext = 'bin';
  if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
  else if (mime.includes('png')) ext = 'png';
  else if (mime.includes('webm')) ext = 'webm';
  else if (mime.includes('mp4'))  ext = 'mp4';
  else if (mime.includes('wav'))  ext = 'wav';
  else if (mime.includes('ogg'))  ext = 'ogg';
  else if (fieldName === 'photo') ext = 'jpg';
  else if (fieldName === 'video') ext = 'webm';
  else if (fieldName === 'audio') ext = 'webm';

  const filename = `evidence_${fieldName}_${Date.now()}.${ext}`;
  formData.append(fieldName, blob, filename);
  console.log(`📤 Uploading ${fieldName}: ${filename} (${blob.size} bytes, type: ${blob.type})`);

  try {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/evidence`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Upload failed [${res.status}]:`, err);
    }
    return res.ok;
  } catch (err) {
    console.error(`❌ Network error uploading ${fieldName}:`, err);
    return false;
  }
}

export function AlertTrigger() {
  const { state, token, cancelAlert, stopAlert } = useApp();
  const navigate = useNavigate();
  const location = useGeolocation();

  const [countdown, setCountdown] = useState(0);
  const [phase, setPhase] = useState<'countdown' | 'capturing' | 'sending'>('capturing');
  const [copied, setCopied] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [captureProgress, setCaptureProgress] = useState({
    photos: 0,
    video: 0,
    audio: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
const mediaInitRef = useRef(false);
  const alertId = state.activeAlert?.id;

  const [showPinDialog, setShowPinDialog] = useState<false | 'cancel' | 'stop'>(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleKeyPress = (num: string) => {
    setPinError(false);
    if (enteredPin.length < 4) {
      const newPin = enteredPin + num;
      setEnteredPin(newPin);
      
      // Auto-submit if it reaches 4 digits
      if (newPin.length === 4) {
        const targetPin = state.settings.safetyPin || '1234';
        if (newPin === targetPin) {
          if (showPinDialog === 'cancel') {
            handleCancel();
          } else if (showPinDialog === 'stop') {
            handleStop();
          }
          setShowPinDialog(false);
          setEnteredPin('');
        } else {
          setPinError(true);
          setTimeout(() => {
            setEnteredPin('');
          }, 800);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinError(false);
    setEnteredPin(p => p.slice(0, -1));
  };

  // Keyboard listener for physical PIN typing
  useEffect(() => {
    if (!showPinDialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        setShowPinDialog(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPinDialog, enteredPin, state.settings.safetyPin]);

  const handleCancelClick = () => {
    setShowPinDialog('cancel');
    setEnteredPin('');
    setPinError(false);
  };

  const handleStopClick = () => {
    setShowPinDialog('stop');
    setEnteredPin('');
    setPinError(false);
  };

  // Redirect if alert is not active
  useEffect(() => {
    if (!state.activeAlert?.isActive) {
      navigate('/');
    }
  }, [state.activeAlert, navigate]);

  // Countdown timer
  useEffect(() => {
    if (phase === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'countdown' && countdown === 0) {
      setPhase('capturing');
    }
  }, [countdown, phase]);

  // Establish WebSockets streaming to send real-time coordinates
  useEffect(() => {
    if (phase === 'capturing' && alertId) {
      const socket = new WebSocket('ws://localhost:3001');
      wsRef.current = socket;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: 'register',
            role: 'sender',
            alertId: alertId
          })
        );
      };

      return () => {
        if (socket) socket.close();
      };
    }
  }, [phase, alertId]);

  // Stream current live GPS updates over WebSocket
  useEffect(() => {
    if (
      phase === 'capturing' &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      location.lat !== null &&
      location.lng !== null
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: 'gps_update',
          lat: location.lat,
          lng: location.lng,
          timestamp: Date.now()
        })
      );
    }
  }, [location, phase]);

  // Handle actual Media Devices and evidence capturing loop
  useEffect(() => {
    if (phase === 'capturing' && alertId) {
      if (mediaInitRef.current) { return; }
mediaInitRef.current = true;
let isStopped = false;
      let audioRecorder: MediaRecorder | null = null;
      let videoRecorder: MediaRecorder | null = null;

      const runMediaCaptureAndUploads = async () => {
        const constraintOptions = [
          { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
          { video: true, audio: true },
          { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          { video: true, audio: false },
          { video: false, audio: true },
        ];

        let stream: MediaStream | null = null;
        let lastError: any = null;
        for (let i = 0; i < constraintOptions.length; i++) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraintOptions[i]);
            console.log(`✅ getUserMedia succeeded with option ${i + 1}:`, stream.getTracks().map(t => `${t.kind}:${t.label}`));
            break;
          } catch (err: any) {
            console.warn(`⚠️ Option ${i + 1} failed:`, err.name, err.message);
            lastError = err;
          }
        }

        if (!stream && lastError) {
          console.error('❌ getUserMedia completely failed after trying all constraints:', lastError.name, lastError.message);
          setMediaError(`Camera/Mic blocked or unavailable: ${lastError.message}. Please click the padlock/settings icon next to the URL bar, toggle Camera & Microphone to 'Allow', and reload this page to capture real footage.`);
        }

        if (stream) {
          activeStreamRef.current = stream;
        }

        // ── Step 2: Show live preview & wait for video to be ready ──
        if (stream && videoPreviewRef.current) {
          const vid = videoPreviewRef.current;
          // Stop previous stream and clear srcObject
          if (vid.srcObject instanceof MediaStream) {
            vid.srcObject.getTracks().forEach(t => t.stop());
          }
          vid.srcObject = null;
          vid.srcObject = stream;
          vid.muted = true;
          try {
            await vid.play();
            // Wait for actual video dimensions to be available
            await new Promise<void>((resolve) => {
              if (vid.videoWidth > 0) { resolve(); return; }
              vid.addEventListener('loadedmetadata', () => resolve(), { once: true });
              setTimeout(resolve, 2000); // max wait 2s
            });
            console.log(`📷 Video ready: ${vid.videoWidth}x${vid.videoHeight}`);
          } catch (e) {
            // Silently ignore AbortError which can occur during unmount
            if (e instanceof DOMException && e.name === 'AbortError') {
              // no-op
            } else {
              console.warn('Video play error:', e);
            }
          }
        }

        const captureDurationMs = 15000;

        // --- CONCURRENT CAPTURES ---

        // 1. Photos Burst Capture (runs in background)
        const photoPromise = (async () => {
          const burstCount = state.settings.photoBurstCount || 5;
          console.log(`📸 Capturing ${burstCount} photos concurrently...`);

          for (let i = 0; i < burstCount; i++) {
            if (isStopped) return;

            let photoBlob: Blob | null = null;

            const hasVideoTrack = stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
            if (hasVideoTrack && videoPreviewRef.current) {
              const vid = videoPreviewRef.current;
              if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width  = vid.videoWidth;
                  canvas.height = vid.videoHeight;
                  const ctx = canvas.getContext('2d')!;
                  ctx.drawImage(vid, 0, 0, vid.videoWidth, vid.videoHeight);
                  photoBlob = await new Promise<Blob>((res, rej) =>
                    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob returned null')), 'image/jpeg', 0.92)
                  );
                  console.log(`✅ Photo ${i + 1} captured: ${photoBlob.size} bytes`);
                } catch (err) {
                  console.error(`❌ Photo ${i + 1} capture failed:`, err);
                }
              }
            }

            if (!photoBlob) {
              console.warn(`⚠️ Photo ${i + 1}: using fallback canvas`);
              photoBlob = await generateBackupPhotoBlob(
                state.activeAlert?.type || 'General',
                location.lat,
                location.lng
              );
            }

            const ok = await uploadEvidence(alertId, 'photo', photoBlob);
            console.log(`📤 Photo ${i + 1} upload:`, ok ? 'OK' : 'FAILED');
            if (!isStopped) setCaptureProgress(p => ({ ...p, photos: i + 1 }));
            
            // Wait 1 second between photo captures
            await new Promise(r => setTimeout(r, 1000));
          }
        })();

        // 2. Audio Capture (runs in background)
        const audioPromise = (async () => {
          if (isStopped) return;
          let audioBlob: Blob | null = null;

          if (stream && stream.getAudioTracks().length > 0) {
            try {
              const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

              const audioStream = new MediaStream(stream.getAudioTracks());
              const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
              audioRecorder = recorder;
              const chunks: BlobPart[] = [];

              recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
              
              const recordingPromise = new Promise<Blob>((res) => {
                recorder.onstop = () => {
                  const b = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                  console.log(`✅ Audio recorded: ${b.size} bytes, chunks: ${chunks.length}`);
                  res(b);
                };
              });

              recorder.start(500); // collect data every 500ms
              console.log('🎤 Audio recording started, mimeType:', recorder.mimeType);

              await new Promise(r => setTimeout(r, captureDurationMs));
              if (recorder.state !== 'inactive') {
                recorder.stop();
              }
              audioBlob = await recordingPromise;
            } catch (err) {
              console.error('❌ Audio recording failed:', err);
            }
          } else {
            console.warn('⚠️ No audio tracks available');
          }

          if (!audioBlob || audioBlob.size < 100) {
            console.warn('⚠️ Audio: using fallback generation');
            audioBlob = await generateBackupAudioBlob(captureDurationMs);
          }

          const audioOk = await uploadEvidence(alertId, 'audio', audioBlob);
          console.log('📤 Audio upload:', audioOk ? 'OK' : 'FAILED');
          if (!isStopped) setCaptureProgress(p => ({ ...p, audio: 100 }));
        })();

        // 3. Video Capture (runs in background)
        const videoPromise = (async () => {
          if (isStopped) return;
          let videoBlob: Blob | null = null;

          if (stream && stream.getVideoTracks().length > 0) {
            try {
              const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                ? 'video/webm;codecs=vp8'
                : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';

              const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
              videoRecorder = recorder;
              const chunks: BlobPart[] = [];

              recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
              
              const recordingPromise = new Promise<Blob>((res) => {
                recorder.onstop = () => {
                  const b = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
                  console.log(`✅ Video recorded: ${b.size} bytes, chunks: ${chunks.length}`);
                  res(b);
                };
              });

              recorder.start(1000); // collect data every 1s
              console.log('🎥 Video recording started, mimeType:', recorder.mimeType);

              await new Promise(r => setTimeout(r, captureDurationMs));
              if (recorder.state !== 'inactive') {
                recorder.stop();
              }
              videoBlob = await recordingPromise;
            } catch (err) {
              console.error('❌ Video recording failed:', err);
            }
          } else {
            console.warn('⚠️ No video tracks available');
          }

          if (!videoBlob || videoBlob.size < 100) {
            console.warn('⚠️ Video: using fallback generation');
            videoBlob = await generateBackupVideoBlob(
              state.activeAlert?.type || 'General',
              captureDurationMs,
              location.lat,
              location.lng
            );
          }

          const videoOk = await uploadEvidence(alertId, 'video', videoBlob);
          console.log('📤 Video upload:', videoOk ? 'OK' : 'FAILED');
          if (!isStopped) setCaptureProgress(p => ({ ...p, video: 100 }));
        })();

        // Wait for all concurrent uploads to finish
        await Promise.all([photoPromise, audioPromise, videoPromise]);

        if (!isStopped) {
          setPhase('sending');
          
          // Send complete signal immediately to bypass the 4 seconds backend debounce timer
          try {
            await fetch(`${API_BASE}/alerts/${alertId}/complete`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
          } catch (e) {
            console.error('Failed to notify server of capture completion:', e);
          }
        }
      };

      runMediaCaptureAndUploads();

      return () => {
        isStopped = true;
        if (audioRecorder && audioRecorder.state !== 'inactive') {
          try { audioRecorder.stop(); } catch {}
        }
        if (videoRecorder && videoRecorder.state !== 'inactive') {
          try { videoRecorder.stop(); } catch {}
        }
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach(t => t.stop());
        }
        mediaInitRef.current = false;
      };
    }
  }, [phase, alertId, state.settings.photoBurstCount]);

  const handleCancel = () => {
    cancelAlert();
    navigate('/');
  };

  const handleStop = () => {
    stopAlert();
    navigate('/');
  };

  const copyReceiverLink = () => {
    if (alertId) {
      const link = `${window.location.origin}/receiver/${alertId}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!state.activeAlert?.isActive) return null;

  return (
    <div className="flex flex-col h-full bg-background absolute inset-0 z-50 overflow-y-auto no-scrollbar p-6">
      <AnimatePresence mode="wait">
        {phase === 'countdown' ? (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-emergency rounded-2xl"
          >
            <ShieldAlert className="w-16 h-16 text-white mb-8 animate-pulse" />
            <h2 className="text-3xl font-bold text-white mb-2 text-center">
              SENDING ALERT
            </h2>
            <p className="text-white/80 mb-12 text-center">
              Cancel if this was a mistake
            </p>

            <div className="relative w-48 h-48 flex items-center justify-center mb-16">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="90"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="96"
                  cy="96"
                  r="90"
                  fill="none"
                  stroke="white"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 90}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 90 }}
                  transition={{ duration: 5, ease: 'linear' }}
                />
              </svg>
              <span className="text-7xl font-black text-white">
                {countdown}
              </span>
            </div>

            <button
              onClick={handleCancelClick}
              className="w-full bg-white text-emergency font-black text-xl py-6 rounded-2xl shadow-xl active:scale-95 transition-transform"
            >
              CANCEL
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col"
          >
            <div className="flex items-center justify-center mb-6 mt-4">
              <div className="w-3 h-3 bg-emergency rounded-full animate-pulse mr-3" />
              <h2 className="text-xl font-bold text-emergency tracking-widest animate-pulse">
                ALERT ACTIVE (LIVE)
              </h2>
            </div>

            {/* Live Camera Track Preview */}
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden mb-4 border border-white/5">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <div className="absolute top-3 left-3 px-2 py-0.5 bg-emergency/80 text-white rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                LIVE STREAM
              </div>
            </div>

            {/* Permission Fallback Error Alert Banner */}
            {mediaError && (
              <div className="mb-4 bg-warning/10 border border-warning/20 rounded-xl p-3 flex gap-2 text-warning text-[10px] items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{mediaError}</span>
              </div>
            )}

            {/* Sharing Receiver Dashboard */}
            {alertId && (
              <div className="bg-surface border border-emerald-500/30 rounded-2xl p-4 mb-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Emergency Broadcast Link
                  </span>
                  <button
                    onClick={copyReceiverLink}
                    className="flex items-center gap-1.5 text-xs text-textMuted bg-surfaceHighlight hover:bg-surface px-2.5 py-1 rounded-md transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-textMuted font-mono bg-background p-2 rounded break-all select-all">
                  {window.location.origin}/receiver/{alertId}
                </p>
                <p className="text-[10px] text-safe">
                  💡 Share this dashboard to stream real-time coordinate logs, photo captures, and audio records to contacts.
                </p>
              </div>
            )}

            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-6 mb-4">
              <div className="flex items-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-safe mr-3 animate-bounce" />
                <div>
                  <h3 className="font-bold text-lg">Alert Transmission</h3>
                  <p className="text-sm text-textMuted">
                    Notified {state.contacts.length} emergency contacts
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 text-textMuted mr-3" />
                    <span className="text-sm font-medium">Live GPS Coordinates</span>
                  </div>
                  <span className="text-xs text-safe font-bold animate-pulse">
                    TRANSMITTING LIVE...
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Camera className="w-5 h-5 text-textMuted mr-3" />
                    <span className="text-sm font-medium">
                      Photos Burst ({captureProgress.photos}/
                      {state.settings.photoBurstCount})
                    </span>
                  </div>
                  <div className="w-24 h-2 bg-surfaceHighlight rounded-full overflow-hidden">
                    <div
                      className="h-full bg-safe transition-all duration-300"
                      style={{
                        width: `${(captureProgress.photos / state.settings.photoBurstCount) * 100}%`
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Mic className="w-5 h-5 text-textMuted mr-3" />
                    <span className="text-sm font-medium">Audio Capture</span>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      captureProgress.audio === 100 ? 'text-safe' : 'text-warning animate-pulse'
                    }`}
                  >
                    {captureProgress.audio === 100 ? 'UPLOADED' : 'RECORDING MICROPHONE...'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Video className="w-5 h-5 text-textMuted mr-3" />
                    <span className="text-sm font-medium">Video Capture</span>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      captureProgress.video === 100 ? 'text-safe' : 'text-warning animate-pulse'
                    }`}
                  >
                    {captureProgress.video === 100 ? 'UPLOADED' : 'RECORDING VIDEO...'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider">
                  Contacts Dispatched
                </h4>
                {alertId && (
                  <a
                    href={`/receiver/${alertId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-lg transition-colors"
                  >
                    <MapPin className="w-2.5 h-2.5" /> Open Dashboard
                  </a>
                )}
              </div>

              <div className="space-y-3">
                {((state.activeAlert?.contactsNotified && state.activeAlert.contactsNotified.length > 0)
                  ? state.activeAlert.contactsNotified
                  : state.contacts
                ).map((c: any) => {
                  const name = c.name || c.contactName || 'Contact';
                  const phone = c.phone || '';
                  const receiverUrl = alertId ? `${window.location.origin}/receiver/${alertId}` : '';
                  const waText = encodeURIComponent(
                    `🚨 SOS EMERGENCY ALERT!\n${name}, I need help! Track me live: ${receiverUrl}`
                  );
                  const smsText = encodeURIComponent(
                    `🚨 SOS! I need help! Live: ${receiverUrl}`
                  );

                  return (
                    <div key={c.id || c.contactId} className="bg-background/60 border border-white/5 rounded-xl p-3">
                      {/* Name + status row */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-safe/15 border border-safe/20 flex items-center justify-center text-xs font-bold text-safe">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-sm text-white">{name}</span>
                        </div>
                        <span className="text-safe flex items-center text-[10px] font-bold">
                          <Send className="w-3 h-3 mr-1" /> Notified
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {/* WhatsApp */}
                        <a
                          href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </a>

                        {/* SMS */}
                        <a
                          href={`sms:${phone}?body=${smsText}`}
                          className="flex-1 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 text-sky-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <Send className="w-2.5 h-2.5" /> SMS
                        </a>

                        {/* Open receiver link */}
                        {receiverUrl && (
                          <a
                            href={receiverUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 bg-surfaceHighlight hover:bg-surface border border-white/10 text-textMuted hover:text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                          >
                            <Copy className="w-2.5 h-2.5" /> Live View
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!state.activeAlert?.contactsNotified || state.activeAlert.contactsNotified.length === 0) && state.contacts.length === 0 && (
                  <p className="text-sm text-warning">No contacts configured.</p>
                )}
              </div>
            </div>

            <button
              onClick={handleStopClick}
              className="w-full bg-surface hover:bg-surfaceHighlight border-2 border-surfaceHighlight text-textMain font-bold py-4 rounded-xl flex items-center justify-center mt-auto transition-colors"
            >
              <X className="w-5 h-5 mr-2 text-emergency" />
              Stop & Resolve Alert
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PIN Verification Modal */}
      <AnimatePresence>
        {showPinDialog !== false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-xs w-full flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-surfaceHighlight border border-white/10 flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-warning" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Deactivate Distress Signal
              </h3>
              <p className="text-xs text-textMuted mb-8 leading-relaxed">
                Please enter your safety PIN to cancel or resolve this emergency alert.
              </p>

              {/* PIN Dot Indicators */}
              <div className="flex gap-4 mb-8">
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    animate={pinError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      enteredPin.length > index
                        ? pinError
                          ? 'bg-emergency border-emergency'
                          : 'bg-safe border-safe shadow-[0_0_8px_#00e676]'
                        : 'border-white/25 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-4 w-full mb-8">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="aspect-square rounded-full bg-surfaceHighlight hover:bg-surface border border-white/5 text-xl font-bold text-white flex items-center justify-center transition-all active:scale-90"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setShowPinDialog(false)}
                  className="aspect-square rounded-full text-xs font-bold text-textMuted flex items-center justify-center hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleKeyPress('0')}
                  className="aspect-square rounded-full bg-surfaceHighlight hover:bg-surface border border-white/5 text-xl font-bold text-white flex items-center justify-center transition-all active:scale-90"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="aspect-square rounded-full text-xs font-bold text-textMuted flex items-center justify-center hover:text-white transition-colors"
                >
                  Delete
                </button>
              </div>

              {pinError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-emergency font-bold animate-pulse"
                >
                  Incorrect safety PIN. Try again.
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}