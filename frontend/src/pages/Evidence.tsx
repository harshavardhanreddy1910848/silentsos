import { useNavigate } from 'react-router-dom';
import {
  FolderIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  MapPinIcon,
  DownloadIcon,
  HardDriveIcon,
  AlertTriangleIcon } from
'lucide-react';
import { Screen } from '../components/ui/Screen';
import { useApp } from '../context/AppContext';
import { ALERT_META, fmtTime } from '../lib/mock';

export function Evidence() {
  const nav = useNavigate();
  const { history } = useApp();

  // rough simulated storage figure
  const usedMb = history.reduce(
    (a, h) => a + h.photoCount * 2 + h.videoCount * 14 + h.audioCount * 1,
    0
  );
  const limitMb = 2048;
  const pct = Math.min(100, usedMb / limitMb * 100);
  const low = limitMb - usedMb < 500;

  const exportAll = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `silentsos_all_evidence_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <Screen title="Evidence">
      {/* storage */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <HardDriveIcon size={18} color="#fff" />
          <span className="font-bold">Local storage</span>
          <span className="ml-auto text-sm text-white/50">
            {usedMb} MB / {limitMb} MB
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: low ? '#ff1744' : '#00e676' }} />
          
        </div>
        {low &&
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#ff1744]">
            <AlertTriangleIcon size={14} /> Less than 500 MB free — export or delete old evidence.
          </p>
        }
      </div>

      {history.length === 0 ?
      <Empty /> :

      <>
          <button
            onClick={exportAll}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 font-bold hover:bg-white/20 active:scale-[0.99] transition-all">
            <DownloadIcon size={18} /> Export All Evidence Records (JSON)
          </button>
          <div className="space-y-3">
            {history.map((h) => {
            const m = ALERT_META[h.type];
            return (
              <button
                key={h.id}
                onClick={() => nav(`/evidence/${h.id}`)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99]">
                
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/6 text-xl">
                      {m.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">
                        Alert_{new Date(h.startedAt).toISOString().slice(0, 10)}
                      </p>
                      <p className="text-xs text-white/40">{fmtTime(h.startedAt)}</p>
                    </div>
                    <FolderIcon size={20} color="#666" />
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-white/60">
                    <span className="flex items-center gap-1">
                      <ImageIcon size={13} /> {h.photoCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <VideoIcon size={13} /> {h.videoCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MicIcon size={13} /> {h.audioCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPinIcon size={13} /> {h.gpsPath.length}
                    </span>
                  </div>
                </button>);

          })}
          </div>
        </>
      }
    </Screen>);

}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FolderIcon size={48} color="#333" />
      <p className="mt-4 font-bold text-white/60">No evidence yet</p>
      <p className="mt-1 max-w-[220px] text-sm text-white/30">
        Evidence folders appear here automatically after each alert.
      </p>
    </div>);

}