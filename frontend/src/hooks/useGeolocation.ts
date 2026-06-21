import { useState, useEffect } from 'react';

type LocationState = {
  lat: number | null;
  lng: number | null;
  accuracy: number;
  timestamp: number;
  error: string | null;
};

export function useGeolocation() {
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    accuracy: 0,
    timestamp: Date.now(),
    error: null
  });

  useEffect(() => {
    let watchId: number;

    const handleSuccess = (position: GeolocationPosition) => {
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        error: null
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      let msg = error.message;
      if (error.code === error.PERMISSION_DENIED) {
        msg = 'Location permission denied. Please allow location access in your browser settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = 'Location information is unavailable.';
      } else if (error.code === error.TIMEOUT) {
        msg = 'Location request timed out.';
      }
      setLocation({
        lat: null,
        lng: null,
        accuracy: 0,
        timestamp: Date.now(),
        error: msg
      });
    };

    const startWatching = () => {
      if (!navigator.geolocation) {
        setLocation({
          lat: null,
          lng: null,
          accuracy: 0,
          timestamp: Date.now(),
          error: 'Geolocation is not supported by your browser.'
        });
        return;
      }

      // Strictly watch position with high accuracy and no caching
      watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    };

    const checkPermissionAndStart = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          
          const handlePermissionChange = () => {
            if (status.state === 'denied') {
              if (watchId) navigator.geolocation.clearWatch(watchId);
              setLocation({
                lat: null,
                lng: null,
                accuracy: 0,
                timestamp: Date.now(),
                error: 'Location access denied in browser settings.'
              });
            } else {
              startWatching();
            }
          };

          status.onchange = handlePermissionChange;

          if (status.state === 'denied') {
            setLocation({
              lat: null,
              lng: null,
              accuracy: 0,
              timestamp: Date.now(),
              error: 'Location access denied in browser settings.'
            });
          } else {
            startWatching();
          }
        } else {
          startWatching();
        }
      } catch (err) {
        startWatching();
      }
    };

    checkPermissionAndStart();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return location;
}