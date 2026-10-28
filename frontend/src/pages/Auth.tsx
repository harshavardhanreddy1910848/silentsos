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
  KeyRound,
  Sparkles,
  Send,
  CheckCircle2,
  RefreshCw,
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
  const { login, register, resetPassword, requestPasswordReset, sendAuthToken, verifyAuthToken } = useApp();
  const [showIntro, setShowIntro] = useState(() => {
    return localStorage.getItem('silentsos_has_seen_intro') !== 'true';
  });
  const [authTab, setAuthTab] = useState<'login' | 'token' | 'register'>('login');
  const [isForgot, setIsForgot] = useState(false);
  const [forgotCodeSent, setForgotCodeSent] = useState(false);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotFeedback, setForgotFeedback] = useState<string | null>(null);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tokenCode, setTokenCode] = useState('');
  const [tokenSent, setTokenSent] = useState(false);
  const [tokenFeedback, setTokenFeedback] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const dismissIntro = (tab?: 'login' | 'token' | 'register') => {
    localStorage.setItem('silentsos_has_seen_intro', 'true');
    if (tab) setAuthTab(tab);
    setShowIntro(false);
  };

  // Check for 1-click magic link or password reset parameters from Resend emails
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authEmail = params.get('authEmail');
    const authToken = params.get('authToken');
    const resetEmail = params.get('resetEmail');
    const resetCode = params.get('resetCode');

    if (resetEmail) {
      dismissIntro('login');
      setIsForgot(true);
      setEmail(resetEmail);
      if (resetCode) {
        setForgotCode(resetCode);
        setForgotCodeSent(true);
        setForgotFeedback('Verification code applied from your email link. Enter your new password below.');
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authEmail && authToken) {
      dismissIntro('token');
      setEmail(authEmail);
      setTokenCode(authToken);
      setLoading(true);
      setError(null);
      verifyAuthToken(authEmail, authToken)
        .then(() => {
          setSuccess(true);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to authenticate via security token.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  // Cooldown countdown timer for token resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Cooldown countdown timer for password reset verification code
  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setInterval(() => {
      setForgotCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotCooldown]);

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
              { icon: Bell, color: 'text-orange-400', bg: 'bg-orange-500/10', title: 'Automated Dispatch', desc: 'Notifies emergency contacts via SMS, WhatsApp, and Resend Email.' }
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

          {/* Action Buttons */}
          <div className="w-full space-y-3">
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => dismissIntro('register')}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 cursor-pointer"
            >
              Get Started <User className="w-4 h-4" />
            </motion.button>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => dismissIntro('login')}
              className="w-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-red-400" /> Already have an account? Sign In
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  const switchTab = (tab: 'login' | 'token' | 'register') => {
    setAuthTab(tab);
    setIsForgot(false);
    setForgotCodeSent(false);
    setForgotCode('');
    setForgotConfirmPassword('');
    setForgotFeedback(null);
    setError(null);
    setTokenSent(false);
    setTokenFeedback(null);
    setTokenCode('');
  };

  const handleRequestForgotCode = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setForgotCodeSent(true);
      setForgotFeedback(res.message);
      setForgotCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestToken = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await sendAuthToken(email);
      setTokenSent(true);
      setTokenFeedback(res.message);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch security token.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isForgot) {
        if (!forgotCodeSent) {
          await handleRequestForgotCode();
        } else {
          if (!forgotCode.trim()) {
            throw new Error('Please enter the 6-digit verification code sent to your email.');
          }
          if (!password || password.length < 6) {
            throw new Error('New password must be at least 6 characters long.');
          }
          if (password !== forgotConfirmPassword) {
            throw new Error('Passwords do not match. Please ensure both passwords match.');
          }
          await resetPassword(email, password, forgotCode.trim());
          setSuccess(true);
          setTimeout(() => {
            setIsForgot(false);
            setForgotCodeSent(false);
            setForgotCode('');
            setForgotConfirmPassword('');
            setForgotFeedback(null);
            setAuthTab('login');
            setSuccess(false);
            setPassword('');
            setError(null);
          }, 2200);
        }
      } else if (authTab === 'token') {
        if (!tokenSent) {
          await handleRequestToken();
        } else {
          if (!tokenCode.trim()) {
            throw new Error('Please enter the 6-digit security code from your email.');
          }
          await verifyAuthToken(email, tokenCode);
          setSuccess(true);
        }
      } else if (authTab === 'login') {
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

            {/* Intro Quick Link */}
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={() => setShowIntro(true)}
                className="text-[11px] text-white/50 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-red-400" /> What is SilentSOS?
              </button>
            </div>

            {/* Tab switcher or Forgot password Header */}
            {isForgot ? (
              <div className="text-center mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white">Reset Password</h2>
                <p className="text-xs text-white/40 mt-1 font-medium">
                  {forgotCodeSent
                    ? 'Enter the 6-digit verification code sent to your email and your new password'
                    : 'Enter your registered email to receive a verification code'}
                </p>
              </div>
            ) : (
              <div className="relative flex bg-black/30 rounded-xl p-1 mb-6 border border-white/8">
                {/* 3-way Sliding indicator */}
                <motion.div
                  layout
                  className="absolute top-1 bottom-1 rounded-lg bg-gradient-to-br from-red-600 to-red-700 shadow-lg shadow-red-900/40"
                  style={{
                    width: 'calc(33.333% - 3px)',
                    left: authTab === 'login' ? '4px' : authTab === 'token' ? 'calc(33.333% + 1px)' : 'calc(66.666% - 2px)'
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                />
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className={`relative flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors z-10 ${
                    authTab === 'login' ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" /> Password
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('token')}
                  className={`relative flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors z-10 ${
                    authTab === 'token' ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Token OTP</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className={`relative flex-1 py-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors z-10 ${
                    authTab === 'register' ? 'text-white' : 'text-white/40 hover:text-white/70'
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

            {/* Token feedback banner */}
            <AnimatePresence>
              {authTab === 'token' && tokenFeedback && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs p-3 rounded-xl flex items-start gap-2 leading-relaxed">
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{tokenFeedback}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forgot password feedback banner */}
            <AnimatePresence>
              {isForgot && forgotFeedback && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs p-3 rounded-xl flex items-start gap-2 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{forgotFeedback}</span>
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
                  <div className="bg-green-500/10 border border-green-500/20 text-green-300 text-xs p-3 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <span>
                      {isForgot 
                        ? 'Password reset successful! Redirecting to login...' 
                        : authTab === 'token'
                        ? 'Token verified! Signing you in…'
                        : 'Account verified! Signing you in…'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (Sign Up only) */}
              <AnimatePresence initial={false}>
                {authTab === 'register' && !isForgot && (
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
                        required={authTab === 'register' && !isForgot}
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
                    disabled={(authTab === 'token' && tokenSent) || (isForgot && forgotCodeSent)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm placeholder-white/20 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 outline-none transition-all disabled:opacity-50"
                  />
                  {authTab === 'token' && tokenSent && (
                    <button
                      type="button"
                      onClick={() => {
                        setTokenSent(false);
                        setTokenCode('');
                        setTokenFeedback(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-red-400 hover:text-red-300 underline"
                    >
                      Change
                    </button>
                  )}
                  {isForgot && forgotCodeSent && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotCodeSent(false);
                        setForgotCode('');
                        setForgotFeedback(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-red-400 hover:text-red-300 underline"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              {/* Forgot Password: Code + New Password + Confirm Password (only when code is sent) */}
              {isForgot && forgotCodeSent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* 6-Digit Verification Code */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-1">
                        <KeyRound className="w-3 h-3" /> 6-Digit Verification Code
                      </label>
                      <span className="text-[10px] text-white/40">Check email inbox</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={forgotCode}
                        onChange={(e) => setForgotCode(e.target.value.trim())}
                        placeholder="• • • • • •"
                        maxLength={6}
                        autoFocus
                        required
                        className="w-full bg-black/40 border-2 border-red-500/40 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-[0.4em] font-bold text-red-300 placeholder-white/20 focus:border-red-400 focus:ring-2 focus:ring-red-500/30 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-white/40">Code expires in 10 minutes</p>
                      <button
                        type="button"
                        disabled={forgotCooldown > 0 || loading}
                        onClick={handleRequestForgotCode}
                        className="text-[11px] text-red-400 hover:text-red-300 disabled:text-white/25 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        {forgotCooldown > 0 ? `Resend in ${forgotCooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
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

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm placeholder-white/20 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Token Code field (Token auth only when token is sent) */}
              {authTab === 'token' && tokenSent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                      <KeyRound className="w-3 h-3" /> 6-Digit Security Token
                    </label>
                    <span className="text-[10px] text-white/40">Check email inbox</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={tokenCode}
                      onChange={(e) => setTokenCode(e.target.value.trim())}
                      placeholder="• • • • • •"
                      maxLength={32}
                      autoFocus
                      required
                      className="w-full bg-black/40 border-2 border-amber-500/40 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-[0.4em] font-bold text-amber-300 placeholder-white/20 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-white/40">Code expires in 10 minutes</p>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleRequestToken}
                      className="text-[11px] text-amber-400 hover:text-amber-300 disabled:text-white/25 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Password (for password login or register, hidden in forgot password mode) */}
              {authTab !== 'token' && !isForgot && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      Password
                    </label>
                    {authTab === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgot(true);
                          setForgotCodeSent(false);
                          setForgotCode('');
                          setForgotConfirmPassword('');
                          setForgotFeedback(null);
                          setError(null);
                        }}
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
                      autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
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
              )}

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                className={`w-full text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  authTab === 'token'
                    ? 'bg-gradient-to-r from-amber-600 via-red-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 shadow-amber-900/30'
                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-900/40'
                }`}
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isForgot ? (
                  forgotCodeSent ? (
                    <><CheckCircle2 className="w-4 h-4" /> Verify Code & Reset Password</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send Verification Code to Email</>
                  )
                ) : authTab === 'token' ? (
                  tokenSent ? (
                    <><CheckCircle2 className="w-4 h-4" /> Verify Code & Sign In</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send Security Token via Resend</>
                  )
                ) : authTab === 'login' ? (
                  <><LogIn className="w-4 h-4" /> Sign In to SilentSOS</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Create My Account</>
                )}
              </motion.button>
            </form>

            {/* Resend Security Badge */}
            <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-white/5 text-[11px] text-white/30">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Resend Token Authentication & Alert Dispatch Active</span>
            </div>

            {/* Switch mode links */}
            <div className="mt-4 text-center text-xs text-white/35">
              {isForgot ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgot(false);
                    setForgotCodeSent(false);
                    setForgotCode('');
                    setForgotConfirmPassword('');
                    setForgotFeedback(null);
                    setError(null);
                  }}
                  className="text-red-400 font-semibold hover:text-red-300 transition-colors underline underline-offset-2"
                >
                  Back to Sign In
                </button>
              ) : authTab === 'token' ? (
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="text-red-400 font-semibold hover:text-red-300 transition-colors underline underline-offset-2"
                >
                  Sign in with password instead
                </button>
              ) : authTab === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchTab('register')}
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
                    onClick={() => switchTab('login')}
                    className="text-red-400 font-semibold hover:text-red-300 transition-colors underline underline-offset-2"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
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
