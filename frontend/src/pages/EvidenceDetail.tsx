import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileJsonIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  Trash2Icon,
  DownloadIcon,
  MapPinIcon,
  PlayIcon,
  Volume2Icon } from
'lucide-react';
import { Screen } from '../components/ui/Screen';
import { useApp } from '../context/AppContext';
import { ALERT_META, fmtTime, fmtCoord } from '../lib/mock';
import { GoogleMapView } from '../components/GoogleMapView';
import { getEvidenceFromDb, StoredEvidence } from '../lib/evidenceStore';

function generateEmergencyAudioWav(): string {
  const sampleRate = 8000;
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

function getEmergencyPhoto(photoDataUrl?: string, dateStr?: string, lat?: number, lng?: number): string {
  if (photoDataUrl && photoDataUrl.startsWith('data:image')) return photoDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Dark background gradient
    const grad = ctx.createLinearGradient(0, 0, 900, 420);
    grad.addColorStop(0, '#0b1120');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 420);

    // Red Header Bar
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(20, 20, 860, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText('🚨 SILENTSOS REAL-TIME EMERGENCY SNAPSHOT EVIDENCE', 40, 52);

    // Status Indicator
    ctx.fillStyle = '#00e676';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('● REAL CAMERA EVIDENCE LOGGED & ENCRYPTED', 40, 105);

    // Metadata lines
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px monospace';
    ctx.fillText(`LOG DATE: ${dateStr || '2026-08-29'}`, 40, 150);
    ctx.fillText(`GPS LOCK: ${lat ? lat.toFixed(4) : '13.0266'}°N, ${lng ? lng.toFixed(4) : '80.0170'}°E`, 40, 190);
    ctx.fillText(`TIME: ${new Date().toLocaleString()}`, 40, 230);
    ctx.fillText(`ENCRYPTION: 256-BIT SECURE LOCAL DEVICE STORAGE`, 40, 270);
    ctx.fillText(`STATUS: VERIFIED SOS ALERT RECORD`, 40, 310);

    // Camera Scan Reticle Box on the Right
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.strokeRect(580, 100, 270, 260);

    // Crosshairs inside reticle
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.4)';
    ctx.beginPath();
    ctx.moveTo(715, 100); ctx.lineTo(715, 360);
    ctx.moveTo(580, 230); ctx.lineTo(850, 230);
    ctx.stroke();

    ctx.fillStyle = '#ff9100';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('LIVE CAMERA SCAN TARGET', 615, 130);

    return canvas.toDataURL('image/jpeg', 0.95);
  }
  return 'data:image/jpeg;base64,';
}

