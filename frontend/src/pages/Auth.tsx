import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockKeyholeIcon,
  MailIcon,
  ShieldCheckIcon,
  SparklesIcon,
  KeyRoundIcon,
  CheckCircle2Icon,
  Loader2Icon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { requestNotificationPermission } from '../lib/notifications';

export function Auth() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';

  const { profile, setProfile } = useApp();
  const [authMode, setAuthMode] = useState<'password' | 'token'>('password');
  const [isCreating, setIsCreating] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Token Auth states
  const [tokenStep, setTokenStep] = useState<'request' | 'verify'>('request');
  const [tokenCode, setTokenCode] = useState('');
  const [tokenVerifying, setTokenVerifying] = useState(false);

  // 1. AUTO-LOGIN IF URL HAS ?token=
  useEffect(() => {
    if (!urlToken) return;

    let isMounted = true;
    setTokenVerifying(true);
    setInfoMsg('⚡ Verifying token authentication...');

    api.tokenLogin({ token: urlToken })
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.profile) {
          setProfile({
            ...res.profile,
            authenticated: true,
            onboarded: res.profile.onboarded ?? true
          });
          setInfoMsg('✅ Authenticated successfully via token! Loading SilentSOS...');
          // Request browser notifications permissions seamlessly
          requestNotificationPermission().catch(() => {});
          setTimeout(() => {
            nav(res.profile.onboarded ? '/home' : '/onboarding', { replace: true });
          }, 800);
        } else {
          setError(res.error || 'Token authentication failed or expired.');
          setTokenVerifying(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Token verification network exception.');
        setTokenVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [urlToken, nav, setProfile]);

  // Standard Password Submit
  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Use at least 6 characters for your password.');
      return;
    }

    const isAlreadyOnboarded = !isCreating || profile.onboarded;

    setProfile({
      authenticated: true,
      email: normalizedEmail,
      createdAt: profile.createdAt ?? Date.now(),
      role: 'user',
      onboarded: isAlreadyOnboarded
    });

    requestNotificationPermission().catch(() => {});
    nav(isAlreadyOnboarded ? '/home' : '/onboarding', { replace: true });
  };

  // Request Magic Token via Resend
  const handleRequestToken = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMsg('');

    try {
      const res = await api.requestTokenAuth(normalizedEmail, profile.name || undefined);
      if (res.success) {
        setTokenStep('verify');
        setInfoMsg(`✓ Access token and 6-digit code dispatched to ${normalizedEmail} via Resend.`);
      } else {
        setError(res.error || 'Failed to dispatch authentication token.');
      }
    } catch {
      setError('Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  };

  // Verify 6-digit token code
  const handleVerifyTokenCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = tokenCode.trim();

    if (cleanCode.length < 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.tokenLogin({ email: normalizedEmail, code: cleanCode });
      if (res.success && res.profile) {
        setProfile({
          ...res.profile,
          authenticated: true,
          onboarded: res.profile.onboarded ?? true
        });
        setInfoMsg('✅ Authenticated successfully!');
        requestNotificationPermission().catch(() => {});
        setTimeout(() => {
          nav(res.profile.onboarded ? '/home' : '/onboarding', { replace: true });
        }, 500);
      } else {
        setError(res.error || 'Invalid or expired authentication code.');
      }
    } catch {
      setError('Error verifying token code.');
    } finally {
      setLoading(false);
    }
  };

  // If token is currently verifying via URL
  if (tokenVerifying) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a] px-5">
        <div className="flex max-w-sm flex-col items-center text-center">
          <Loader2Icon className="h-10 w-10 animate-spin text-[#00e676]" />
          <h2 className="mt-4 text-xl font-black text-white">Authenticating via Token...</h2>
          <p className="mt-2 text-sm text-white/50">{infoMsg || 'Validating your secure access token'}</p>
          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 font-bold">
              {error}
              <button
                onClick={() => setTokenVerifying(false)}
                className="mt-2 block w-full text-center text-white underline">
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="no-scrollbar flex h-full overflow-y-auto bg-[#0a0a0a] px-5 py-6 sm:px-10">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center py-4 sm:py-10">
        <button
          onClick={() => nav('/')}
          className="mb-8 flex min-h-11 w-fit items-center gap-2 rounded-xl px-2 text-sm font-bold text-white/55 hover:bg-white/5 hover:text-white">
          <ArrowLeftIcon size={17} /> Back
        </button>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl sm:p-8">
          
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff1744] shadow-[0_0_28px_rgba(255,23,68,0.3)]">
              <ShieldCheckIcon size={25} color="#fff" />
            </div>

            {/* Switch Between Password & Token Authentication */}
            <div className="flex rounded-xl bg-black/40 border border-white/10 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setError('');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  authMode === 'password' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
                }`}>
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('token');
                  setError('');
                }}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  authMode === 'token' ? 'bg-[#00e676]/20 text-[#00e676]' : 'text-white/40 hover:text-[#00e676]'
                }`}>
                <SparklesIcon size={12} /> Token Login
              </button>
            </div>
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#ff1744]">
            {authMode === 'token' ? '⚡ Token Authentication' : 'User Safety Account'}
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {authMode === 'token'
              ? 'Instant Token Sign In'
              : isCreating
              ? 'Create your safety profile'
              : 'Welcome back'}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-white/50">
            {authMode === 'token'
              ? 'Sign in securely with a one-time link or 6-digit access code sent via Resend.'
              : isCreating
              ? 'Start with a private account, then configure your contacts and silent triggers.'
              : 'Sign in to access your SilentSOS safety setup.'}
          </p>

          {infoMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#00e676]/30 bg-[#00e676]/10 p-3 text-xs font-bold text-[#00e676]">
              <CheckCircle2Icon size={16} className="shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* MODE 1: PASSWORD AUTHENTICATION */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="mt-7 space-y-4" noValidate>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Email address</span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 focus-within:border-[#ff1744]">
                  <MailIcon size={18} color="#8a8a8a" />
                  <input
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com"
                    className="min-h-14 w-full bg-transparent text-sm font-medium outline-none placeholder:text-white/25"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between">
                  <span className="block text-sm font-bold">Password</span>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = email.trim();
                      const query = trimmed ? `?email=${encodeURIComponent(trimmed)}&autoSend=1` : '';
                      nav(`/forgot-password${query}`);
                    }}
                    className="text-xs font-bold text-[#ff1744] hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 focus-within:border-[#ff1744]">
                  <LockKeyholeIcon size={18} color="#8a8a8a" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isCreating ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError('');
                    }}
                    placeholder="At least 6 characters"
                    className="min-h-14 w-full bg-transparent text-sm font-medium outline-none placeholder:text-white/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white/50 hover:bg-white/5">
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </label>

              {error && <p role="alert" className="text-sm font-semibold text-[#ff1744]">{error}</p>}

              <button
                type="submit"
                className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff1744] text-base font-black shadow-[0_0_28px_rgba(255,23,68,0.25)] transition-transform active:scale-[0.98]">
                {isCreating ? 'Create account' : 'Sign in'} <ArrowRightIcon size={19} />
              </button>
            </form>
          )}

          {/* MODE 2: TOKEN / MAGIC LINK AUTHENTICATION */}
          {authMode === 'token' && (
            <div className="mt-7">
              {tokenStep === 'request' ? (
                <form onSubmit={handleRequestToken} className="space-y-4" noValidate>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold">Email address</span>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 focus-within:border-[#00e676]">
                      <MailIcon size={18} color="#00e676" />
                      <input
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setError('');
                        }}
                        placeholder="you@example.com"
                        className="min-h-14 w-full bg-transparent text-sm font-medium outline-none placeholder:text-white/25"
                      />
                    </div>
                  </label>

                  {error && <p role="alert" className="text-sm font-semibold text-[#ff1744]">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#00e676] text-base font-black text-black shadow-[0_0_28px_rgba(0,230,118,0.25)] transition-transform active:scale-[0.98] disabled:opacity-50">
                    {loading ? (
                      <>
                        <Loader2Icon className="h-5 w-5 animate-spin" /> Sending Token...
                      </>
                    ) : (
                      <>
                        Send Login Token via Resend <ArrowRightIcon size={19} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyTokenCode} className="space-y-4" noValidate>
                  <label className="block">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="block text-sm font-bold">Enter 6-Digit Code</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTokenStep('request');
                          setError('');
                        }}
                        className="text-xs text-white/50 hover:text-white">
                        Change email
                      </button>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 focus-within:border-[#00e676]">
                      <KeyRoundIcon size={18} color="#00e676" />
                      <input
                        type="text"
                        maxLength={6}
                        value={tokenCode}
                        onChange={(e) => {
                          setTokenCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setError('');
                        }}
                        placeholder="••••••"
                        className="min-h-14 w-full bg-transparent text-center font-mono text-2xl font-bold tracking-[0.4em] outline-none placeholder:text-white/20 text-[#00e676]"
                      />
                    </div>
                    <p className="mt-2 text-xs text-white/40">
                      Check your email ({email}) for the direct login link or enter the 6-digit code above.
                    </p>
                  </label>

                  {error && <p role="alert" className="text-sm font-semibold text-[#ff1744]">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading || tokenCode.length < 6}
                    className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#00e676] text-base font-black text-black shadow-[0_0_28px_rgba(0,230,118,0.25)] transition-transform active:scale-[0.98] disabled:opacity-40">
                    {loading ? (
                      <>
                        <Loader2Icon className="h-5 w-5 animate-spin" /> Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Sign In <ArrowRightIcon size={19} />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={(e) => handleRequestToken(e as any)}
                      className="text-xs font-semibold text-[#00e676] hover:underline">
                      Resend new token code
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {authMode === 'password' && (
            <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-white/50">
              {isCreating ? 'Already set up?' : 'New to SilentSOS?'}{' '}
              <button
                onClick={() => {
                  setIsCreating((value) => !value);
                  setError('');
                }}
                className="font-bold text-white underline decoration-[#ff1744] underline-offset-4">
                {isCreating ? 'Sign in' : 'Create an account'}
              </button>
            </div>
          )}
        </motion.section>

        <p className="mt-5 text-center text-xs leading-relaxed text-white/30">
          SilentSOS Emergency Platform • Token authentication & notifications secured via Resend.
        </p>
      </div>
    </div>
  );
}