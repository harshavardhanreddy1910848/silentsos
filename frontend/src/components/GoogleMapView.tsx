import { useEffect, useRef, useState } from 'react';
import { MapPinIcon, ExternalLinkIcon, LocateFixedIcon, LayersIcon } from 'lucide-react';
import { fmtCoord, mapsLink } from '../lib/mock';
import { GpsPoint } from '../lib/types';

interface GoogleMapViewProps {
  lat: number;
  lng: number;
  accuracy?: number;
  path?: GpsPoint[];
  height?: string;
  zoom?: number;
  title?: string;
  className?: string;
  interactive?: boolean;
}

interface GoogleMap {
  setCenter: (center: { lat: number; lng: number }) => void;
  setMapTypeId: (mapTypeId: string) => void;
  setOptions: (options: Record<string, unknown>) => void;
  panTo: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
}

interface GoogleMarker {
  setPosition: (position: { lat: number; lng: number }) => void;
}

interface GoogleCircle {
  setCenter: (center: { lat: number; lng: number }) => void;
  setRadius: (radius: number) => void;
}

interface GooglePolyline {
  setPath: (path: { lat: number; lng: number }[]) => void;
}

interface GoogleMapsSDK {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    Circle: new (options: Record<string, unknown>) => GoogleCircle;
    Polyline: new (options: Record<string, unknown>) => GooglePolyline;
    Animation: { DROP: unknown };
    SymbolPath: { CIRCLE: unknown };
  };
}

declare global {
  interface Window {
    google?: GoogleMapsSDK;
    initGoogleMapsCallback?: () => void;
  }
}

// Dark mode styles for Google Maps
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }]
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }]
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334e68' }]
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#021019' }]
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#283d6a' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6f9ba5' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#304a7d' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#98a5be' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2c4568' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2d40' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4e6d96' }]
  }
];

export function GoogleMapView({
  lat,
  lng,
  accuracy = 15,
  path,
  height = '240px',
  zoom = 15,
  title = 'Live GPS Location',
  className = '',
  interactive = true
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const markerInstanceRef = useRef<GoogleMarker | null>(null);
  const circleInstanceRef = useRef<GoogleCircle | null>(null);
  const polylineInstanceRef = useRef<GooglePolyline | null>(null);

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');

  const env = (import.meta as unknown as { env?: Record<string, string> })?.env;
  const apiKey = env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBOK1eu9K1eYI1z2ssm7FGLkA37ItVG9lQ';

  // Load Google Maps API Script
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => setMapLoaded(true);
      script.onerror = () => {
        console.warn('Google Maps JS API failed to load; using Embed Fallback.');
        setLoadError(true);
      };

      document.head.appendChild(script);
    } else {
      script.addEventListener('load', () => setMapLoaded(true));
    }
  }, [apiKey]);

  // Initialize or update Map instance
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !window.google || !window.google.maps) return;

    try {
      const center = { lat, lng };

      if (!mapInstanceRef.current) {
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom,
          styles: mapType === 'roadmap' ? DARK_MAP_STYLE : [],
          mapTypeId: mapType,
          disableDefaultUI: !interactive,
          zoomControl: interactive,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.setMapTypeId(mapType);
        if (mapType === 'roadmap') {
          mapInstanceRef.current.setOptions({ styles: DARK_MAP_STYLE });
        } else {
          mapInstanceRef.current.setOptions({ styles: [] });
        }
      }

      const map = mapInstanceRef.current;

      // Marker for Current Location
      if (!markerInstanceRef.current) {
        markerInstanceRef.current = new window.google.maps.Marker({
          position: center,
          map,
          title: 'Current SOS GPS Location',
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#00e676',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2.5
          }
        });
      } else {
        markerInstanceRef.current.setPosition(center);
      }

      // Accuracy Circle
      if (!circleInstanceRef.current) {
        circleInstanceRef.current = new window.google.maps.Circle({
          map,
          center,
          radius: accuracy,
          fillColor: '#00e676',
          fillOpacity: 0.15,
          strokeColor: '#00e676',
          strokeOpacity: 0.6,
          strokeWeight: 1.5
        });
      } else {
        circleInstanceRef.current.setCenter(center);
        circleInstanceRef.current.setRadius(accuracy);
      }

      // GPS Trail Polyline if path is provided
      if (path && path.length > 1) {
        const pathCoords = path.map((pt) => ({ lat: pt.lat, lng: pt.lng }));
        if (!polylineInstanceRef.current) {
          polylineInstanceRef.current = new window.google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: '#ff1744',
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map
          });
        } else {
          polylineInstanceRef.current.setPath(pathCoords);
        }
      }
    } catch (err) {
      console.error('Error rendering Google Map:', err);
      setLoadError(true);
    }
  }, [mapLoaded, lat, lng, accuracy, path, zoom, mapType, interactive]);

  const toggleMapType = () => {
    setMapType((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'));
  };

  const recenter = () => {
    if (mapInstanceRef.current && window.google) {
      mapInstanceRef.current.panTo({ lat, lng });
      mapInstanceRef.current.setZoom(zoom);
    }
  };

  const gmapsExternalUrl = mapsLink(lat, lng);
  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=${zoom}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-xl transition-all ${className}`}
      style={{ height }}
    >
      {/* Header Info Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between rounded-xl border border-white/15 bg-black/75 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00e676]/20 border border-[#00e676]/40">
            <MapPinIcon size={15} className="text-[#00e676] animate-pulse" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-white leading-tight">{title}</p>
            <p className="font-mono text-[10px] font-semibold text-[#00e676] leading-tight">
              {fmtCoord(lat, lng)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMapType}
            title="Toggle Map View"
            className="flex h-7 px-2 items-center gap-1 rounded-lg border border-white/10 bg-white/10 text-[10px] font-bold text-white hover:bg-white/20 transition-colors"
          >
            <LayersIcon size={12} /> {mapType === 'roadmap' ? 'Satellite' : 'Map'}
          </button>
          {interactive && (
            <button
              onClick={recenter}
              title="Recenter Map"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <LocateFixedIcon size={13} />
            </button>
          )}
          <a
            href={gmapsExternalUrl}
            target="_blank"
            rel="noreferrer"
            title="Open in Google Maps"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-[#2979ff] text-white hover:opacity-90 transition-opacity"
          >
            <ExternalLinkIcon size={13} />
          </a>
        </div>
      </div>

      {/* Main Map View Canvas or Fallback */}
      {!loadError ? (
        <div ref={mapContainerRef} className="h-full w-full bg-[#0d1527]" />
      ) : (
        <div className="relative h-full w-full">
          <iframe
            title="Google Maps Location View"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={embedUrl}
          />
        </div>
      )}

      {/* Live Badge Bottom Left */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-[#00e676] animate-ping" />
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00e676]">
          Real GPS Connected
        </span>
      </div>
    </div>
  );
}
