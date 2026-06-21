import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ShieldAlert,
  MapPin,
  Camera,
  Mic,
  Clock,
  ExternalLink,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle,
  Lock
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin;



export function Receiver() {
  const { alertId } = useParams<{ alertId: string }>();
  const [alertData, setAlertData] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  // Map references
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Fetch initial details
  useEffect(() => {
    async function loadAlert() {
      try {
        const res = await fetch(`${API_BASE}/api/alerts/${alertId}`);
        if (res.ok) {
          const data = await res.json();
          setAlertData(data);
        }
      } catch (err) {
        console.error('Failed to load alert details from HTTP:', err);
      }
    }
    loadAlert();
  }, [alertId]);

  // Connect WebSockets
  useEffect(() => {
    if (!alertId) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.origin.includes('localhost') ? 'localhost:3001' : window.location.host;
    const socket = new WebSocket(`${wsProtocol}://${wsHost}`);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus('connected');
      socket.send(
        JSON.stringify({
          type: 'register',
          role: 'receiver',
          alertId: alertId
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'alert_update') {
          setAlertData(msg.alert);
        } else if (msg.type === 'gps_update') {
          setAlertData((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              gpsPath: [...prev.gpsPath, msg.gpsPoint]
            };
          });
        } else if (msg.type === 'evidence_update') {
          setAlertData((prev: any) => {
            if (!prev) return null;
            return { ...prev, evidence: msg.evidence };
          });
        } else if (msg.type === 'status_update') {
          setAlertData((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              status: msg.status,
              durationSeconds: msg.durationSeconds
            };
          });
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    socket.onclose = () => setConnectionStatus('disconnected');
    socket.onerror = () => setConnectionStatus('disconnected');

    return () => {
      if (socket) socket.close();
    };
  }, [alertId]);

  const currentCoords = alertData?.gpsPath?.[alertData.gpsPath.length - 1];

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!alertData || !currentCoords || !L) return;

    // 1. Initialize Leaflet Map object
    if (!mapRef.current) {
      try {
        mapRef.current = L.map('map-receiver-leaflet', {
          zoomControl: true,
          attributionControl: false
        }).setView([currentCoords.lat, currentCoords.lng], 16);

        // OSM Tile Layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);

        // Customize marker icon
        const redIcon = L.icon({
          iconUrl: '/marker-icon-red.png',
          shadowUrl: '/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        // Setup active pin
        markerRef.current = L.marker([currentCoords.lat, currentCoords.lng], { icon: redIcon })
          .addTo(mapRef.current)
          .bindPopup('<b>Distress Location</b><br/>Live updates active.')
          .openPopup();

        // Setup paths
        const latlngs = alertData.gpsPath.map((pt: any) => [pt.lat, pt.lng]);
        polylineRef.current = L.polyline(latlngs, {
          color: '#ef4444',
          weight: 5,
          opacity: 0.85
        }).addTo(mapRef.current);
      } catch (e) {
        console.error('Failed to initialize map:', e);
      }
    } else {
      // 2. Update existing Leaflet Map pin & polyline path
      if (markerRef.current) {
        markerRef.current.setLatLng([currentCoords.lat, currentCoords.lng]);
      }
      if (polylineRef.current) {
        const latlngs = alertData.gpsPath.map((pt: any) => [pt.lat, pt.lng]);
        polylineRef.current.setLatLngs(latlngs);
      }
      mapRef.current.panTo([currentCoords.lat, currentCoords.lng]);
    }
  }, [alertData, currentCoords]);

  if (!alertData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-textMuted p-6">
        <ShieldAlert className="w-16 h-16 text-warning mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-white mb-2">Connecting to Alert stream...</h2>
        <p className="text-sm text-center max-w-xs">
          Waiting for emergency response server connection or invalid Alert ID.
        </p>
      </div>
    );
  }

  const fileList = alertData.evidence?.files || [];
  const contacts = alertData.contactsNotified || [];

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-y-auto no-scrollbar pb-24 w-full max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-emergency" />
          <h1 className="text-xl font-black tracking-tight text-white animate-pulse">EMERGENCY DASHBOARD</h1>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {connectionStatus === 'connected' ? '● SYNC ACTIVE' : '● OFFLINE'}
        </span>
      </div>

      {/* Alert Level Box */}
      <div className="bg-emergency/10 border border-emergency/30 rounded-2xl p-4 mb-4 text-center">
        <h2 className="text-2xl font-black text-emergency uppercase tracking-wider">
          🚨 {alertData.type} WARNING
        </h2>
        <p className="text-[10px] text-textMuted mt-1">
          GPS coordinate paths are currently secured under AES-256 cloud encryption.
        </p>
        <div className="mt-3 inline-flex items-center gap-1 bg-background px-3 py-1 rounded-full text-xs font-semibold text-textMain border border-surfaceHighlight">
          <Lock className="w-3 h-3 text-safe" /> SECURED STORAGE
        </div>
      </div>

      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Map & Active Broadcast Duration */}
        <div className="lg:col-span-7 space-y-4">
          {/* Interactive Map */}
          <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4">
            <h3 className="text-xs font-bold text-textMuted uppercase mb-3 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-safe" /> Live Location Tracking Map
            </h3>

            {/* Map Placeholder Element for Leaflet */}
            <div
              id="map-receiver-leaflet"
              style={{ height: '350px' }}
              className="rounded-xl border border-surfaceHighlight overflow-hidden mb-3 relative z-10 w-full"
            />

            {currentCoords ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-background p-2.5 rounded-xl border border-surfaceHighlight text-xs">
                  <div>
                    <p className="text-[9px] text-textMuted uppercase">Latitude</p>
                    <p className="font-mono font-bold text-white">{currentCoords.lat.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-textMuted uppercase">Longitude</p>
                    <p className="font-mono font-bold text-white">{currentCoords.lng.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-textMuted uppercase">Updates</p>
                    <p className="font-mono font-bold text-white">{alertData.gpsPath?.length}</p>
                  </div>
                </div>
                <a
                  href={`https://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-safe hover:bg-emerald-400 text-black font-bold py-2 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Open in Google Maps
                </a>
              </div>
            ) : (
              <p className="text-xs text-textMuted italic">Locating client device...</p>
            )}
          </div>

          {/* Metadata Duration */}
          {alertData.durationSeconds > 0 && (
            <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 flex items-center justify-between text-xs text-textMuted">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Active Broadcast Duration
              </span>
              <span className="font-bold text-white">{alertData.durationSeconds} seconds</span>
            </div>
          )}
        </div>

        {/* Right Column: Dispatch Notifications & Captured Evidence Gallery */}
        <div className="lg:col-span-5 space-y-4">
          {/* Transmission / Notification Dispatch Center */}
          <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4">
            <h3 className="text-xs font-bold text-textMuted uppercase mb-3 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-400" /> Dispatch Notifications Center
            </h3>
            
            {contacts.length === 0 ? (
              <p className="text-xs text-textMuted italic">No active contacts logged for user.</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact: any, idx: number) => (
                  <div key={idx} className="border border-surfaceHighlight bg-background/50 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center border-b border-surfaceHighlight/50 pb-1.5">
                      <span className="text-xs font-bold text-white">{contact.contactName}</span>
                      <span className="text-[9px] text-textMuted font-mono">Recipient #{idx+1}</span>
                    </div>
                    
                    {/* Channel Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {/* SMS (Twilio) */}
                      <div className="flex flex-col bg-background p-1.5 rounded border border-surfaceHighlight/30">
                        <span className="text-[8px] text-textMuted font-bold uppercase flex items-center gap-1">
                          <Smartphone className="w-2.5 h-2.5 text-safe" /> SMS (Twilio)
                        </span>
                        <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-1 mt-0.5">
                          <CheckCircle className="w-2.5 h-2.5" /> {contact.channels?.sms?.status}
                        </span>
                      </div>

                      {/* WhatsApp */}
                      <div className="flex flex-col bg-background p-1.5 rounded border border-surfaceHighlight/30">
                        <span className="text-[8px] text-textMuted font-bold uppercase flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5 text-emerald-400" /> WhatsApp
                        </span>
                        <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-1 mt-0.5">
                          <CheckCircle className="w-2.5 h-2.5" /> {contact.channels?.whatsapp?.status}
                        </span>
                      </div>

                      {/* Email */}
                      <div className="flex flex-col bg-background p-1.5 rounded border border-surfaceHighlight/30">
                        <span className="text-[8px] text-textMuted font-bold uppercase flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5 text-sky-400" /> Email (SendGrid)
                        </span>
                        <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-1 mt-0.5">
                          <CheckCircle className="w-2.5 h-2.5" /> {contact.channels?.email?.status}
                        </span>
                      </div>

                      {/* Push Alert */}
                      <div className="flex flex-col bg-background p-1.5 rounded border border-surfaceHighlight/30">
                        <span className="text-[8px] text-textMuted font-bold uppercase flex items-center gap-1">
                          <Smartphone className="w-2.5 h-2.5 text-purple-400" /> FCM Push
                        </span>
                        <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-1 mt-0.5">
                          <CheckCircle className="w-2.5 h-2.5" /> {contact.channels?.push?.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Captured Evidence Gallery */}
          <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4">
            <h3 className="text-xs font-bold text-textMuted uppercase mb-3 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-400" /> Cloud Media Uploads
            </h3>

            {fileList.length === 0 ? (
              <div className="text-center py-6 text-textMuted italic text-xs bg-background/50 rounded-xl border border-surfaceHighlight/30">
                No media uploads received yet. Stream starting shortly...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Photos */}
                {fileList.some((f: any) => f.type === 'photo') && (
                  <div>
                    <p className="text-[9px] font-bold text-textMuted uppercase mb-1.5">Screen Captures</p>
                    <div className="grid grid-cols-2 gap-2">
                      {fileList
                        .filter((f: any) => f.type === 'photo')
                        .map((file: any, idx: number) => (
                          <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-background border border-surfaceHighlight">
                            <img
                              src={`${API_BASE}${file.url}`}
                              alt={`Evidence capture ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Audio */}
                {fileList.some((f: any) => f.type === 'audio') && (
                  <div>
                    <p className="text-[9px] font-bold text-textMuted uppercase mb-1.5">Ambient Audio Capture</p>
                    <div className="space-y-2">
                      {fileList
                        .filter((f: any) => f.type === 'audio')
                        .map((file: any, idx: number) => (
                          <div key={idx} className="bg-background p-2 rounded-lg border border-surfaceHighlight flex items-center gap-2">
                            <Mic className="w-4 h-4 text-emerald-400" />
                            <audio src={`${API_BASE}${file.url}`} controls className="w-full h-7 text-xs bg-transparent" />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Video */}
                {fileList.some((f: any) => f.type === 'video') && (
                  <div>
                    <p className="text-[9px] font-bold text-textMuted uppercase mb-1.5">Recorded Video Evidence</p>
                    <div className="space-y-2">
                      {fileList
                        .filter((f: any) => f.type === 'video')
                        .map((file: any, idx: number) => (
                          <div key={idx} className="bg-background p-2 rounded-lg border border-surfaceHighlight flex flex-col gap-1.5">
                            <video src={`${API_BASE}${file.url}`} controls className="w-full rounded bg-black aspect-video" />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