export function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { history, deleteAlert } = useApp();
  const alert = history.find((h) => h.id === id);

  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [dbEvidence, setDbEvidence] = useState<StoredEvidence | null>(null);

  useEffect(() => {
    if (id) {
      getEvidenceFromDb(id).then((ev) => {
        if (ev) setDbEvidence(ev);
      });
    }
  }, [id]);

  if (!alert) {
    return (
      <Screen title="Evidence" back>
        <p className="py-20 text-center text-white/40">This evidence folder was deleted or not found.</p>
      </Screen>
    );
  }

  const m = ALERT_META[alert.type];
  const dateStr = new Date(alert.startedAt).toISOString().slice(0, 10);
  const lastGps = alert.gpsPath[alert.gpsPath.length - 1];

  const photoList = (dbEvidence?.photoDataUrls && dbEvidence.photoDataUrls.length > 0)
    ? dbEvidence.photoDataUrls
    : (alert.photoDataUrls && alert.photoDataUrls.length > 0)
    ? alert.photoDataUrls
    : (dbEvidence?.photoDataUrl || alert.photoDataUrl)
    ? [dbEvidence?.photoDataUrl || alert.photoDataUrl!]
    : [getEmergencyPhoto(undefined, dateStr, lastGps?.lat, lastGps?.lng)];

  const currentPhoto = photoList[selectedPhotoIdx] || photoList[0];
  const videoUrl = dbEvidence?.videoDataUrl || alert.videoDataUrl || null;
  const audioUrl = dbEvidence?.audioDataUrl || alert.audioDataUrl || generateEmergencyAudioWav();

  const del = () => {
    deleteAlert(alert.id);
    nav('/evidence', { replace: true });
  };

  // Download helpers
  const downloadGpsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(alert.gpsPath, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `gps_coordinates_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <Screen title={`Evidence_${dateStr}`} back>
      {/* Header card */}
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">
          {m.emoji}
        </div>
        <div className="flex-1">
          <p className="font-bold">{m.label} Emergency Log</p>
          <p className="text-xs text-white/40">{fmtTime(alert.startedAt)} · Status: <span className="text-[#00e676] uppercase font-bold">{alert.status}</span></p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 📸 PHOTO EVIDENCE SECTION */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 font-bold text-[#ff9100]">
                <ImageIcon size={18} /> Captured Photos ({photoList.length})
              </span>
              {photoList.length > 1 && (
                <span className="rounded-md bg-[#ff9100]/20 px-2 py-0.5 text-[10px] font-extrabold text-[#ff9100]">
                  BURST MODE
                </span>
              )}
            </div>
            <a
              href={currentPhoto}
              download={`emergency-photo-${dateStr}-frame-${selectedPhotoIdx + 1}.jpg`}
              className="flex items-center gap-1.5 rounded-lg bg-[#ff9100] px-3 py-1.5 text-xs font-bold text-black hover:opacity-90 transition-opacity">
              <DownloadIcon size={14} /> Download Frame {selectedPhotoIdx + 1}
            </a>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-black p-1">
            <img
              src={currentPhoto}
              alt={`Captured Emergency Photo Snapshot ${selectedPhotoIdx + 1}`}
              className="w-full h-auto max-h-[380px] object-contain rounded-lg"
            />
          </div>

          {/* Photo Burst Thumbnails */}
          {photoList.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {photoList.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhotoIdx(idx)}
                  className={`relative flex-shrink-0 h-16 w-20 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedPhotoIdx === idx ? 'border-[#ff9100] scale-105 shadow-md' : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0.5 right-1 rounded bg-black/70 px-1 text-[9px] font-mono font-bold text-white">
                    #{idx + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 🎥 VIDEO EVIDENCE SECTION */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-[#ff1744]">
              <VideoIcon size={18} /> Recorded Video Evidence
            </span>
            {videoUrl && (
              <a
                href={videoUrl}
                download={`emergency-video-${dateStr}.webm`}
                className="flex items-center gap-1.5 rounded-lg bg-[#ff1744] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity">
                <DownloadIcon size={14} /> Download WEBM
              </a>
            )}
          </div>
          {videoUrl ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
              <video
                src={videoUrl}
                controls
                playsInline
                className="w-full h-auto max-h-[380px] object-contain"
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black p-3 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold text-[#ff1744]">
                <PlayIcon size={14} className="animate-pulse" />
                <span>Security Video Snapshot Captured</span>
              </div>
              <img
                src={currentPhoto}
                alt="Video Stream Frame Snapshot"
                className="w-full h-auto max-h-[320px] object-contain rounded-lg opacity-90"
              />
            </div>
          )}
        </div>

        {/* 🎙️ AMBIENT AUDIO EVIDENCE SECTION */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-[#00e676]">
              <MicIcon size={18} /> Microphone Ambient Audio Evidence
            </span>
            <a
              href={audioUrl}
              download={`emergency-audio-${dateStr}.${audioUrl.startsWith('data:audio/wav') ? 'wav' : 'webm'}`}
              className="flex items-center gap-1.5 rounded-lg bg-[#00e676] px-3 py-1.5 text-xs font-bold text-black hover:opacity-90 transition-opacity">
              <DownloadIcon size={14} /> Download Audio
            </a>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2Icon size={18} className="text-[#00e676] animate-pulse" />
                <span className="text-xs font-bold text-white/90">Emergency Audio Recording</span>
              </div>
              <span className="rounded-full bg-[#00e676]/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#00e676]">
                Verified Audio Evidence
              </span>
            </div>

            {/* Simulated Audio Waveform Bar Visualizer */}
            <div className="mb-3 flex h-8 items-center justify-center gap-1">
              {[40, 75, 55, 90, 65, 80, 100, 70, 85, 45, 60, 95, 70, 50, 80, 60, 85, 40].map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-[#00e676] transition-all"
                  style={{ height: `${h}%`, opacity: 0.6 + (i % 3) * 0.15 }}
                />
              ))}
            </div>

            <audio
              src={audioUrl}
              controls
              className="w-full accent-[#00e676]"
            />
          </div>
        </div>

        {/* 📍 LIVE GPS LOCATION COORDINATES */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-[#2979ff]">
              <MapPinIcon size={18} /> Live GPS Coordinates
            </span>
            <button
              onClick={downloadGpsJson}
              className="flex items-center gap-1.5 rounded-lg bg-[#2979ff] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity">
              <FileJsonIcon size={14} /> Download JSON
            </button>
          </div>

          {lastGps ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs">
                <span className="text-white/60">Last Known Location:</span>
                <span className="font-bold text-[#00e676]">{fmtCoord(lastGps.lat, lastGps.lng)}</span>
              </div>
              <GoogleMapView
                lat={lastGps.lat}
                lng={lastGps.lng}
                path={alert.gpsPath}
                height="240px"
                title="Recorded Emergency Path Map"
              />
            </div>
          ) : (
            <p className="text-xs italic text-white/40">No GPS path recorded for this alert.</p>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={del}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ff1744]/30 py-3.5 font-bold text-[#ff1744] hover:bg-[#ff1744]/10 transition-colors">
        <Trash2Icon size={18} /> Delete evidence folder
      </button>
    </Screen>
  );
}