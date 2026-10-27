import { motion } from 'framer-motion';
import { PhoneIcon, PhoneOffIcon, MessageSquareIcon } from 'lucide-react';

interface Props {
  caller?: string;
  onEnd: () => void;
}

/** A convincing incoming-call screen used as a stealth disguise. */
export function FakeCall({ caller = 'Mom', onEnd }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#111] px-6 py-16">
      <div className="mt-8 flex flex-col items-center">
        <p className="text-sm font-medium text-white/50">incoming call</p>
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="mt-8 flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-4xl font-bold">
          
          {(caller || 'M').slice(0, 1).toUpperCase()}
        </motion.div>
        <h2 className="mt-6 text-3xl font-bold">Mom</h2>
        <p className="mt-1 text-white/50">mobile</p>
      </div>

      <div className="flex w-full items-center justify-between px-6">
        <button
          onClick={onEnd}
          className="flex flex-col items-center gap-2"
          aria-label="Decline call">
          
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff1744]">
            <PhoneOffIcon size={26} color="#fff" />
          </span>
          <span className="text-xs text-white/60">Decline</span>
        </button>
        <button className="flex flex-col items-center gap-2" aria-label="Message">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <MessageSquareIcon size={24} color="#fff" />
          </span>
          <span className="text-xs text-white/60">Message</span>
        </button>
        <button
          onClick={onEnd}
          className="flex flex-col items-center gap-2"
          aria-label="Accept call">
          
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00e676]">
            
            <PhoneIcon size={26} color="#000" />
          </motion.span>
          <span className="text-xs text-white/60">Accept</span>
        </button>
      </div>
    </div>);

}