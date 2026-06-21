import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import {
  ShieldAlert,
  LogIn,
  UserPlus,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Wifi,
  Camera,
  MapPin,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─────────────────────────────────────────────
   Floating particle dot
───────────────────────────────────────────── */
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  color: string;
}

function ParticleBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    const particles: Particle[] = [];
    const colors = ['#ef4444', '#f97316', '#ec4899'];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 38; i++) {
      particles.push({
        id: i,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.5,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.4 + 0.05,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < -4) p.y = canvas.height + 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

/* ─────────────────────────────────────────────
   Feature badge
───────────────────────────────────────────── */
const features = [
  { icon: MapPin, label: 'Live GPS' },
  { icon: Camera, label: 'Auto Capture' },
  { icon: Bell, label: 'SOS Alerts' },
  { icon: Wifi, label: 'Real-Time' },
];

/* ─────────────────────────────────────────────
   Main Auth component
───────────────────────────────────────────── */
export function Auth() {
  const { login, register, resetPassword } = useApp();
  const [showIntro, setShowIntro] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (showIntro) {
    return (
      <div className="relative flex flex-col w-full min-h-screen bg-[#0a0a0f] overflow-y-auto no-scrollbar text-white">
        <ParticleBg />
        
        {/* Gradient orbs */}
        <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full bg-red-600/20 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-pink-600/15 blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-6 py-10 w-full max-w-md mx-auto">
          {/* Logo / Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="relative mb-6"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/30 to-pink-600/20 border border-red-500/30 flex items-center justify-center shadow-lg shadow-red-900/40">
              <ShieldAlert className="w-10 h-10 text-red-400 animate-pulse" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-red-500/40 animate-ping opacity-25" style={{ animationDuration: '3s' }} />
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-black tracking-tight text-white mb-2"
          >
            SilentSOS
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-red-400 font-bold tracking-widest uppercase mb-6"
          >
            Discreet Personal Safety Assistant
          </motion.p>

          {/* Description Text */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/[0.03] border border-white/5 backdrop-blur-md rounded-2xl p-5 mb-6 text-center shadow-xl"
          >
            <p className="text-sm text-white/70 leading-relaxed">
              SilentSOS is designed to protect you in critical moments. Using intelligent real-time gesture recognition, location tracking, and silent evidence capture, it keeps your emergency contacts informed instantly and securely.
            </p>
          </motion.div>

          {/* Features bullet points */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full space-y-3.5 mb-8 text-left"
          >
            {[
              { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', title: 'Stealth Activation', desc: 'Blink patterns or raised palms trigger distress signal silently.' },
              { icon: MapPin, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Live Location Tracking', desc: 'Broadcasts your live GPS coordinates directly to responders.' },
              { icon: Camera, color: 'text-purple-400', bg: 'bg-purple-500/10', title: 'Secure Evidence Vault', desc: 'Captures and locks photos, audio, and video in the cloud.' },
              { icon: Bell, color: 'text-orange-400', bg: 'bg-orange-500/10', title: 'Automated Dispatch', desc: 'Notifies emergency contacts via SMS, WhatsApp, and Email.' }
            ].map((f, i) => (
              <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
                <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center shrink-0`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">{f.title}</h4>
                  <p className="text-[11px] text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Get Started Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowIntro(false)}
            className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 cursor-pointer"
          >
            Get Started <User className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    );
  }

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setIsForgot(false);
    setError(null);
    setEmail('');
    setPassword('');
    setName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isForgot) {
        await resetPassword(email, password);
        setSuccess(true);
        setTimeout(() => {
          setIsForgot(false);
          setIsLogin(true);
          setSuccess(false);
          setPassword('');
          setError(null);
        }, 2200);
      } else if (isLogin) {
        await login(email, password);
      } else {
        if (!name.trim()) throw new Error('Please enter your full name');
        await register(email, password, name);
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col w-full min-h-screen bg-[#0a0a0f] overflow-hidden text-white">
      {/* Animated particle background */}
      <ParticleBg />

      {/* Gradient orbs */}
      <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full bg-red-600/20 blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-pink-600/15 blur-[80px] pointer-events-none" />

      <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-5 py-10 w-full max-w-md mx-auto">

        {/* ── Logo / Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center mb-8 text-center"
        >
          {/* Animated shield */}
          <div className="relative mb-4">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/30 to-pink-600/20 border border-red-500/30 flex items-center justify-center shadow-lg shadow-red-900/40"
            >
              <ShieldAlert className="w-10 h-10 text-red-400" />
            </motion.div>
            {/* Pulse ring */}
            <motion.div
              animate={{ scale: [1, 1.55], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-2xl border-2 border-red-500/40"
            />
          </div>

          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-white to-red-300 bg-clip-text text-transparent">
            SilentSOS
          </h1>
          <p className="text-xs text-white/40 mt-1.5 font-medium tracking-wide">
            WOMEN'S SAFETY & EMERGENCY ALERT
          </p>

          {/* Feature badges */}
          <div className="flex gap-2 mt-4 flex-wrap justify-center">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/50 font-medium"
              >
                <Icon className="w-3 h-3 text-red-400" />
                {label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── Auth Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
          className="w-full"
        >
          <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden">
            {/* Top glow line */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

            {/* Tab switcher or Forgot password Header */}
            {isForgot ? (
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Reset Password</h2>
                <p className="text-xs text-white/40 mt-1 font-medium">Enter your email and new password</p>
              </div>
            ) : (
              <div className="relative flex bg-black/30 rounded-xl p-1 mb-6 border border-white/8">
                {/* Sliding indicator */}
                <motion.div
                  layout
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-br from-red-600 to-red-700 shadow-lg shadow-red-900/40"
                  style={{ left: isLogin ? '4px' : 'calc(50%)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                />
                <button
                  type="button"
                  onClick={() => switchTab(true)}
                  className={`relative flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors z-10 ${
                    isLogin ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchTab(false)}
                  className={`relative flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors z-10 ${
                    !isLogin ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Sign Up
                </button>
              </div>
            )}

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success banner */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="bg-green-500/10 border border-green-500/20 text-green-300 text-xs p-3 rounded-xl">
                    {isForgot ? '✅ Password reset successful! Redirecting to login...' : '✅ Account created! Signing you in…'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (Sign Up only) */}
              <AnimatePresence initial={false}>
                {!isLogin && !isForgot && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sarah Smith"
                        required={!isLogin && !isForgot}
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm placeholder-white/20 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 outline-none transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm placeholder-white/20 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {isForgot ? 'New Password' : 'Password'}
                  </label>
                  {isLogin && !isForgot && (
                    <button
                      type="button"
                      onClick={() => setIsForgot(true)}
                      className="text-[10px] text-red-400/70 hover:text-red-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete={isForgot ? 'new-password' : isLogin ? 'current-password' : 'new-password'}
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm placeholder-white/20 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-red-900/40"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isForgot ? (
                  <><ShieldAlert className="w-4 h-4" /> Reset Password</>
                ) : isLogin ? (
                  <><LogIn className="w-4 h-4" /> Sign In to SilentSOS</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Create My Account</>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[10px] text-white/25 font-medium">OR</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Switch tab link */}
            <p className="text-center text-xs text-white/35">
              {isForgot ? (
                <button
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="text-red-400 font-semibold hover:text-red-300 transition-colors underline underline-offset-2"
                >
                  Back to Sign In
                </button>
              ) : isLogin ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchTab(false)}
                    className="text-red-400 font-semibold hover:text-red-300 transition-colors underline underline-offset-2"
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchTab(true)}
                    className="text-red-400 font-semibold hover:text-red-300 transition-colors underline underline-offset-2"
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-[10px] text-white/20 text-center mt-6 max-w-[280px] leading-relaxed"
        >
          By continuing you authorize secure cloud storage of your evidence, coordinates, and alert logs.
        </motion.p>
      </div>
    </div>
  );
}
