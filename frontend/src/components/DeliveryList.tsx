import { motion } from 'framer-motion';
import {
  MapPinIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  MessageSquareIcon,
  CheckIcon,
  RotateCwIcon,
  Loader2Icon,
  AlertTriangleIcon } from
'lucide-react';
import { useLiveAlert } from '../hooks/useLiveAlert';
import { ContactDelivery, SendState } from '../lib/types';

const CHANNELS: {key: keyof ContactDelivery;label: string;Icon: React.ComponentType<{ size?: number | string; color?: string }>;}[] = [
{ key: 'message', label: 'Alert message', Icon: MessageSquareIcon },
{ key: 'gps', label: 'GPS location', Icon: MapPinIcon },
{ key: 'photos', label: 'Photos', Icon: ImageIcon },
{ key: 'video', label: 'Video clip', Icon: VideoIcon },
{ key: 'audio', label: 'Audio', Icon: MicIcon }];


export function DeliveryList() {
  const { live, retry, acknowledge } = useLiveAlert();
  if (!live) return null;
  if (live.deliveries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
        No contacts configured — evidence is being stored locally.
      </div>);

  }

  return (
    <div className="space-y-3">
      {live.deliveries.map((d) =>
      <div key={d.contactId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-bold">{d.contactName}</span>
            {d.acknowledged ?
          <span className="rounded-full bg-[#00e676]/15 px-2 py-0.5 text-[11px] font-bold text-[#00e676]">
                Acknowledged
              </span> :

          <button
            onClick={() => acknowledge(d.contactId)}
            className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
            
                Mark acknowledged
              </button>
          }
          </div>
          <div className="space-y-2">
            {CHANNELS.map(({ key, label, Icon }) =>
          <div key={key} className="flex items-center gap-2.5">
                <Icon size={15} color="#888" />
                <span className="flex-1 text-sm text-white/70">{label}</span>
                <StatusPill
              state={d[key] as SendState}
              onRetry={() => retry(d.contactId, key)} />
            
              </div>
          )}
          </div>
        </div>
      )}
    </div>);

}

function StatusPill({ state, onRetry }: {state: SendState;onRetry: () => void;}) {
  if (state === 'sent')
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-[#00e676]">
        <CheckIcon size={14} strokeWidth={3} /> Sent
      </span>);

  if (state === 'sending')
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-[#ff9100]">
        <motion.span
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
        
          <Loader2Icon size={14} />
        </motion.span>
        Sending
      </span>);

  if (state === 'failed')
  return (
    <button
      onClick={onRetry}
      className="flex items-center gap-1 rounded-full bg-[#ff1744]/15 px-2 py-0.5 text-xs font-bold text-[#ff1744]">
      
        <RotateCwIcon size={12} /> Retry
      </button>);

  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-white/40">
      <AlertTriangleIcon size={12} /> Queued
    </span>);

}