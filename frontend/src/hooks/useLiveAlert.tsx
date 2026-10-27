/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState } from
'react';
import { useApp } from '../context/AppContext';
import { BASE_COORD, jitterCoord, uid } from '../lib/mock';
import {
  AlertRecord,
  AlertType,
  ContactDelivery,
  GpsPoint,
  SendState } from
'../lib/types';

interface LiveState {
  id: string;
  type: AlertType;
  startedAt: number;
  elapsed: number;
  gpsPath: GpsPoint[];
  photoCount: number;
  videoCount: number;
  audioCount: number;
  photoDataUrl?: string;
  photoDataUrls?: string[];
  videoDataUrl?: string;
  audioDataUrl?: string;
  triggerGesture?: string;
  deliveries: ContactDelivery[];
}

interface Ctx {
  live: LiveState | null;
  start: (type: AlertType, triggerGesture?: string, initialPhotos?: string[]) => string;
  stop: (status: 'sent' | 'cancelled') => void;
  retry: (contactId: string, field: keyof ContactDelivery) => void;
  acknowledge: (contactId: string) => void;
  attachEvidence: (evidence: {
    photoDataUrl?: string;
    photoDataUrls?: string[];
    videoDataUrl?: string;
    audioDataUrl?: string;
    photoCount?: number;
    videoCount?: number;
    audioCount?: number;
  }) => void;
}

const LiveCtx = createContext<Ctx | null>(null);

const CHANNELS: (keyof ContactDelivery)[] = ['message', 'gps', 'photos', 'audio', 'video'];

