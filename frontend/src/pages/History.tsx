import { useNavigate } from 'react-router-dom';
import {
  ImageIcon,
  VideoIcon,
  MicIcon,
  MapPinIcon,
  ClockIcon,
  ChevronRightIcon } from
'lucide-react';
import { Screen } from '../components/ui/Screen';
import { useApp } from '../context/AppContext';
import { ALERT_META, fmtDuration, fmtTime } from '../lib/mock';
import { AlertStatus } from '../lib/types';

const STATUS_STYLE: Record<AlertStatus, {label: string;color: string;}> = {
  sent: { label: 'Sent', color: '#00e676' },
  cancelled: { label: 'Cancelled', color: '#9a9a9a' },
  failed: { label: 'Failed', color: '#ff1744' },
  partial: { label: 'Partial', color: '#ff9100' },
  active: { label: 'Active', color: '#ff1744' }
};

export function History() {
  const nav = useNavigate();
  const { history } = useApp();

  return (
    <Screen title="Alert History" back>
      {history.length === 0 ?
      <div className="flex flex-col items-center justify-center py-24 text-center">
          <ClockIcon size={44} color="#333" />
          <p className="mt-4 font-bold text-white/60">No alerts yet</p>
          <p className="mt-1 text-sm text-white/30">Your alert log will appear here.</p>
        </div> :

      <div className="space-y-3">
          {history.map((h) => {
          const m = ALERT_META[h.type];
          const s = STATUS_STYLE[h.status];
          const dur = h.endedAt ? fmtDuration(h.endedAt - h.startedAt) : '—';
          return (
            <button
              key={h.id}
              onClick={() => nav(`/evidence/${h.id}`)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left active:scale-[0.99]">
              
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/6 text-xl">
                    {m.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{m.label}</p>
                    <p className="text-xs text-white/40">{fmtTime(h.startedAt)}</p>
                  </div>
                  <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `${s.color}22`, color: s.color }}>
                  
                    {s.label}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-white/60">
                  <span className="flex items-center gap-1">
                    <ClockIcon size={13} /> {dur}
                  </span>
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
                  <ChevronRightIcon size={16} color="#555" className="ml-auto" />
                </div>
                <p className="mt-2 text-[11px] text-white/40">
                  Notified: {h.deliveries.map((d) => d.contactName).join(', ') || 'None'}
                </p>
              </button>);

        })}
        </div>
      }
    </Screen>);

}