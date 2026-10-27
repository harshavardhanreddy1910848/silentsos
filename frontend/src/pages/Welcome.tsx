import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  CameraIcon,
  MapPinIcon,
  MicIcon,
  ShieldCheckIcon,
  WifiOffIcon } from
'lucide-react';

const FEATURES = [
{
  Icon: ShieldCheckIcon,
  title: 'Silent activation',
  detail: 'Tap, shake, or use a pre-set camera gesture.',
  color: '#ff1744'
},
{
  Icon: CameraIcon,
  title: 'Evidence, automatically',
  detail: 'Capture photo, video, and ambient audio instantly.',
  color: '#ff9100'
},
{
  Icon: MapPinIcon,
  title: 'Live location',
  detail: 'Share precise GPS updates with trusted contacts.',
  color: '#00e676'
},
{
  Icon: WifiOffIcon,
  title: 'Always backed up',
  detail: 'Evidence stays securely queued when you are offline.',
  color: '#2979ff'
}];


/** The first product-facing screen before authentication. */
export function Welcome() {
  const nav = useNavigate();

  return (
    <div className="no-scrollbar flex h-full overflow-y-auto bg-[#0a0a0a]">
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-6 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff1744] shadow-[0_0_28px_rgba(255,23,68,0.35)]">
              <ShieldCheckIcon size={22} color="#fff" strokeWidth={2.6} />
            </div>
            <span className="text-lg font-black tracking-tight">SilentSOS</span>
          </div>
          <button
            onClick={() => nav('/auth')}
            className="rounded-xl px-3 py-2 text-sm font-bold text-white/70 hover:bg-white/5 hover:text-white">
            
            Sign in
          </button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-12 lg:py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <section>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}>
                
                <p className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-[#ff1744]">
                  Non-verbal emergency support
                </p>
                <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                  When words fail, <span className="text-[#ff1744]">SilentSOS</span> speaks for you.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
                  A quiet way to alert people you trust, capture evidence, and share your
                  live location in the moments you cannot safely speak, type, or make noise.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.45 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row">
                
                <button
                  onClick={() => nav('/auth')}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#ff1744] px-6 text-base font-black shadow-[0_0_32px_rgba(255,23,68,0.28)] transition-transform active:scale-[0.98]">
                  
                  Protect yourself <ArrowRightIcon size={19} />
                </button>
                <p className="flex items-center justify-center gap-2 px-2 text-center text-xs leading-snug text-white/40 sm:max-w-48 sm:text-left">
                  <MicIcon size={15} /> Setup takes less than two minutes.
                </p>
              </motion.div>
            </section>

            <motion.section
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="relative rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 sm:p-6">
              
              <div className="absolute -right-6 top-10 h-32 w-32 rounded-full bg-[#ff1744]/10 blur-3xl" />
              <div className="relative flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#00e676]" />
                  <span className="text-sm font-bold text-[#00e676]">System armed & ready</span>
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/45">DEMO</span>
              </div>
              <div className="flex flex-col items-center py-8 sm:py-10">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-[#ff1744]/40 bg-[#ff1744]/10 sm:h-48 sm:w-48">
                  <motion.div
                    className="absolute inset-3 rounded-full border border-[#ff1744]/40"
                    animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 2.2 }} />
                  
                  <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#ff1744] shadow-[0_0_44px_rgba(255,23,68,0.55)] sm:h-32 sm:w-32">
                    <span className="text-3xl font-black">SOS</span>
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/70">Silent alert</span>
                  </div>
                </div>
                <p className="mt-6 text-sm font-semibold text-white/50">One tap. Five seconds to cancel.</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-black/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPinIcon size={16} color="#00e676" />
                  <span className="font-mono text-xs font-bold text-[#00e676]">19.0760°N, 72.8777°E</span>
                </div>
                <span className="text-[11px] font-semibold text-white/40">GPS LIVE</span>
              </div>
            </motion.section>
          </div>

          <section className="mt-14 grid gap-3 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
            {FEATURES.map(({ Icon, title, detail, color }, i) =>
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.06, duration: 0.4 }}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              
                <Icon size={21} color={color} />
                <h2 className="mt-4 text-sm font-black">{title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/45">{detail}</p>
              </motion.article>
            )}
          </section>
        </main>

        <footer className="pt-4 text-center text-[11px] text-white/35">
          SilentSOS stores emergency setup and evidence locally on this device.
        </footer>
      </div>
    </div>);
}