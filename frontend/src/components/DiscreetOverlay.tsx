import { useRef } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onExit: () => void;
  onTrigger: () => void;
}

/**
 * Full black screen. The app keeps "recording" (GPS/camera/mic) silently.
 * Triple-tap anywhere fires an alert; a long-press on the hidden corner dot exits.
 */
export function DiscreetOverlay({ onExit, onTrigger }: Props) {
  const taps = useRef<number[]>([]);

  const handleTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 600), now];
    if (taps.current.length >= 3) {
      taps.current = [];
      onTrigger();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black"
      onClick={handleTap}
      role="button"
      aria-label="Discreet mode active. Triple tap to send alert.">
      
      {/* barely-visible active indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
        <span className="mx-auto block h-1 w-1 animate-pulse rounded-full bg-[#ff1744]/60" />
      </div>
      {/* hidden exit dot */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
        aria-label="Exit discreet mode"
        className="absolute right-3 top-3 h-8 w-8 rounded-full"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)' }} />
      
    </motion.div>);

}