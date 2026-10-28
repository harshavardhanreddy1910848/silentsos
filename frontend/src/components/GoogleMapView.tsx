import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  ExternalLink, 
  Compass, 
  RefreshCw, 
  AlertCircle,
  LocateFixed,
  Search,
  Crosshair
} from 'lucide-react';

declare const google: any;

export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp?: number;
  accuracy?: number | null;
}

interface GoogleMapViewProps {
  center?: GPSPoint | null;
  path?: GPSPoint[];
  zoom?: number;
  userName?: string;
  distressType?: string;
  status?: string;
  height?: string | number;
  className?: string;
  showControls?: boolean;
  interactive?: boolean;
  liveGPS?: boolean;
  allowManualPin?: boolean;
  onLocationChange?: (point: GPSPoint) => void;
}

const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery'
  }
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  center,
  path = [],
  zoom = 17,
  userName = 'My Live Location',
  distressType = 'Live GPS',
  status = 'Active',
  height = '360px',
  className = '',
  showControls = true,
  interactive = true,
  liveGPS = true,
  allowManualPin = true,
  onLocationChange
}) => {
  // Device Live GPS Coordinates state
  const [deviceGPS, setDeviceGPS] = useState<GPSPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(!center);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [addressName, setAddressName] = useState<string | null>(null);

  // Map engine state — standard Street and Satellite, NO Dark mode
  const [engine, setEngine] = useState<'google' | 'leaflet'>('google');
  const [googleAuthFailed, setGoogleAuthFailed] = useState(false);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');

  // DOM References
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);
  const leafletCircleRef = useRef<L.Circle | null>(null);
  const leafletPolylineRef = useRef<L.Polyline | null>(null);

  const googleMapRef = useRef<any>(null);
  const googleMarkerRef = useRef<any>(null);
  const googleCircleRef = useRef<any>(null);
  const googlePolylineRef = useRef<any>(null);

  // Active target coordinates:
  // When liveGPS is true: live device coordinates take precedence so real-time hardware fixes update the map
  const activePoint: GPSPoint | null = liveGPS
    ? (deviceGPS || center || null)
    : (center || deviceGPS || null);

  // 1. Force fresh live GPS satellite lock with maximumAge: 0
  const fetchCurrentGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Browser does not support GPS.');
      setIsLocating(false);
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: GPSPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracy: pos.coords.accuracy || 10
        };
        setDeviceGPS(pt);
        setGpsAccuracy(pos.coords.accuracy || 10);
        setIsLocating(false);

        if (onLocationChange) {
          onLocationChange(pt);
        }

        // Camera Pan
        if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: pt.lat, lng: pt.lng });
          googleMapRef.current.setZoom(17);
        } else if (leafletMapRef.current) {
          leafletMapRef.current.setView([pt.lat, pt.lng], 17, { animate: true });
        }
      },
      (err) => {
        console.warn('High-accuracy GPS request error:', err.message);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const pt: GPSPoint = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: pos.timestamp,
              accuracy: pos.coords.accuracy || 25
            };
            setDeviceGPS(pt);
            setGpsAccuracy(pos.coords.accuracy || 25);
            setIsLocating(false);

            if (onLocationChange) onLocationChange(pt);

            if (googleMapRef.current) {
              googleMapRef.current.panTo({ lat: pt.lat, lng: pt.lng });
              googleMapRef.current.setZoom(17);
            } else if (leafletMapRef.current) {
              leafletMapRef.current.setView([pt.lat, pt.lng], 17, { animate: true });
            }
          },
          (lowErr) => {
            setIsLocating(false);
            setGpsError(lowErr.message || 'GPS signal unavailable. Please ensure location is enabled.');
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onLocationChange]);

  // 2. Continuous watch when liveGPS is active
  useEffect(() => {
    if (!liveGPS) return;

    fetchCurrentGPS();

    let watchId: number | null = null;
    if (navigator.geolocation) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const pt: GPSPoint = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: pos.timestamp,
              accuracy: pos.coords.accuracy || 10
            };
            setDeviceGPS(pt);
            setGpsAccuracy(pos.coords.accuracy || 10);
            setIsLocating(false);

            if (onLocationChange) onLocationChange(pt);

            // Auto-pan map camera to live position
            if (googleMapRef.current) {
              googleMapRef.current.panTo({ lat: pt.lat, lng: pt.lng });
            } else if (leafletMapRef.current) {
              leafletMapRef.current.panTo([pt.lat, pt.lng]);
            }
          },
          (err) => {
            console.warn('GPS continuous stream warning:', err.message);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
      } catch (e) {}
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [liveGPS, fetchCurrentGPS, onLocationChange]);

  // 3. Catch Google Maps auth failure
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps API auth warning. Running standard GPS engine.');
      setGoogleAuthFailed(true);
      setEngine('leaflet');
    };
  }, []);

  // 4. Initialize map instance
  useEffect(() => {
    if (!activePoint) return;

    if (engine === 'google' && (window as any).google?.maps && !googleAuthFailed) {
      initGoogleMap();
    } else {
      initLeafletMap();
    }
  }, [engine, mapType, googleAuthFailed, activePoint !== null]);

  // Check if window.google arrives asynchronously
  useEffect(() => {
    if ((window as any).google?.maps && !googleAuthFailed) {
      setEngine('google');
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.maps && !googleAuthFailed) {
          setEngine('google');
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [googleAuthFailed]);

  // 5. CRITICAL: Re-center & Pan the map whenever coordinates change
  useEffect(() => {
    if (!activePoint) return;
    const lat = activePoint.lat;
    const lng = activePoint.lng;

    // Pan Google Map
    if (googleMapRef.current) {
      const gPos = { lat, lng };
      googleMapRef.current.panTo(gPos);

      if (googleMarkerRef.current) {
        googleMarkerRef.current.setPosition(gPos);
      }
      if (googleCircleRef.current && (gpsAccuracy || activePoint.accuracy)) {
        googleCircleRef.current.setCenter(gPos);
        googleCircleRef.current.setRadius(gpsAccuracy || activePoint.accuracy || 20);
      }
      if (googlePolylineRef.current && path && path.length > 0) {
        googlePolylineRef.current.setPath(path.map(p => ({ lat: p.lat, lng: p.lng })));
      }
    }

    // Pan Leaflet Map
    if (leafletMapRef.current) {
      leafletMapRef.current.panTo([lat, lng]);

      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([lat, lng]);
      }
      if (leafletCircleRef.current && (gpsAccuracy || activePoint.accuracy)) {
        leafletCircleRef.current.setLatLng([lat, lng]).setRadius(gpsAccuracy || activePoint.accuracy || 20);
      }
      if (leafletPolylineRef.current && path && path.length > 0) {
        leafletPolylineRef.current.setLatLngs(path.map(p => [p.lat, p.lng] as [number, number]));
      }
    }
  }, [activePoint?.lat, activePoint?.lng, gpsAccuracy, activePoint?.accuracy, path]);

  // 6. Reverse geocode current coordinates to show readable locality name
  useEffect(() => {
    if (!activePoint) return;
    let isCancelled = false;

    const resolveAddress = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${activePoint.lat}&lon=${activePoint.lng}&zoom=16`, {
          headers: { 'Accept-Language': 'en' }
        });
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data && data.display_name) {
            const parts = data.display_name.split(',').map((s: string) => s.trim());
            const shortAddr = parts.slice(0, 3).join(', ');
            setAddressName(shortAddr);
          }
        }
      } catch (e) {}
    };

    resolveAddress();
    return () => { isCancelled = true; };
  }, [activePoint?.lat, activePoint?.lng]);

  // Google Maps Initialization (Clean Standard View, NO Dark Mode)
  const initGoogleMap = () => {
    if (!containerRef.current || !(window as any).google?.maps || !activePoint) return;

    try {
      containerRef.current.innerHTML = '';
      const gmaps = (window as any).google.maps;
      const gPos = { lat: activePoint.lat, lng: activePoint.lng };

      const map = new gmaps.Map(containerRef.current, {
        center: gPos,
        zoom: zoom,
        styles: undefined, // standard vibrant Google Maps (no dark filter)
        mapTypeId: mapType === 'satellite' ? gmaps.MapTypeId.HYBRID : gmaps.MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: interactive ? 'greedy' : 'none'
      });

      const pinSvg = {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 1.8,
        anchor: new gmaps.Point(12, 22)
      };

      const marker = new gmaps.Marker({
        position: gPos,
        map: map,
        icon: pinSvg,
        draggable: allowManualPin,
        title: `${userName} - ${distressType} (${status})`
      });

      if (allowManualPin) {
        marker.addListener('dragend', () => {
          const newPos = marker.getPosition();
          if (newPos) {
            const pt = { lat: newPos.lat(), lng: newPos.lng(), accuracy: 5, timestamp: Date.now() };
            setDeviceGPS(pt);
            if (onLocationChange) onLocationChange(pt);
          }
        });

        map.addListener('click', (e: any) => {
          if (e.latLng) {
            const pt = { lat: e.latLng.lat(), lng: e.latLng.lng(), accuracy: 5, timestamp: Date.now() };
            marker.setPosition(e.latLng);
            setDeviceGPS(pt);
            if (onLocationChange) onLocationChange(pt);
          }
        });
      }

      const circle = new gmaps.Circle({
        strokeColor: '#ef4444',
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: '#ef4444',
        fillOpacity: 0.12,
        map: map,
        center: gPos,
        radius: gpsAccuracy || activePoint.accuracy || 20
      });

      if (path && path.length > 0) {
        const polyline = new gmaps.Polyline({
          path: path.map(p => ({ lat: p.lat, lng: p.lng })),
          geodesic: true,
          strokeColor: '#ef4444',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: map
        });
        googlePolylineRef.current = polyline;
      }

      googleMapRef.current = map;
      googleMarkerRef.current = marker;
      googleCircleRef.current = circle;
    } catch (e) {
      console.warn('Google Maps setup fallback to Leaflet:', e);
      setEngine('leaflet');
    }
  };

  // Leaflet Map Initialization (Clean Standard View, NO Dark Mode)
  const initLeafletMap = () => {
    if (!containerRef.current || !activePoint) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    containerRef.current.innerHTML = '';

    const lat = activePoint.lat;
    const lng = activePoint.lng;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: zoom,
      zoomControl: true,
      attributionControl: false
    });

    const activeTileConfig = TILE_LAYERS[mapType] || TILE_LAYERS.street;
    const tileLayer = L.tileLayer(activeTileConfig.url, {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    const beaconIcon = L.divIcon({
      className: 'gps-radar-pin',
      html: `
        <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <div style="position:absolute; width:40px; height:40px; border-radius:50%; background:rgba(239, 68, 68, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position:absolute; width:24px; height:24px; border-radius:50%; background:rgba(239, 68, 68, 0.7); box-shadow:0 0 12px #ef4444;"></div>
          <div style="position:relative; width:12px; height:12px; border-radius:50%; background:#ffffff; border:2.5px solid #ef4444; box-shadow:0 0 8px rgba(0,0,0,0.5);"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });

    const marker = L.marker([lat, lng], { 
      icon: beaconIcon,
      draggable: allowManualPin,
      title: `${userName} - ${distressType} (${status})`
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#0f172a;line-height:1.4;">
        <strong style="display:block;font-size:13px;color:#0f172a;">${userName}</strong>
        <span style="color:#ef4444;font-weight:600;">${distressType}</span> &bull; <span style="color:#64748b;">${status}</span>
      </div>
    `);

    if (allowManualPin) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const pt = { lat: pos.lat, lng: pos.lng, accuracy: 5, timestamp: Date.now() };
        setDeviceGPS(pt);
        if (onLocationChange) onLocationChange(pt);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        const pt = { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: 5, timestamp: Date.now() };
        setDeviceGPS(pt);
        if (onLocationChange) onLocationChange(pt);
      });
    }

    const circle = L.circle([lat, lng], {
      radius: gpsAccuracy || activePoint.accuracy || 20,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.12,
      weight: 1.5
    }).addTo(map);

    if (path && path.length > 0) {
      const polyCoords = path.map(p => [p.lat, p.lng] as [number, number]);
      const polyline = L.polyline(polyCoords, {
        color: '#ef4444',
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 8'
      }).addTo(map);
      leafletPolylineRef.current = polyline;
    }

    leafletMapRef.current = map;
    leafletTileRef.current = tileLayer;
    leafletMarkerRef.current = marker;
    leafletCircleRef.current = circle;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  };

  // Search Address / Landmark (Instant Pinpoint)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchFeedback(null);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          const pt: GPSPoint = { lat, lng, accuracy: 10, timestamp: Date.now() };

          setDeviceGPS(pt);
          setSearchFeedback(`📍 Jumped to: ${data[0].display_name.split(',').slice(0, 2).join(',')}`);
          setTimeout(() => setSearchFeedback(null), 4000);

          if (onLocationChange) onLocationChange(pt);

          if (googleMapRef.current) {
            googleMapRef.current.panTo({ lat, lng });
            googleMapRef.current.setZoom(17);
          } else if (leafletMapRef.current) {
            leafletMapRef.current.setView([lat, lng], 17, { animate: true });
          }
        } else {
          setSearchFeedback('Location not found. Try a nearby landmark or street name.');
        }
      }
    } catch (err) {
      setSearchFeedback('Search query error.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecenter = () => {
    fetchCurrentGPS();
  };

  const googleMapsUrl = activePoint ? `https://www.google.com/maps?q=${activePoint.lat},${activePoint.lng}` : '#';

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-surfaceHighlight bg-white shadow-md ${className}`}>
      
      {/* Search & Location Calibration Bar */}
      {showControls && (
        <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center justify-between gap-2">
            
            {/* Search Input */}
            <form onSubmit={handleSearch} className="pointer-events-auto flex-1 max-w-xs flex items-center bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-md px-2.5 py-1">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
              <input
                type="text"
                placeholder="Search street, area, landmark..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
              />
              {isSearching && <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin ml-1 shrink-0" />}
            </form>

            {/* Controls: Street, Satellite, Re-center GPS */}
            <div className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md">
              <button
                type="button"
                onClick={() => setMapType('street')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  mapType === 'street' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Street
              </button>
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  mapType === 'satellite' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Satellite
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              {/* Snap to Live GPS */}
              <button
                type="button"
                onClick={handleRecenter}
                title="Snap to Live GPS Location"
                className="p-1.5 hover:bg-slate-100 active:scale-95 rounded-lg text-emerald-600 transition-all flex items-center gap-1"
              >
                <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search feedback pill */}
          {searchFeedback && (
            <div className="pointer-events-auto self-start bg-slate-900/90 text-white text-[11px] px-3 py-1 rounded-lg shadow-lg border border-white/10 animate-fade-in">
              {searchFeedback}
            </div>
          )}

          {/* Accuracy Advisory for Laptops / Desktop browsers */}
          {activePoint && (gpsAccuracy || activePoint.accuracy || 0) > 100 && (
            <div className="pointer-events-auto self-start bg-amber-950/90 backdrop-blur-md text-amber-200 text-[10px] px-3 py-1.5 rounded-xl border border-amber-500/30 shadow-md flex items-center gap-2 max-w-sm">
              <Compass className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Desktop/Wi-Fi estimate (±{Math.round((gpsAccuracy || activePoint.accuracy || 1000) / 1000)}km). Search your street above or drag the pin to your exact spot.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Map DOM Target */}
      <div
        ref={containerRef}
        style={{ height, width: '100%', minHeight: typeof height === 'number' ? `${height}px` : height }}
        className="w-full relative z-0"
      />

      {/* Loading Radar Overlay if waiting for initial GPS lock */}
      {!activePoint && isLocating && (
        <div className="absolute inset-0 z-[1001] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="relative mb-4">
            <Crosshair className="w-12 h-12 text-emerald-400 animate-spin" />
            <span className="absolute -inset-2 rounded-full border border-emerald-400/40 animate-ping" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Locking onto Live GPS Satellites...</h3>
          <p className="text-xs text-slate-300 max-w-xs mb-4">
            Requesting high-precision device coordinates. If prompted, please allow location access in your browser.
          </p>
          <button
            onClick={fetchCurrentGPS}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            Refresh GPS Request
          </button>
        </div>
      )}

      {/* GPS Lock Error state if position unavailable */}
      {!activePoint && !isLocating && gpsError && (
        <div className="absolute inset-0 z-[1001] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-full mb-3 text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">GPS Location Unavailable</h3>
          <p className="text-xs text-slate-300 max-w-xs mb-4">
            {gpsError}
          </p>
          <button
            onClick={fetchCurrentGPS}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Live GPS
          </button>
        </div>
      )}

      {/* Bottom Coordinates & Accuracy HUD */}
      {showControls && activePoint && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-700 shadow-md flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-slate-900">Live GPS:</span>
            <span>{activePoint.lat.toFixed(5)}, {activePoint.lng.toFixed(5)}</span>
            {addressName && (
              <span className="text-slate-800 font-sans font-medium border-l border-slate-200 pl-2 max-w-[180px] sm:max-w-[260px] truncate" title={addressName}>
                📍 {addressName}
              </span>
            )}
            {(gpsAccuracy || activePoint.accuracy) && (
              <span className={`font-semibold border-l border-slate-200 pl-2 ${
                (gpsAccuracy || activePoint.accuracy || 0) > 100 ? 'text-amber-600' : 'text-emerald-700'
              }`}>
                ±{Math.round(gpsAccuracy || activePoint.accuracy || 15)}m
              </span>
            )}
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-white/20 shadow-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Google Maps
          </a>
        </div>
      )}
    </div>
  );
};
export default GoogleMapView;
