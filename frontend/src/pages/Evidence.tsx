import { useState, useEffect } from 'react';
import { useApp, MEDIA_BASE } from '../AppContext';
import {
  Folder,
  Image as ImageIcon,
  Video,
  Mic,
  MapPin,
  Download,
  ChevronRight,
  ChevronDown,
  Lock,
  X,
  ZoomIn,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// ── Lightbox for full-screen photo view ──────────────────────
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2 transition-all"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

export function Evidence() {
  const { state, refreshHistory, deleteAlert } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  
  // Deletion PIN states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => { refreshHistory(); }, []);

  const toggleExpand = (id: string) =>
    setExpandedId(expandedId === id ? null : id);

  const handlePinKeyPress = (num: string) => {
    setPinError(false);
    if (enteredPin.length < 4) {
      const newPin = enteredPin + num;
      setEnteredPin(newPin);
      
      // Auto-submit on 4 digits
      if (newPin.length === 4) {
        const targetPin = state.settings.safetyPin || '1234';
        if (newPin === targetPin) {
          if (confirmDeleteId) {
            deleteAlert(confirmDeleteId);
          }
          setConfirmDeleteId(null);
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

  const handlePinBackspace = () => {
    setPinError(false);
    setEnteredPin(p => p.slice(0, -1));
  };

  useEffect(() => {
    if (!confirmDeleteId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handlePinBackspace();
      } else if (e.key === 'Escape') {
        setConfirmDeleteId(null);
        setEnteredPin('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteId, enteredPin, state.settings.safetyPin]);

  // ── Media URL builder ───────────────────────────────────────
  const mediaUrl = (fileUrl: string) => `${MEDIA_BASE}${fileUrl}`;

  // ── Download single file ────────────────────────────────────
  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  // ── Download GPS log ────────────────────────────────────────
  const handleDownloadGPS = (event: any) => {
    if (!event.gpsPath?.length) return;
    const blob = new Blob([JSON.stringify(event.gpsPath, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gps_${event.id}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Download everything ─────────────────────────────────────
  const handleDownloadAll = (event: any) => {
    handleDownloadGPS(event);
    const files: any[] = event.evidence?.files || [];
    files.forEach((file, i) => {
      setTimeout(() => {
        const ext = file.url.split('.').pop()?.split('?')[0] || 'dat';
        handleDownload(mediaUrl(file.url), `sos_${event.id}_${file.type}_${i + 1}.${ext}`);
      }, i * 500);
    });
  };

  const totalMB = state.history.length * 12.5;
  const storagePct = Math.min((totalMB / 1024) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-background p-4 overflow-y-auto no-scrollbar pb-24">
      <h1 className="text-2xl font-bold mb-5 text-white">Evidence Vault</h1>

      {/* Storage bar */}
      <div className="bg-surface p-4 rounded-xl border border-surfaceHighlight mb-5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-textMuted">Encrypted Storage</span>
          <span className="font-medium text-white">{totalMB.toFixed(1)} MB / 1 GB</span>
        </div>
        <div className="w-full h-2 bg-surfaceHighlight rounded-full overflow-hidden">
          <div className={`h-full transition-all ${storagePct > 90 ? 'bg-emergency' : 'bg-safe'}`}
               style={{ width: `${storagePct}%` }} />
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-safe">
          <Lock className="w-3 h-3" /> AES-256 encrypted
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxSrc && (
          <Lightbox src={lightboxSrc} alt="Evidence" onClose={() => setLightboxSrc(null)} />
        )}
      </AnimatePresence>

      {state.history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-textMuted">
          <Folder className="w-16 h-16 mb-4 opacity-20" />
          <p>No evidence yet.</p>
          <p className="text-xs mt-1 opacity-60">Trigger an SOS to start capturing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.history.map((event) => {
            const files: any[] = event.evidence?.files || [];
            const photos = files.filter(f => f.type === 'photo');
            const audios  = files.filter(f => f.type === 'audio');
            const videos  = files.filter(f => f.type === 'video');
            const hasGPS  = event.gpsPath?.length > 0;
            const assetCount = files.length + (hasGPS ? 1 : 0);

            return (
              <div key={event.id} className="bg-surface border border-surfaceHighlight rounded-xl overflow-hidden">

                {/* Header */}
                <button
                  onClick={() => toggleExpand(event.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-surfaceHighlight transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-surfaceHighlight p-2 rounded-lg">
                      <Folder className="w-5 h-5 text-safe" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-white">
                        SOS_{format(event.timestamp, 'yyyy-MM-dd_HHmm')}
                      </p>
                      <p className="text-xs text-textMuted">
                        {event.type} •{' '}
                        {photos.length > 0 && `${photos.length} photo${photos.length > 1 ? 's' : ''} `}
                        {audios.length > 0 && `${audios.length} audio `}
                        {videos.length > 0 && `${videos.length} video `}
                        {assetCount === 0 ? 'No media' : ''}
                      </p>
                    </div>
                  </div>
                  {expandedId === event.id
                    ? <ChevronDown className="w-5 h-5 text-textMuted shrink-0" />
                    : <ChevronRight className="w-5 h-5 text-textMuted shrink-0" />}
                </button>

                {/* Expanded */}
                <AnimatePresence>
                  {expandedId === event.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-surfaceHighlight bg-background/50 overflow-hidden"
                    >
                      <div className="p-4 space-y-5">

                        {/* ── PHOTOS GRID ── */}
                        {photos.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2.5">
                              <ImageIcon className="w-4 h-4 text-safe" />
                              <span className="text-xs font-bold text-white uppercase tracking-wide">
                                Photos ({photos.length})
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {photos.map((file, idx) => {
                                const src = mediaUrl(file.url);
                                const errKey = `${event.id}-${idx}`;
                                return (
                                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-surfaceHighlight">
                                    {imgErrors[errKey] ? (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-textMuted text-[10px]">
                                        <ImageIcon className="w-6 h-6 mb-1 opacity-40" />
                                        Photo {idx + 1}
                                      </div>
                                    ) : (
                                      <img
                                        src={src}
                                        alt={`Photo ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={() => setImgErrors(e => ({ ...e, [errKey]: true }))}
                                      />
                                    )}
                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => setLightboxSrc(src)}
                                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                                        title="View full size"
                                      >
                                        <ZoomIn className="w-3.5 h-3.5 text-white" />
                                      </button>
                                      <button
                                        onClick={() => handleDownload(src, `photo_${event.id}_${idx + 1}.jpg`)}
                                        className="p-1.5 bg-safe/30 rounded-lg hover:bg-safe/50 transition-all"
                                        title="Download"
                                      >
                                        <Download className="w-3.5 h-3.5 text-white" />
                                      </button>
                                    </div>
                                    {/* Index badge */}
                                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1 rounded">
                                      {idx + 1}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── AUDIO ── */}
                        {audios.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2.5">
                              <Mic className="w-4 h-4 text-sky-400" />
                              <span className="text-xs font-bold text-white uppercase tracking-wide">
                                Audio Recording ({audios.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {audios.map((file, idx) => (
                                <div key={idx} className="bg-surfaceHighlight rounded-xl p-3 border border-white/5">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] text-textMuted">Recording {idx + 1}</span>
                                    <button
                                      onClick={() => handleDownload(mediaUrl(file.url), `audio_${event.id}_${idx + 1}.wav`)}
                                      className="p-1 bg-sky-500/20 hover:bg-sky-500/40 rounded-lg transition-all"
                                    >
                                      <Download className="w-3 h-3 text-sky-400" />
                                    </button>
                                  </div>
                                  <audio
                                    src={mediaUrl(file.url)}
                                    controls
                                    className="w-full h-8"
                                    style={{ accentColor: '#38bdf8' }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── VIDEO ── */}
                        {videos.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2.5">
                              <Video className="w-4 h-4 text-purple-400" />
                              <span className="text-xs font-bold text-white uppercase tracking-wide">
                                Video ({videos.length})
                              </span>
                            </div>
                            <div className="space-y-2">
                              {videos.map((file, idx) => (
                                <div key={idx} className="bg-surfaceHighlight rounded-xl p-3 border border-white/5">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] text-textMuted">Clip {idx + 1}</span>
                                    <button
                                      onClick={() => handleDownload(mediaUrl(file.url), `video_${event.id}_${idx + 1}.mp4`)}
                                      className="p-1 bg-purple-500/20 hover:bg-purple-500/40 rounded-lg transition-all"
                                    >
                                      <Download className="w-3 h-3 text-purple-400" />
                                    </button>
                                  </div>
                                  <video
                                    src={mediaUrl(file.url)}
                                    controls
                                    playsInline
                                    className="w-full rounded-lg bg-black aspect-video"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── GPS ── */}
                        {hasGPS && (
                          <div className="flex items-center justify-between bg-surfaceHighlight rounded-xl p-3 border border-white/5">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emergency" />
                              <div>
                                <p className="text-xs font-bold text-white">GPS Route Log</p>
                                <p className="text-[10px] text-textMuted">{event.gpsPath.length} coordinate points</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadGPS(event)}
                              className="flex items-center gap-1 text-[10px] font-bold text-safe bg-safe/10 border border-safe/20 px-2.5 py-1.5 rounded-lg hover:bg-safe/20 transition-all"
                            >
                              <Download className="w-3 h-3" /> GPS JSON
                            </button>
                          </div>
                        )}

                        {/* No media message */}
                        {files.length === 0 && (
                          <p className="text-xs text-textMuted italic text-center py-3">
                            No media files captured for this alert.
                          </p>
                        )}

                        {/* ── DOWNLOAD ALL & DELETE ── */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleDownloadAll(event)}
                            disabled={assetCount === 0}
                            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/30 border border-white/10"
                          >
                            <Download className="w-4 h-4" />
                            Download All Evidence
                            {assetCount > 0 && (
                              <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                                {assetCount} files
                              </span>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setConfirmDeleteId(event.id);
                              setEnteredPin('');
                              setPinError(false);
                            }}
                            className="px-4 py-3.5 bg-emergency/10 hover:bg-emergency/20 border border-emergency/30 text-emergency font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-95 shadow-lg shadow-red-950/30"
                            title="Delete this evidence folder"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* PIN Verification Modal for Deletion */}
      <AnimatePresence>
        {confirmDeleteId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-xs w-full flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-surfaceHighlight border border-white/10 flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-warning" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Delete Evidence Folder
              </h3>
              <p className="text-xs text-textMuted mb-8 leading-relaxed">
                Please enter your safety PIN to confirm deletion of this evidence record. This action cannot be undone.
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
                    onClick={() => handlePinKeyPress(num)}
                    className="aspect-square rounded-full bg-surfaceHighlight hover:bg-surface border border-white/5 text-xl font-bold text-white flex items-center justify-center transition-all active:scale-90"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setConfirmDeleteId(null);
                    setEnteredPin('');
                  }}
                  className="aspect-square rounded-full text-xs font-bold text-textMuted flex items-center justify-center hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePinKeyPress('0')}
                  className="aspect-square rounded-full bg-surfaceHighlight hover:bg-surface border border-white/5 text-xl font-bold text-white flex items-center justify-center transition-all active:scale-90"
                >
                  0
                </button>
                <button
                  onClick={handlePinBackspace}
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