export function LiveAlertProvider({ children }: {children: React.ReactNode;}) {
  const { contacts, capture, settings, addAlert, updateAlert } = useApp();
  const [live, setLive] = useState<LiveState | null>(null);
  const timers = useRef<number[]>([]);
  const liveRef = useRef<LiveState | null>(null);
  liveRef.current = live;

  const clearTimers = () => {
    timers.current.forEach((t) => clearInterval(t));
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const persist = useCallback(
    (s: LiveState, status: AlertRecord['status'], ended: number | null) => {
      updateAlert(s.id, {
        gpsPath: s.gpsPath,
        photoCount: s.photoCount,
        videoCount: s.videoCount,
        audioCount: s.audioCount,
        ...(s.photoDataUrl ? { photoDataUrl: s.photoDataUrl } : {}),
        ...(s.photoDataUrls ? { photoDataUrls: s.photoDataUrls } : {}),
        ...(s.videoDataUrl ? { videoDataUrl: s.videoDataUrl } : {}),
        ...(s.audioDataUrl ? { audioDataUrl: s.audioDataUrl } : {}),
        ...(s.triggerGesture ? { triggerGesture: s.triggerGesture } : {}),
        deliveries: s.deliveries,
        status,
        endedAt: ended
      });
    },
    [updateAlert]
  );

  const attachEvidence = useCallback(
    (evidence: {
      photoDataUrl?: string;
      photoDataUrls?: string[];
      videoDataUrl?: string;
      audioDataUrl?: string;
      photoCount?: number;
      videoCount?: number;
      audioCount?: number;
    }) => {
      setLive((s) => {
        if (!s) return s;
        const next: LiveState = {
          ...s,
          photoDataUrl: evidence.photoDataUrl !== undefined ? evidence.photoDataUrl : s.photoDataUrl,
          photoDataUrls: (evidence.photoDataUrls && evidence.photoDataUrls.length > 0) ? evidence.photoDataUrls : s.photoDataUrls,
          videoDataUrl: evidence.videoDataUrl !== undefined ? evidence.videoDataUrl : s.videoDataUrl,
          audioDataUrl: evidence.audioDataUrl !== undefined ? evidence.audioDataUrl : s.audioDataUrl,
          photoCount: evidence.photoCount ?? s.photoCount,
          videoCount: evidence.videoCount ?? s.videoCount,
          audioCount: evidence.audioCount ?? s.audioCount
        };
        persist(next, 'active', null);
        return next;
      });
    },
    [persist]
  );

  const setChannel = useCallback(
    (contactId: string, field: keyof ContactDelivery, value: SendState) => {
      setLive((s) => {
        if (!s) return s;
        const deliveries = s.deliveries.map((d) =>
        d.contactId === contactId ? { ...d, [field]: value } : d
        );
        const next = { ...s, deliveries };
        persist(next, 'active', null);
        return next;
      });
    },
    [persist]
  );

  const start = useCallback(
    (type: AlertType, triggerGesture?: string, initialPhotos?: string[]) => {
      clearTimers();
      const startedAt = Date.now();
      const id = uid();
      const burst = settings.burstCount || 5;
      const primaryPhoto = initialPhotos && initialPhotos.length > 0 ? initialPhotos[0] : undefined;
      const deliveries: ContactDelivery[] = contacts.map((c) => ({
        contactId: c.id,
        contactName: c.name,
        gps: c.prefs.gps ? 'queued' : 'sent',
        photos: c.prefs.photos && capture.photos ? 'queued' : 'sent',
        video: c.prefs.video && capture.video ? 'queued' : 'sent',
        audio: c.prefs.audio && capture.audio ? 'queued' : 'sent',
        message: c.prefs.message ? 'queued' : 'sent',
        acknowledged: false
      }));

      const initial: LiveState = {
        id,
        type,
        startedAt,
        elapsed: 0,
        gpsPath: [{ ...BASE_COORD, t: startedAt }],
        photoCount: initialPhotos && initialPhotos.length > 0 ? initialPhotos.length : (capture.photos ? burst : 0),
        videoCount: capture.video ? 1 : 0,
        audioCount: capture.audio ? 1 : 0,
        photoDataUrl: primaryPhoto,
        photoDataUrls: initialPhotos && initialPhotos.length > 0 ? initialPhotos : undefined,
        triggerGesture,
        deliveries
      };
      setLive(initial);

      // Attempt to immediately update with real GPS coordinate
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const realPt = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              t: Date.now()
            };
            setLive((s) => {
              if (!s) return s;
              return { ...s, gpsPath: [realPt] };
            });
          },
          (err) => console.warn('Alert GPS lookup fallback:', err.message),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }

      const record: AlertRecord = {
        id,
        type,
        startedAt,
        endedAt: null,
        status: 'active',
        gpsPath: initial.gpsPath,
        photoCount: initial.photoCount,
        videoCount: initial.videoCount,
        audioCount: initial.audioCount,
        photoDataUrl: primaryPhoto,
        photoDataUrls: initialPhotos && initialPhotos.length > 0 ? initialPhotos : undefined,
        triggerGesture,
        deliveries
      };
      addAlert(record);

      // ticking clock + GPS logging (represents real-time location logging)
      const tick = window.setInterval(() => {
        setLive((s) => {
          if (!s) return s;
          const last = s.gpsPath[s.gpsPath.length - 1];

          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const realPt = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  t: Date.now()
                };
                setLive((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    elapsed: Date.now() - prev.startedAt,
                    gpsPath: [...prev.gpsPath, realPt]
                  };
                });
              },
              () => {
                const fallbackPt = { ...jitterCoord(last), t: Date.now() };
                setLive((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    elapsed: Date.now() - prev.startedAt,
                    gpsPath: [...prev.gpsPath, fallbackPt]
                  };
                });
              },
              { enableHighAccuracy: true, timeout: 3000 }
            );
            return s;
          }

          const path = [...s.gpsPath, { ...jitterCoord(last), t: Date.now() }];
          return { ...s, elapsed: Date.now() - s.startedAt, gpsPath: path };
        });
      }, 3000);
      timers.current.push(tick);

      // photo burst then periodic captures
      if (capture.photos) {
        const photo = window.setInterval(() => {
          setLive((s) => (s ? { ...s, photoCount: s.photoCount + burst } : s));
        }, 5000);
        timers.current.push(photo);
      }
      if (capture.video) {
        const vid = window.setInterval(() => {
          setLive((s) => (s ? { ...s, videoCount: s.videoCount + 1 } : s));
        }, 8000);
        timers.current.push(vid);
      }
      if (capture.audio) {
        const aud = window.setInterval(() => {
          setLive((s) => (s ? { ...s, audioCount: s.audioCount + 1 } : s));
        }, 6000);
        timers.current.push(aud);
      }

      // staggered delivery progression per contact / channel
      deliveries.forEach((d, ci) => {
        CHANNELS.forEach((ch, chi) => {
          if (d[ch] !== 'queued') return;
          const base = 600 + ci * 400 + chi * 900;
          const t1 = window.setTimeout(() => setChannel(d.contactId, ch, 'sending'), base);
          const t2 = window.setTimeout(() => {
            // 12% chance of a failure to exercise the retry UI
            const failed = Math.random() < 0.12;
            setChannel(d.contactId, ch, failed ? 'failed' : 'sent');
          }, base + 1400);
          timers.current.push(t1 as unknown as number, t2 as unknown as number);
        });
      });

      return id;
    },
    [contacts, capture, settings.burstCount, addAlert, setChannel]
  );

  const retry = useCallback(
    (contactId: string, field: keyof ContactDelivery) => {
      setChannel(contactId, field, 'sending');
      const t = window.setTimeout(() => setChannel(contactId, field, 'sent'), 1300);
      timers.current.push(t as unknown as number);
    },
    [setChannel]
  );

  const acknowledge = useCallback(
    (contactId: string) => {
      setLive((s) => {
        if (!s) return s;
        const deliveries = s.deliveries.map((d) =>
        d.contactId === contactId ? { ...d, acknowledged: true } : d
        );
        const next = { ...s, deliveries };
        persist(next, 'active', null);
        return next;
      });
    },
    [persist]
  );

  const stop = useCallback(
    (status: 'sent' | 'cancelled') => {
      clearTimers();
      const s = liveRef.current;
      if (s) {
        const anyFailed = s.deliveries.some((d) =>
        CHANNELS.some((c) => d[c] === 'failed')
        );
        const finalStatus =
        status === 'cancelled' ? 'cancelled' : anyFailed ? 'partial' : 'sent';
        persist(s, finalStatus, Date.now());
      }
      setLive(null);
    },
    [persist]
  );

  return (
    <LiveCtx.Provider value={{ live, start, stop, retry, acknowledge, attachEvidence }}>
      {children}
    </LiveCtx.Provider>);

}

export function useLiveAlert() {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error('useLiveAlert must be used within LiveAlertProvider');
  return ctx;
}