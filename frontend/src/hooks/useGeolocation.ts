import { useState, useEffect, useCallback, useRef } from 'react';

export type LocationState = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  timestamp: number;
  error: string | null;
  isLocating: boolean;
  source: 'gps' | 'cached' | 'manual' | null;
};

const STORAGE_KEY = 'silentsos_live_gps_coords';

export function useGeolocation() {
  // Load last verified location from localStorage if available (and not obsolete)
  const [location, setLocation] = useState<LocationState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clear any old Chennai dummy coordinates (13.0311, 80.2783) or coordinates older than 3 hours
        const isChennaiDummy = Math.abs(parsed.lat - 13.0311) < 0.01 && Math.abs(parsed.lng - 80.2783) < 0.01;
        const isStale = parsed.timestamp && (Date.now() - parsed.timestamp > 3 * 60 * 60 * 1000);

        if (isChennaiDummy || isStale) {
          localStorage.removeItem(STORAGE_KEY);
        } else if (parsed.lat && parsed.lng) {
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy || 20,
            timestamp: parsed.timestamp || Date.now(),
            error: null,
            isLocating: true, // will refresh with live GPS immediately
            source: 'cached'
          };
        }
      }
    } catch (e) {}

    return {
      lat: null,
      lng: null,
      accuracy: null,
      timestamp: Date.now(),
      error: null,
      isLocating: true,
      source: null
    };
  });

  const watchIdRef = useRef<number | null>(null);

  // High-precision live GPS request (maximumAge: 0 forces fresh satellite/hardware query)
  const requestLiveGPS = useCallback(() => {
    setLocation(prev => ({ ...prev, isLocating: true, error: null }));

    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        isLocating: false,
        error: 'Geolocation is not supported by your browser.'
      }));
      return;
    }

    const onPos = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || 15;
      const timestamp = position.timestamp || Date.now();

      // Persist verified user coordinates to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, accuracy, timestamp }));
      } catch (e) {}

      setLocation({
        lat,
        lng,
        accuracy,
        timestamp,
        error: null,
        isLocating: false,
        source: 'gps'
      });
    };

    const onErr = (err: GeolocationPositionError) => {
      let msg = err.message;
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location permission denied. Please allow location access in your browser address bar.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'GPS signal unavailable. Trying network triangulation...';
      } else if (err.code === err.TIMEOUT) {
        msg = 'GPS satellite lock timed out. Retrying with standard precision...';
      }

      // If high-accuracy timed out or unavailable, try standard accuracy immediately
      if (err.code !== err.PERMISSION_DENIED) {
        navigator.geolocation.getCurrentPosition(
          onPos,
          (secondErr) => {
            setLocation(prev => ({
              ...prev,
              isLocating: false,
              error: secondErr.message || msg
            }));
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
        );
      } else {
        setLocation(prev => ({
          ...prev,
          isLocating: false,
          error: msg
        }));
      }
    };

    // 1. Force fresh high-accuracy position with maximumAge: 0
    navigator.geolocation.getCurrentPosition(onPos, onErr, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    });
  }, []);

  // Allow user to manually pinpoint exact location if desktop Wi-Fi has an offset
  const setManualLocation = useCallback((lat: number, lng: number, accuracy: number = 10) => {
    const timestamp = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, accuracy, timestamp }));
    } catch (e) {}

    setLocation({
      lat,
      lng,
      accuracy,
      timestamp,
      error: null,
      isLocating: false,
      source: 'manual'
    });
  }, []);

  useEffect(() => {
    requestLiveGPS();

    // Listen to permission state change (e.g. user clicks "Allow" on location popup)
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        status.onchange = () => {
          if (status.state === 'granted') {
            requestLiveGPS();
          }
        };
      }).catch(() => {});
    }

    // Start real-time GPS tracking stream
    if (navigator.geolocation) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy || 15;
            const timestamp = pos.timestamp || Date.now();

            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, accuracy, timestamp }));
            } catch (e) {}

            setLocation({
              lat,
              lng,
              accuracy,
              timestamp,
              error: null,
              isLocating: false,
              source: 'gps'
            });
          },
          (err) => {
            console.warn('GPS continuous stream warning:', err.message);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 12000
          }
        );
      } catch (e) {}
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [requestLiveGPS]);

  return {
    ...location,
    refresh: requestLiveGPS,
    setManualLocation
  };
}