import { useEffect, useRef, useState } from 'react';
import { BASE_COORD, jitterCoord } from '../lib/mock';
import { GpsPoint } from '../lib/types';

/**
 * Real device Geolocation hook with high-accuracy live tracking.
 * Retrieves real GPS coordinates from browser navigator.geolocation.
 * Falls back to jittered mock coordinates if geolocation is ungranted or unavailable.
 */
export function useGps(active = true) {
  const [point, setPoint] = useState<GpsPoint>({
    ...BASE_COORD,
    t: Date.now()
  });
  const [accuracy, setAccuracy] = useState<number>(10);
  const [isRealGps, setIsRealGps] = useState<boolean>(false);
  const ref = useRef(point);

  useEffect(() => {
    ref.current = point;
  }, [point]);

  useEffect(() => {
    if (!active) return;

    let watchId: number | null = null;
    let fallbackInterval: number | null = null;

    // 1. Try real GPS via Geolocation API
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const realPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            t: pos.timestamp || Date.now()
          };
          setPoint(realPoint);
          setAccuracy(Math.round(pos.coords.accuracy || 5));
          setIsRealGps(true);
        },
        (err) => {
          console.warn('Initial real GPS lookup notice:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const realPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            t: pos.timestamp || Date.now()
          };
          setPoint(realPoint);
          setAccuracy(Math.round(pos.coords.accuracy || 5));
          setIsRealGps(true);
        },
        (err) => {
          console.warn('Real GPS tracking notice:', err.message);
          setIsRealGps(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    }

    // 2. Continuous fallback heartbeat if real GPS is not active
    fallbackInterval = window.setInterval(() => {
      if (!isRealGps) {
        const next = { ...jitterCoord(ref.current), t: Date.now() };
        setPoint(next);
        setAccuracy(4 + Math.round(Math.random() * 8));
      }
    }, 2000);

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (fallbackInterval !== null) {
        clearInterval(fallbackInterval);
      }
    };
  }, [active, isRealGps]);

  return { point, accuracy, isRealGps };
}