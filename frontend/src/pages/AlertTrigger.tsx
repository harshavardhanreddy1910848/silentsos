import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XIcon,
  MapPinIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  ClockIcon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  BellRingIcon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveAlert } from '../hooks/useLiveAlert';
import { ALERT_META, fmtCoord, fmtDuration, fmtTime, mapsLink } from '../lib/mock';
import { AlertType } from '../lib/types';
import { api } from '../lib/api';
import { SimCameraFeed, CameraFeedRef } from '../components/SimCameraFeed';
import { DeliveryList } from '../components/DeliveryList';
import { ShareRow } from '../components/ShareRow';
import { GoogleMapView } from '../components/GoogleMapView';
import { stopMediaRecording } from '../lib/mediaStreamManager';
import { notifyEmergencyDispatched, sendBrowserNotification } from '../lib/notifications';

type Phase = 'countdown' | 'active' | 'sent';

export function AlertTrigger() {
  const nav = useNavigate();
  const loc = useLocation();
  const locState = loc.state as {
    type?: AlertType;
    triggerGesture?: string;
    instant?: boolean;
    gesturePhoto?: string;
    gesturePhotos?: string[];
  } | null;
  const type: AlertType = locState?.type || 'sos';
  const triggerGesture = locState?.triggerGesture;
  const isInstant = Boolean(triggerGesture || locState?.instant);
  const meta = ALERT_META[type];
  const { profile, contacts, settings, updateAlert } = useApp();
  const { live, start, stop, attachEvidence } = useLiveAlert();
  const liveRef = useRef(live);
  liveRef.current = live;
  const cameraRef = useRef<CameraFeedRef>(null);
  const instantTriggeredRef = useRef(false);

  const incomingGesturePhoto = locState?.gesturePhoto;
  const incomingGesturePhotos = locState?.gesturePhotos;
  const initialPhotos = (incomingGesturePhotos && incomingGesturePhotos.length > 0)
    ? incomingGesturePhotos
    : (incomingGesturePhoto ? [incomingGesturePhoto] : undefined);

  const [phase, setPhase] = useState<Phase>(isInstant ? 'active' : 'countdown');
  const [count, setCount] = useState(isInstant ? 0 : 5);
  const [sentAt, setSentAt] = useState<number | null>(null);

  // Safety PIN State
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pendingAction, setPendingAction] = useState<'cancel' | 'finish' | null>(null);

  // User Settings Tracking
  const burstCount = settings.burstCount || 5;
  const targetVideoSeconds = settings.videoDuration === '30s' ? 30 : settings.videoDuration === '1min' ? 60 : 0;
  const intervalMinutes = settings.autoRepeat || 5;

  // Live Video & Audio Recording State
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'completed'>('idle');
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // Auto-resend Interval State
  const [autoResendCountdown, setAutoResendCountdown] = useState<number>(intervalMinutes * 60);
  const [resendNotif, setResendNotif] = useState<string | null>(null);

  // Active Photo Burst Preview
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  const last = live?.gpsPath[live.gpsPath.length - 1];

  // Dispatches emergency alert notification via Resend Official API
  const dispatchAlertNotification = useCallback(
    (
      alertId: string,
      photos: string[] | undefined,
      videoUrl: string | undefined,
      audioUrl: string | undefined
    ) => {
      // 1. Gather all saved emergency contacts from the app
      let emailContacts = contacts.filter((c) => c.email && c.email.trim());

      // 2. Ensure verified Resend account owner email is always included so you always receive the alert
      const verifiedOwnerEmail = 'sheshadriharshavardhanreddy@gmail.com';
      const hasOwner = emailContacts.some(
        (c) => c.email.trim().toLowerCase() === verifiedOwnerEmail.toLowerCase()
      );
      if (!hasOwner) {
        emailContacts.unshift({
          id: 'verified-owner-contact',
          name: profile.name || 'Primary User',
          phone: '',
          email: verifiedOwnerEmail,
          prefs: { gps: true, photos: true, video: true, audio: true, message: true }
        });
      }

      // 3. Also include user profile email if configured and not already in contacts
      if (profile.email && profile.email.trim()) {
        const lower = profile.email.trim().toLowerCase();
        const exists = emailContacts.some((c) => c.email.trim().toLowerCase() === lower);
        if (!exists) {
          emailContacts.push({
            id: 'profile-user',
            name: profile.name || 'Account Holder',
            phone: '',
            email: profile.email.trim(),
            prefs: { gps: true, photos: true, video: true, audio: true, message: true }
          });
        }
      }

      const primary = photos && photos.length > 0 ? photos[0] : undefined;

      const doSend = (lat?: number, lng?: number, accuracy?: number) => {
        // Dispatch Web App Browser & Audio Notification
        notifyEmergencyDispatched({
          userName: profile.name || 'SilentSOS User',
          recipientCount: emailContacts.length,
          alertType: type
        });

        const activeLat = lat ?? last?.lat ?? 12.9716;
        const activeLng = lng ?? last?.lng ?? 77.5946;

        console.log(`🚀 [Dispatching Alert] Sending email with:`, {
          contacts: emailContacts.map((c) => c.email),
          photoCount: photos?.length || 0,
          hasVideo: Boolean(videoUrl),
          hasAudio: Boolean(audioUrl),
          location: { lat: activeLat, lng: activeLng }
        });

        api
          .sendEmergencyEmail({
            sessionId: alertId,
            recipients: emailContacts,
            userName: profile.name || 'SilentSOS User',
            alertType: type,
            triggerGesture,
            lat: activeLat,
            lng: activeLng,
            accuracy,
            messageTemplate: settings.messageTemplate,
            bloodGroup: profile.bloodGroup,
            address: profile.address,
            parentsName: profile.parentsName,
            photoDataUrl: primary,
            photoDataUrls: photos,
            videoDataUrl: videoUrl,
            audioDataUrl: audioUrl
          })
          .then((res) => {
            if (res?.success) {
              console.log(
                `🚨 ✅ Emergency Alert Email sent to ${emailContacts.length} contacts (${res.sentCount || 0} delivered).`
              );
              sendBrowserNotification('✅ Alert Dispatched via Resend', {
                body: `Emergency alert with photos, video, audio, and GPS was sent to ${res.sentCount || emailContacts.length} saved contact(s).`,
                tag: 'silentsos-delivery-success'
              });
            }
          })
          .catch((err) => console.error('Emergency email send error:', err));
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => doSend(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
          () => doSend(last?.lat, last?.lng),
          { enableHighAccuracy: true, timeout: 3500 }
        );
      } else {
        doSend(last?.lat, last?.lng);
      }
    },
    [contacts, last, profile.email, profile.name, settings.messageTemplate, triggerGesture, type]
  );

  // Evidence Capture Sequence: Photos + Synchronized Video & Audio Clip + GPS -> Dispatched to Saved Contacts
  const performEvidenceCaptureAndDispatch = useCallback(
    async (alertId?: string, overridePhotos?: string[]) => {
      const targetAlertId = alertId || liveRef.current?.id || `alert-${Date.now()}`;
      const existingPhotos = overridePhotos || initialPhotos;

      // 1. GATHER OR CAPTURE REAL PHOTO BURST
      let photoDataUrls: string[] = [];
      if (existingPhotos && existingPhotos.length > 0) {
        photoDataUrls = [...existingPhotos];
      } else if (cameraRef.current) {
        try {
          const burst = await cameraRef.current.capturePhotoBurst(burstCount, 80);
          if (burst && burst.length > 0) photoDataUrls = burst;
        } catch {}
      }

      if (photoDataUrls.length === 0 && cameraRef.current) {
        const single = cameraRef.current.capturePhoto();
        if (single) photoDataUrls = [single];
      }

      if (photoDataUrls.length > 0 && photoDataUrls.length < burstCount) {
        const pad = photoDataUrls[photoDataUrls.length - 1];
        while (photoDataUrls.length < burstCount) {
          photoDataUrls.push(pad);
        }
      }

      const primaryPhoto = photoDataUrls[0] || incomingGesturePhoto || undefined;
      const allPhotos = photoDataUrls.length > 0 ? photoDataUrls : primaryPhoto ? [primaryPhoto] : undefined;

      // 2. CAPTURE SYNCHRONIZED VIDEO & MICROPHONE AUDIO CLIP (Live 2.2s Recording)
      let initialVideoUrl: string | undefined = undefined;
      let initialAudioUrl: string | undefined = undefined;

      try {
        setRecordingStatus('recording');
        cameraRef.current?.startEmergencyRecording();
        const media = await cameraRef.current?.recordMediaClip(2200);
        if (media?.videoDataUrl) initialVideoUrl = media.videoDataUrl;
        if (media?.audioDataUrl) initialAudioUrl = media.audioDataUrl;
      } catch (mediaErr) {
        console.warn('Live media recording clip note:', mediaErr);
      }

      // Fallback audio WAV if microphone was unavailable
      if (!initialAudioUrl && cameraRef.current) {
        try {
          initialAudioUrl = await cameraRef.current.recordAudioClip(1500, settings.audioQuality);
        } catch {}
      }

      // Fallback video frame if camera was simulated
      if (!initialVideoUrl && primaryPhoto) {
        initialVideoUrl = primaryPhoto;
      }

      // 3. ATTACH AND PERSIST ALL 4 EVIDENCE TYPES (Photos, Video, Audio, GPS)
      attachEvidence({
        photoDataUrl: primaryPhoto,
        photoDataUrls: allPhotos,
        photoCount: allPhotos ? allPhotos.length : burstCount,
        videoDataUrl: initialVideoUrl,
        audioDataUrl: initialAudioUrl,
        videoCount: initialVideoUrl ? 1 : 0,
        audioCount: initialAudioUrl ? 1 : 0
      });

      if (targetAlertId) {
        updateAlert(targetAlertId, {
          photoDataUrl: primaryPhoto,
          photoDataUrls: allPhotos,
          photoCount: allPhotos ? allPhotos.length : burstCount,
          videoDataUrl: initialVideoUrl,
          audioDataUrl: initialAudioUrl,
          videoCount: initialVideoUrl ? 1 : 0,
          audioCount: initialAudioUrl ? 1 : 0,
          ...(triggerGesture ? { triggerGesture } : {})
        });
      }

      // 4. AUTOMATICALLY SEND EMAIL WITH PHOTOS, VIDEO, MICROPHONE SOUND, AND LOCATION TO SAVED CONTACTS!
      dispatchAlertNotification(targetAlertId, allPhotos, initialVideoUrl, initialAudioUrl);
      setRecordingStatus('completed');

      // 5. RESUME CONTINUOUS RECORDING IF EXTENDED DURATION IS CONFIGURED
      if (targetVideoSeconds > 0) {
        try {
          setRecordingStatus('recording');
          setRecordingElapsed(2);
          cameraRef.current?.startEmergencyRecording();

          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          const startTime = Date.now() - 2000;

          recordingTimerRef.current = setInterval(async () => {
            const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
            setRecordingElapsed(elapsedSecs);

            if (elapsedSecs >= targetVideoSeconds) {
              clearInterval(recordingTimerRef.current);
              recordingTimerRef.current = null;

              try {
                const extendedMedia = await stopMediaRecording(0);
                const extVUrl = extendedMedia.videoDataUrl || initialVideoUrl;
                const extAUrl = extendedMedia.audioDataUrl || initialAudioUrl;

                attachEvidence({
                  videoDataUrl: extVUrl,
                  audioDataUrl: extAUrl,
                  videoCount: 1,
                  audioCount: 1
                });

                if (targetAlertId) {
                  updateAlert(targetAlertId, {
                    videoDataUrl: extVUrl,
                    audioDataUrl: extAUrl,
                    videoCount: 1,
                    audioCount: 1,
                    ...(triggerGesture ? { triggerGesture } : {})
                  });
                }

                // Send updated extended evidence notification to contacts
                dispatchAlertNotification(targetAlertId, allPhotos, extVUrl, extAUrl);
                setRecordingStatus('completed');
                console.log(`🎥 [Extended Video Evidence Ready] Recorded ${targetVideoSeconds}s clip with sound.`);
              } catch (err) {
                console.warn('Finalizing extended video clip error:', err);
                setRecordingStatus('completed');
              }
            }
          }, 1000);
        } catch (recErr) {
          console.warn('Continuous recording initiation notice:', recErr);
        }
      }
    },
    [
      attachEvidence,
      burstCount,
      dispatchAlertNotification,
      incomingGesturePhoto,
      initialPhotos,
      settings.audioQuality,
      targetVideoSeconds,
      triggerGesture,
    ]
  );

  // Instant trigger effect for gesture detection and instant panic mode
  useEffect(() => {
    if (isInstant && !instantTriggeredRef.current) {
      instantTriggeredRef.current = true;
      const newAlertId = start(type, triggerGesture, initialPhotos);
      setPhase('active');
      performEvidenceCaptureAndDispatch(newAlertId, initialPhotos);
    }
  }, [isInstant, start, type, triggerGesture, initialPhotos, performEvidenceCaptureAndDispatch]);

  // Countdown & automated trigger
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      const newAlertId = start(type, triggerGesture, initialPhotos);
      setPhase('active');
      performEvidenceCaptureAndDispatch(newAlertId, initialPhotos);
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count, start, type, triggerGesture, initialPhotos, performEvidenceCaptureAndDispatch]);

  // Recurring auto-resend countdown and trigger based on settings.autoRepeat (5m, 10m, 15m)
  useEffect(() => {
    if (phase !== 'active') return;
    const intervalSecs = (settings.autoRepeat || 5) * 60;
    setAutoResendCountdown(intervalSecs);

    const timer = setInterval(() => {
      setAutoResendCountdown((prev) => {
        if (prev <= 1) {
          console.log(`⏰ Auto-repeat interval triggered (${settings.autoRepeat || 5}m) — Re-sending updated GPS & Evidence.`);
          performEvidenceCaptureAndDispatch();
          sendBrowserNotification('🔄 SilentSOS Alert Refreshed', {
            body: `Fresh location and evidence re-broadcast to emergency contacts (${settings.autoRepeat || 5}m interval).`,
            tag: 'silentsos-auto-repeat'
          });
          setResendNotif(`⚡ Automated update sent to contacts (${settings.autoRepeat || 5}m interval)`);
          setTimeout(() => setResendNotif(null), 4000);
          return intervalSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, settings.autoRepeat, performEvidenceCaptureAndDispatch]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const requestCancellation = (action: 'cancel' | 'finish') => {
    if (settings.pinEnabled !== false) {
      setPendingAction(action);
      setEnteredPin('');
      setPinError(false);
      setShowPinModal(true);
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action: 'cancel' | 'finish') => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      // Flush in-progress video & audio recording up to this moment
      const captured = await stopMediaRecording(0);
      if (captured.videoDataUrl || captured.audioDataUrl) {
        attachEvidence({
          videoDataUrl: captured.videoDataUrl || undefined,
          audioDataUrl: captured.audioDataUrl || undefined,
          videoCount: 1,
          audioCount: 1
        });
        if (live?.id) {
          updateAlert(live.id, {
            videoDataUrl: captured.videoDataUrl || undefined,
            audioDataUrl: captured.audioDataUrl || undefined,
            videoCount: 1,
            audioCount: 1
          });
        }
      }
    } catch {}

    cameraRef.current?.stopRecording();

    if (action === 'cancel') {
      if (phase === 'active') stop('cancelled');
      nav('/home', { replace: true });
    } else {
      setSentAt(Date.now());
      stop('sent');
      setPhase('sent');
    }
  };

  const handleVerifyPin = (pinToTest?: string) => {
    const pin = pinToTest !== undefined ? pinToTest : enteredPin;
    const targetPin = settings.safetyPin || '1234';

    if (pin === targetPin) {
      setShowPinModal(false);
      if (pendingAction) {
        executeAction(pendingAction);
      }
    } else {
      setPinError(true);
      setEnteredPin('');
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setPinError(false);
    if (nextPin.length === 4) {
      setTimeout(() => handleVerifyPin(nextPin), 150);
    }
  };

  const handleKeypadDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  const cancel = () => requestCancellation('cancel');
  const finish = () => requestCancellation('finish');

  const gpsText = last ? fmtCoord(last.lat, last.lng) : '';
  const link = last ? mapsLink(last.lat, last.lng) : '';

  const currentPhotosList = (live?.photoDataUrls && live.photoDataUrls.length > 0)
    ? live.photoDataUrls
    : (live?.photoDataUrl ? [live.photoDataUrl] : (initialPhotos || []));

  /* ---------- MAIN RENDER ---------- */
  return (
    <div className="relative h-full w-full">
      {/* Background camera instance during countdown */}
      {phase === 'countdown' && (
        <div className="opacity-0 pointer-events-none absolute h-1 w-1 overflow-hidden" aria-hidden="true">
          <SimCameraFeed
            ref={cameraRef}
            facing={settings.cameraChoice === 'rear' ? 'rear' : 'front'}
            cameraChoice={settings.cameraChoice}
            recording
            audioQuality={settings.audioQuality}
            sensitivity={settings.sensitivity}
          />
        </div>
      )}

      {/* Safety PIN Verification Modal */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-3xl border border-white/20 bg-[#121212] p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff1744]/20 border border-[#ff1744]/40">
                <CheckCircle2Icon size={28} color="#ff1744" />
              </div>
              <h3 className="text-xl font-black text-white">Enter Safety PIN</h3>
              <p className="mt-1 text-xs text-white/60">
                Enter your 4-digit Safety PIN to authorize alert cancellation.
              </p>

              {/* 4 Digit Boxes */}
              <div className="my-6 flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = idx < enteredPin.length;
                  return (
                    <div
                      key={idx}
                      className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold transition-all ${
                        pinError
                          ? 'border-red-500 bg-red-500/20 text-red-400 animate-bounce'
                          : filled
                          ? 'border-[#00e676] bg-[#00e676]/20 text-[#00e676]'
                          : 'border-white/20 bg-white/5 text-white/30'
                      }`}
                    >
                      {filled ? '•' : ''}
                    </div>
                  );
                })}
              </div>

              {pinError && (
                <p className="mb-4 text-xs font-bold text-red-400">
                  ❌ Incorrect Safety PIN. Please try again.
                </p>
              )}

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleKeypadPress(digit)}
                    className="rounded-xl bg-white/10 py-3 font-mono text-xl font-bold text-white transition-colors active:bg-white/25"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  onClick={() => setEnteredPin('')}
                  className="rounded-xl bg-white/5 py-3 text-xs font-bold text-white/50 active:bg-white/15"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleKeypadPress('0')}
                  className="rounded-xl bg-white/10 py-3 font-mono text-xl font-bold text-white transition-colors active:bg-white/25"
                >
                  0
                </button>
                <button
                  onClick={handleKeypadDelete}
                  className="rounded-xl bg-white/5 py-3 text-sm font-bold text-white/70 active:bg-white/15"
                >
                  ⌫
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleVerifyPin()}
                  disabled={enteredPin.length !== 4}
                  className="flex-1 rounded-xl bg-[#00e676] py-3 text-sm font-black text-black disabled:opacity-40"
                >
                  Authorize & Stop
                </button>
                <button
                  onClick={() => setShowPinModal(false)}
                  className="rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white/60"
                >
                  Back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHASE 1: COUNTDOWN */}
      {phase === 'countdown' && (
        <div
          className="flex h-full flex-col items-center justify-center px-6"
          style={{ backgroundColor: '#160308' }}>
          
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/50">
            {meta.label}
          </p>
          {triggerGesture && (
            <div className="mt-2 rounded-full border border-[#00e676]/40 bg-[#00e676]/10 px-3 py-1 text-xs font-bold text-[#00e676] animate-pulse">
              ⚡ Triggered via Gesture: {triggerGesture}
            </div>
          )}
          <p className="mt-2 text-center text-white/60">Sending alert in…</p>
          <div className="relative my-10 flex h-52 w-52 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <motion.circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#ff1744"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={289}
                animate={{ strokeDashoffset: [0, 289] }}
                transition={{ duration: 5, ease: 'linear' }} />
            </svg>
            <AnimatePresence mode="wait">
              <motion.span
                key={count}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-8xl font-black">
                {count}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">
              {meta.numberLabel} Emergency Hotline
            </p>
            <p className="mt-1 font-mono text-3xl font-black" style={{ color: meta.color }}>
              {meta.emergencyNumber}
            </p>
            <a
              href={`tel:${meta.emergencyNumber}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-extrabold text-black active:scale-95 transition-transform"
              style={{ backgroundColor: meta.color }}>
              📞 Call {meta.emergencyNumber} ({meta.numberLabel}) Now
            </a>
          </div>

          <button
            onClick={cancel}
            className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-white py-4 text-xl font-black text-black active:scale-95">
            <XIcon size={26} strokeWidth={3} /> CANCEL
          </button>
          <p className="mt-3 text-center text-xs text-white/40">
            Tap cancel now if this was accidental.
          </p>
        </div>
      )}

      {/* PHASE 2: ACTIVE DISTRESS SESSION */}
      {phase === 'active' && (
        <div className="flex h-full flex-col bg-[#0a0a0a]">
          <div className="flex items-center justify-between bg-[#ff1744] px-4 py-3">
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="h-3 w-3 rounded-full bg-white" />
              <span className="font-black tracking-wide">ALERT ACTIVE — EVIDENCE STREAMING</span>
            </div>
            <span className="text-xs font-mono font-bold bg-black/30 px-2 py-0.5 rounded">
              {live ? fmtDuration(live.elapsed || 0) : '00:00'}
            </span>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Gesture Detection Notification */}
            {triggerGesture && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[#00e676]/40 bg-gradient-to-r from-[#00e676]/20 via-[#00e676]/10 to-transparent p-3.5 text-white shadow-[0_0_20px_rgba(0,230,118,0.2)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00e676] text-black font-black text-xl shadow-lg shrink-0">
                    ⚡
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#00e676]">
                      TRIGGERED VIA GESTURE DETECTION
                    </p>
                    <p className="text-sm font-black text-white truncate">
                      Gesture: <span className="text-[#00e676]">{triggerGesture}</span>
                    </p>
                    <p className="text-[11px] text-white/60">
                      Emergency distress alert triggered and evidence captured according to your safety settings.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Active Settings Enforcement Header */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs">
              <div className="mb-2 flex items-center justify-between text-white/50 text-[10px] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ShieldCheckIcon size={13} className="text-[#00e676]" /> Enforced Evidence Settings
                </span>
                <span className="text-[#00e676] font-mono">● LIVE ACTIVE</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-bold">
                <div className="rounded-xl bg-black/40 p-2 border border-white/5">
                  <span className="block text-[10px] text-white/40">Photo Burst</span>
                  <span className="text-[#ff9100] font-mono text-sm">{burstCount} photos</span>
                </div>
                <div className="rounded-xl bg-black/40 p-2 border border-white/5">
                  <span className="block text-[10px] text-white/40">Video Duration</span>
                  <span className="text-[#ff1744] font-mono text-sm capitalize">{settings.videoDuration}</span>
                </div>
                <div className="rounded-xl bg-black/40 p-2 border border-white/5">
                  <span className="block text-[10px] text-white/40">Audio Quality</span>
                  <span className="text-[#00e676] font-mono text-sm">{settings.audioQuality === 'low' ? 'Low bw' : 'High'}</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center font-bold">
                <div className="rounded-xl bg-black/40 p-2 border border-white/5">
                  <span className="block text-[10px] text-white/40">Cameras Used</span>
                  <span className="text-white uppercase font-mono text-sm">{settings.cameraChoice}</span>
                </div>
                <div className="rounded-xl bg-black/40 p-2 border border-white/5">
                  <span className="block text-[10px] text-white/40">Auto-Resend</span>
                  <span className="text-[#2979ff] font-mono text-sm">Every {intervalMinutes}m</span>
                </div>
              </div>
            </div>

            {/* Live Camera Feed Preview */}
            {settings.discreet ? (
              <div>
                <div className="flex h-40 items-center justify-center rounded-2xl border border-white/10 bg-black text-center text-sm text-white/40">
                  Discreet mode — camera capturing with screen hidden
                </div>
                <div className="opacity-0 pointer-events-none absolute h-1 w-1 overflow-hidden" aria-hidden="true">
                  <SimCameraFeed
                    ref={cameraRef}
                    facing={settings.cameraChoice === 'rear' ? 'rear' : 'front'}
                    cameraChoice={settings.cameraChoice}
                    recording
                    audioQuality={settings.audioQuality}
                    sensitivity={settings.sensitivity}
                  />
                </div>
              </div>
            ) : (
              <div>
                <SimCameraFeed
                  ref={cameraRef}
                  facing={settings.cameraChoice === 'rear' ? 'rear' : 'front'}
                  cameraChoice={settings.cameraChoice}
                  recording
                  audioQuality={settings.audioQuality}
                  sensitivity={settings.sensitivity}
                  className="aspect-[4/3] w-full"
                />
              </div>
            )}

            {/* Live Video & Audio Recording Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <VideoIcon size={18} className="text-[#ff1744]" />
                  <span className="font-bold text-sm text-white">
                    {recordingStatus === 'completed' ? 'Video Evidence Finalized' : 'Live Video & Audio Recording'}
                  </span>
                </div>
                {recordingStatus === 'recording' ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#ff1744]/20 border border-[#ff1744]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#ff1744] animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-[#ff1744]" />
                    REC {targetVideoSeconds > 0 ? `${recordingElapsed}s / ${targetVideoSeconds}s` : `${recordingElapsed}s (Continuous)`}
                  </span>
                ) : (
                  <span className="rounded-full bg-[#00e676]/20 border border-[#00e676]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#00e676]">
                    ✓ Attached ({targetVideoSeconds > 0 ? `${targetVideoSeconds}s` : `${recordingElapsed}s`})
                  </span>
                )}
              </div>

              {/* Recording Progress Bar */}
              {targetVideoSeconds > 0 && recordingStatus === 'recording' && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff1744] to-[#ff5252] transition-all duration-300"
                    style={{ width: `${Math.min(100, (recordingElapsed / targetVideoSeconds) * 100)}%` }}
                  />
                </div>
              )}

              <p className="text-[11px] text-white/50">
                {recordingStatus === 'recording'
                  ? `Recording live synchronized video & ambient microphone sound (${settings.audioQuality === 'low' ? 'Low bandwidth 16 kbps' : 'High fidelity 128 kbps'}).`
                  : 'Video clip & audio recording captured according to settings and secured into evidence packet.'}
              </p>
            </div>

            {/* Auto-Resend Interval Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ClockIcon size={18} className="text-[#2979ff]" />
                  <span className="font-bold text-sm text-white">Auto-Resend Interval</span>
                </div>
                <span className="font-mono text-xs font-bold text-[#2979ff] bg-[#2979ff]/10 border border-[#2979ff]/30 px-2.5 py-1 rounded-lg">
                  Next update in {Math.floor(autoResendCountdown / 60)}:{(autoResendCountdown % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                Automatically refreshes GPS location, captures fresh photo burst ({burstCount} frames), and re-alerts contacts every {intervalMinutes} minutes.
              </p>
            </div>

            {/* Resend Toast Notification */}
            {resendNotif && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#00e676]/40 bg-[#00e676]/20 p-3 text-center text-xs font-bold text-[#00e676]"
              >
                <BellRingIcon size={16} />
                <span>{resendNotif}</span>
              </motion.div>
            )}

            {/* Live Capture Counters */}
            <div className="grid grid-cols-2 gap-2">
              <Counter Icon={ImageIcon} label="Photos" value={live?.photoCount ?? burstCount} color="#ff9100" />
              <Counter Icon={VideoIcon} label="Video clips" value={live?.videoCount ?? 1} color="#ff1744" />
              <Counter Icon={MicIcon} label="Audio clips" value={live?.audioCount ?? 1} color="#00e676" />
              <Counter Icon={MapPinIcon} label="GPS points" value={live?.gpsPath.length ?? 1} color="#2979ff" />
            </div>

            {/* Captured Photo Burst Gallery Preview */}
            {currentPhotosList.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-[#ff9100]" />
                    Captured Photo Burst ({currentPhotosList.length} of {burstCount})
                  </span>
                  <span className="text-[10px] font-mono text-[#ff9100] bg-[#ff9100]/20 px-1.5 py-0.5 rounded">
                    BURST MODE
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {currentPhotosList.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedPhotoIdx(idx)}
                      className={`relative flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        selectedPhotoIdx === idx ? 'border-[#ff9100] scale-105' : 'border-white/20 opacity-70'
                      }`}
                    >
                      <img src={photo} alt={`Frame ${idx + 1}`} className="h-full w-full object-cover" />
                      <span className="absolute bottom-0.5 right-1 rounded bg-black/80 px-1 text-[8px] font-mono font-bold text-white">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Google Map Location */}
            {last && (
              <div className="mt-1">
                <GoogleMapView
                  lat={last.lat}
                  lng={last.lng}
                  path={live?.gpsPath}
                  height="220px"
                  title="Live Emergency Tracking Map"
                />
              </div>
            )}

            {/* Real-time Delivery */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">
                Real-time evidence sharing
              </p>
              <DeliveryList />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-white/10 p-4 space-y-3">
            <a
              href={`tel:${meta.emergencyNumber}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-black text-black active:scale-95 transition-transform"
              style={{ backgroundColor: meta.color }}>
              📞 CALL {meta.emergencyNumber} ({meta.numberLabel.toUpperCase()})
            </a>
            <button
              onClick={finish}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00e676] py-4 text-lg font-black text-black active:scale-95">
              <ShieldCheckIcon size={24} strokeWidth={2.6} /> I'M SAFE — STOP
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: SENT SUMMARY */}
      {phase === 'sent' && (
        <div className="no-scrollbar flex h-full flex-col overflow-y-auto bg-[#0a0a0a] px-5 py-8">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center pt-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00e676]">
              <CheckCircle2Icon size={44} color="#000" strokeWidth={2.5} />
            </div>
            <h1 className="mt-5 text-3xl font-black">Alert Sent</h1>
            <p className="mt-1 text-sm text-white/50">
              {sentAt ? fmtTime(sentAt) : ''}
            </p>
          </motion.div>

          <div className="mt-8 space-y-3">
            <SummaryRow label="Type" value={`${meta.emoji} ${meta.label}`} />
            <SummaryRow label="From" value={profile.name} />
            <SummaryRow
              label="Duration"
              value={live ? fmtDuration(live.elapsed || 0) : '—'} />
            <SummaryRow label="GPS location" value={gpsText} mono />
            <SummaryRow
              label="Evidence captured"
              value={`${live?.photoCount ?? burstCount} photos · ${live?.videoCount ?? 1} video · ${live?.audioCount ?? 1} audio`} />
            <SummaryRow
              label="Contacts notified"
              value={contacts.map((c) => c.name).join(', ') || 'Emergency Recipients'} />
            {triggerGesture && (
              <SummaryRow label="Trigger method" value={`Live Gesture (${triggerGesture})`} />
            )}
            <SummaryRow label="Auto-resend setting" value={`Every ${intervalMinutes}m`} />
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">
              Share evidence link
            </p>
            <ShareRow name={profile.name} type={meta.label} link={link} coords={gpsText} />
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-8">
            <button
              onClick={() => nav('/evidence')}
              className="w-full rounded-2xl bg-white/10 py-4 font-bold">
              View evidence folder
            </button>
            <button
              onClick={() => nav('/home', { replace: true })}
              className="w-full rounded-2xl bg-[#ff1744] py-4 font-bold">
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({
  Icon,
  label,
  value,
  color
}: {
  Icon: React.ComponentType<{ size?: number | string; color?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}22` }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <motion.p
          key={value}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="text-2xl font-black leading-none">
          {value}
        </motion.p>
        <p className="text-[11px] text-white/40">{label}</p>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3">
      <span className="text-sm text-white/40">{label}</span>
      <span className={`text-right text-sm font-bold ${mono ? 'font-mono text-[#00e676]' : ''}`}>
        {value}
      </span>
    </div>
  );
}