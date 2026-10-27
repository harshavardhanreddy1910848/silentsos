import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  KeyRoundIcon,
  MailIcon,
  LockKeyholeIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  ShieldCheckIcon
} from 'lucide-react';
import { api } from '../lib/api';

export function ForgotPassword() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const initialEmail = searchParams.get('email') || '';
  const autoSend = searchParams.get('autoSend') === '1' || searchParams.get('autoSend') === 'true';

  const [step, setStep] = useState<'request' | 'sent-notice' | 'verify-code' | 'token-reset' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(urlToken);
  const [code, setCode] = useState('');
  const [devOtpCode, setDevOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Helper to dispatch OTP email
  const dispatchReset = async (targetEmail: string) => {
    const normalized = targetEmail.trim().toLowerCase();
    if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.requestPasswordReset(normalized);
      if (res.success) {
        const returnedCode = res.code || res.resetCode || '';
        if (returnedCode) {
          setDevOtpCode(returnedCode);
        }
        setSuccessMsg(`✓ 6-Digit OTP verification code sent to ${normalized}!`);
        setStep('verify-code');
      } else {
        setError(res.error || 'Failed to dispatch reset email. Please try again.');
      }
    } catch {
      setError('Unable to connect to password reset service.');
    } finally {
      setLoading(false);
    }
  };

  // Check if user opened the page with a reset token or autoSend in the URL
  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      setStep('token-reset');
    } else if (autoSend && initialEmail && /^\S+@\S+\.\S+$/.test(initialEmail.trim())) {
      dispatchReset(initialEmail.trim());
    }
  }, [urlToken, autoSend, initialEmail]);

  // STEP 1: Request reset email
  const handleRequestReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await dispatchReset(email);
  };

  // STEP 2: Handle password submission (via token or code)
  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (step === 'verify-code' && code.trim().length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.resetPassword({
        token: step === 'token-reset' ? token : undefined,
        email: step === 'verify-code' ? email.trim().toLowerCase() : undefined,
        code: step === 'verify-code' ? code.trim() : undefined,
        newPassword
      });

      if (res.success) {
        setStep('success');
      } else {
        setError(res.error || 'Invalid or expired password reset credentials. Please request a new link.');
      }
    } catch {
      setError('Error resetting password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.requestPasswordReset(email.trim().toLowerCase());
      if (res.success) {
        const returnedCode = res.code || res.resetCode || '';
        if (returnedCode) {
          setDevOtpCode(returnedCode);
        }
        setSuccessMsg("A new 6-digit OTP verification email has been dispatched via Resend.");
      }
    } catch {
      setError('Failed to resend reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-scrollbar flex h-full overflow-y-auto bg-[#07090e] px-5 py-6 sm:px-10 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center py-4 sm:py-10">
        <button
          onClick={() => nav('/auth')}
          className="mb-8 flex min-h-11 w-fit items-center gap-2 rounded-xl px-2 text-sm font-bold text-white/55 hover:bg-white/5 hover:text-white transition-colors">
          <ArrowLeftIcon size={17} /> Back to Sign In
        </button>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[2rem] border border-white/10 bg-[#0e121a] p-6 shadow-2xl sm:p-8">
          
          {/* Header Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff1744] to-[#b7092b] shadow-[0_0_28px_rgba(255,23,68,0.35)]">
            {step === 'success' ? <ShieldCheckIcon size={25} color="#fff" /> : <KeyRoundIcon size={25} color="#fff" />}
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#ff1744]">
            Account Security
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {step === 'success' && 'Password Reset Complete'}
            {step === 'sent-notice' && 'Check Your Email'}
            {step === 'token-reset' && 'Create New Password'}
            {step === 'verify-code' && 'Enter 6-Digit OTP Code'}
            {step === 'request' && 'Reset Your Password'}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-white/50">
            {step === 'request' &&
              'Enter your registered email address below to receive your 6-digit OTP verification code.'}
            {step === 'sent-notice' &&
              "If an account exists for this email, we've sent instructions to reset your password."}
            {step === 'token-reset' &&
              'Choose a secure new password for your SilentSOS account.'}
            {step === 'verify-code' &&
              `Enter the 6-digit verification code sent to ${email} along with your new password.`}
            {step === 'success' &&
              'Your password has been successfully updated. You can now sign in with your new credentials.'}
          </p>

          <AnimatePresence mode="wait">
            {/* STEP 1: REQUEST EMAIL */}
            {step === 'request' && (
              <motion.form
                key="step-request"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleRequestReset}
                className="mt-6 space-y-4"
                noValidate>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/80">Account Email Address</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#ff1744]">
                    <MailIcon size={18} color="#8a8a8a" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      placeholder="you@example.com"
                      className="min-h-14 w-full bg-transparent text-sm font-medium outline-none placeholder:text-white/25"
                    />
                  </div>
                </label>

                {error && (
                  <p role="alert" className="text-xs font-bold text-[#ff1744] bg-[#ff1744]/10 p-3 rounded-xl border border-[#ff1744]/20">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff1744] text-base font-black shadow-[0_0_28px_rgba(255,23,68,0.25)] transition-transform active:scale-[0.98]">
                  {loading ? 'Sending OTP Code...' : 'Send OTP Verification Email'} <ArrowRightIcon size={19} />
                </button>
              </motion.form>
            )}

            {/* STEP 2A: SENT CONFIRMATION NOTICE */}
            {step === 'sent-notice' && (
              <motion.div
                key="step-sent-notice"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mt-6 space-y-4">
                <div className="rounded-2xl border border-[#00e676]/20 bg-[#00e676]/10 p-4 text-sm text-[#00e676]">
                  <p className="font-bold">✓ Instructions Sent</p>
                  <p className="mt-1 text-xs text-[#00e676]/80 leading-relaxed">
                    {successMsg || "If an account exists for this email, we've sent instructions to reset your password."}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60 space-y-2">
                  <p>• Click the link in the email to reset your password immediately.</p>
                  <p>• The reset link is valid for 15 minutes.</p>
                  <p>• Didn't receive an email? Check your Spam or Promotions folder.</p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('verify-code')}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold hover:bg-white/15">
                    <KeyRoundIcon size={16} /> Enter 6-Digit Code Instead
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="flex min-h-12 w-full items-center justify-center gap-2 text-xs font-bold text-white/50 hover:text-white">
                    <RefreshCwIcon size={14} className={loading ? 'animate-spin' : ''} /> Resend Email
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2B: TOKEN / CODE PASSWORD RESET FORM */}
            {(step === 'token-reset' || step === 'verify-code') && (
              <motion.form
                key="step-password-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleResetPassword}
                className="mt-6 space-y-4"
                noValidate>
                {step === 'verify-code' && (
                  <>
                    <div className="rounded-2xl border border-[#00e676]/30 bg-[#00e676]/10 p-4 text-xs text-[#00e676] space-y-2">
                      <p className="font-bold flex items-center gap-1.5 text-sm">
                        <CheckCircle2Icon size={16} /> OTP Verification Email Dispatched
                      </p>
                      <p className="text-white/80 leading-relaxed">
                        We sent a 6-digit OTP verification email to <strong className="text-white">{email}</strong> via Resend Official Mail. Please check your inbox (or spam) and enter the code below.
                      </p>
                      {devOtpCode && (
                        <div className="mt-2 flex items-center justify-between rounded-xl bg-black/40 border border-[#00e676]/20 p-2.5">
                          <div className="text-xs text-white/70">
                            <span className="font-semibold text-[#00e676]">OTP Code:</span>{' '}
                            <span className="font-mono font-black text-white text-base tracking-widest">{devOtpCode}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCode(devOtpCode);
                              setError('');
                            }}
                            className="rounded-lg bg-[#00e676]/20 px-2.5 py-1 text-xs font-bold text-[#00e676] hover:bg-[#00e676]/30 transition-colors">
                            Auto-fill OTP
                          </button>
                        </div>
                      )}
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-white/80">6-Digit OTP Verification Code</span>
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#ff1744]">
                        <KeyRoundIcon size={18} color="#8a8a8a" />
                        <input
                          type="text"
                          maxLength={6}
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value.replace(/\D/g, ''));
                            setError('');
                          }}
                          placeholder="123456"
                          className="min-h-14 w-full bg-transparent text-lg font-mono font-bold tracking-widest outline-none placeholder:text-white/25"
                        />
                      </div>
                    </label>
                  </>
                )}

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/80">New Password</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#ff1744]">
                    <LockKeyholeIcon size={18} color="#8a8a8a" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="At least 6 characters"
                      className="min-h-14 w-full bg-transparent text-sm font-medium outline-none placeholder:text-white/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white/50 hover:bg-white/5">
                      {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/80">Confirm New Password</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 focus-within:border-[#ff1744]">
                    <LockKeyholeIcon size={18} color="#8a8a8a" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="Re-enter new password"
                      className="min-h-14 w-full bg-transparent text-sm font-medium outline-none placeholder:text-white/25"
                    />
                  </div>
                </label>

                {error && (
                  <p role="alert" className="text-xs font-bold text-[#ff1744] bg-[#ff1744]/10 p-3 rounded-xl border border-[#ff1744]/20">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff1744] text-base font-black shadow-[0_0_28px_rgba(255,23,68,0.25)] transition-transform active:scale-[0.98]">
                  {loading ? 'Verifying OTP & Updating...' : 'Verify OTP & Reset Password'} <ArrowRightIcon size={19} />
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setStep('request')}
                    className="text-white/50 hover:text-white underline">
                    Change Email
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-[#ff1744] hover:underline font-bold">
                    <RefreshCwIcon size={12} className={loading ? 'animate-spin' : ''} /> Resend OTP Code
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 3: SUCCESS CONFIRMATION */}
            {step === 'success' && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 text-center space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#00e676]/20 text-[#00e676]">
                  <CheckCircle2Icon size={36} />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">Password Reset Successful</h3>
                  <p className="mt-1 text-sm text-white/50">
                    Your password has been changed. You can now sign in with your new password.
                  </p>
                </div>

                <button
                  onClick={() => nav('/auth', { replace: true })}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff1744] text-base font-black shadow-[0_0_28px_rgba(255,23,68,0.25)] transition-transform active:scale-[0.98]">
                  Proceed to Sign In <ArrowRightIcon size={19} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-white/50">
            Remember your password?{' '}
            <button
              onClick={() => nav('/auth')}
              className="font-bold text-white underline decoration-[#ff1744] underline-offset-4">
              Sign In
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
