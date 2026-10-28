import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import {
  EyeOff,
  PhoneCall,
  Trash2,
  LogOut,
  Lock,
  CheckCircle2,
  ChevronRight,
  X,
  User,
  Camera,
  AlertCircle,
  Send,
  Sparkles,
  Star,
  MessageSquareHeart,
  Bug,
  Lightbulb,
  Radio,
  Check,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Settings() {
  const navigate = useNavigate();
  const { state, updateSettings, clearData, logout, testResendAlert, submitFeedback } = useApp();
  const [showFakeCall, setShowFakeCall] = useState(false);

  // Resend Alert Testing State
  const [testingResend, setTestingResend] = useState(false);
  const [testResendResult, setTestResendResult] = useState<string | null>(null);
  const [testResendError, setTestResendError] = useState<string | null>(null);

  // App Feedback State
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackHoverRating, setFeedbackHoverRating] = useState<number | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<string>('Feature Request');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSubmissionId, setFeedbackSubmissionId] = useState<string | null>(null);

  const handleTestResendAlert = async () => {
    setTestingResend(true);
    setTestResendResult(null);
    setTestResendError(null);
    try {
      const targetEmail = state.user?.email;
      const res = await testResendAlert(targetEmail);
      setTestResendResult(`✅ Test emergency alert dispatched successfully via Resend! (Message ID: ${res.result?.id || 'delivered'})`);
    } catch (err: any) {
      setTestResendError(err.message || 'Failed to dispatch test alert via Resend.');
    } finally {
      setTestingResend(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      setFeedbackError('Please enter your feedback message.');
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackError(null);

    const diagnostics = includeDiagnostics
      ? {
          browser: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          timestamp: new Date().toISOString()
        }
      : {};

    try {
      const res = await submitFeedback({
        rating: feedbackRating,
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        userEmail: state.user?.email || '',
        userName: state.user?.name || state.userName || 'Anonymous User',
        deviceInfo: diagnostics
      });

      setFeedbackSuccess(true);
      setFeedbackSubmissionId(res?.feedback?.id || 'FB-' + Date.now().toString().slice(-6));
      setFeedbackMessage('');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Change PIN modal states
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [pinPhase, setPinPhase] = useState<'verify' | 'new' | 'confirm' | 'success'>('verify');
  const [enteredPin, setEnteredPin] = useState('');
  const [firstNewPin, setFirstNewPin] = useState('');
  const [changePinError, setChangePinError] = useState(false);
  const [changePinErrorMessage, setChangePinErrorMessage] = useState('');

  const handlePinKeyPress = (num: string) => {
    if (pinPhase === 'success') return;
    setChangePinError(false);
    setChangePinErrorMessage('');

    if (enteredPin.length < 4) {
      const newPin = enteredPin + num;
      setEnteredPin(newPin);

      if (newPin.length === 4) {
        if (pinPhase === 'verify') {
          const targetPin = state.settings.safetyPin || '1234';
          if (newPin === targetPin) {
            setTimeout(() => {
              setPinPhase('new');
              setEnteredPin('');
            }, 300);
          } else {
            setChangePinError(true);
            setChangePinErrorMessage('Incorrect current PIN.');
            setTimeout(() => {
              setEnteredPin('');
            }, 800);
          }
        } else if (pinPhase === 'new') {
          setTimeout(() => {
            setFirstNewPin(newPin);
            setEnteredPin('');
            setPinPhase('confirm');
          }, 300);
        } else if (pinPhase === 'confirm') {
          if (newPin === firstNewPin) {
            handleSavePin(newPin);
          } else {
            setChangePinError(true);
            setChangePinErrorMessage('PINs do not match. Restarting...');
            setTimeout(() => {
              setEnteredPin('');
              setFirstNewPin('');
              setPinPhase('new');
              setChangePinError(false);
            }, 1200);
          }
        }
      }
    }
  };

  const handlePinBackspace = () => {
    if (pinPhase === 'success') return;
    setChangePinError(false);
    setChangePinErrorMessage('');
    setEnteredPin(p => p.slice(0, -1));
  };

  const handlePinClear = () => {
    if (pinPhase === 'success') return;
    setChangePinError(false);
    setChangePinErrorMessage('');
    setEnteredPin('');
  };

  const handleSavePin = async (newPin: string) => {
    setPinPhase('success');
    try {
      await updateSettings({ safetyPin: newPin });
      setTimeout(() => {
        setShowChangePinModal(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to save settings PIN:', err);
      setPinPhase('new');
      setChangePinError(true);
      setChangePinErrorMessage('Save failed. Try again.');
    }
  };

  useEffect(() => {
    if (!showChangePinModal || pinPhase === 'success') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handlePinBackspace();
      } else if (e.key === 'Escape') {
        setShowChangePinModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChangePinModal, pinPhase, enteredPin, firstNewPin]);
  const handleClearData = () => {
    if (
    window.confirm(
      'Are you sure? This will delete all settings, contacts, and history.'
    ))
    {
      clearData();
      window.location.reload();
    }
  };
  if (showFakeCall) {
    return (
      <div
        className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-between py-16 px-6"
        onClick={() => setShowFakeCall(false)}>
        
        <div className="text-center space-y-2 mt-10">
          <h2 className="text-3xl font-normal text-white">Mom</h2>
          <p className="text-white/60">Mobile</p>
        </div>

        <div className="flex w-full justify-between px-8 mb-10">
          <div className="flex flex-col items-center">
            <button className="w-16 h-16 rounded-full bg-emergency flex items-center justify-center mb-2">
              <PhoneCall className="w-8 h-8 text-white rotate-[135deg]" />
            </button>
            <span className="text-white/80 text-sm">Decline</span>
          </div>
          <div className="flex flex-col items-center">
            <button className="w-16 h-16 rounded-full bg-safe flex items-center justify-center mb-2 animate-pulse">
              <PhoneCall className="w-8 h-8 text-black" />
            </button>
            <span className="text-white/80 text-sm">Accept</span>
          </div>
        </div>
      </div>);

  }
  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-y-auto no-scrollbar pb-24">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        {/* User Profile Navigation Card (First item in Settings) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-textMuted uppercase flex items-center">
              <User className="w-4 h-4 mr-2 text-emerald-400" /> User Profile
            </h2>
            <span className="text-[10px] text-textMuted font-medium">
              Tap to view &amp; edit details
            </span>
          </div>

          <div
            onClick={() => navigate('/profile')}
            className="bg-surface hover:bg-surfaceHighlight/80 border border-surfaceHighlight hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 cursor-pointer transition-all shadow-md group flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {state.user?.profileImage ? (
                  <img
                    src={state.user.profileImage}
                    alt={state.user?.name || 'User avatar'}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-md shadow-emerald-500/10"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-white text-lg font-black shadow-md shadow-emerald-500/10">
                    {state.user?.name ? state.user.name.slice(0, 2).toUpperCase() : <User className="w-6 h-6" />}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-surface" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors">
                    {state.user?.name || state.userName || 'Add User Details'}
                  </h3>
                  {state.user?.bloodGroup && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-500/30">
                      {state.user.bloodGroup}
                    </span>
                  )}
                </div>

                <p className="text-xs text-textMuted mt-0.5">
                  {state.user?.email || 'Tap to fill personal identification & emergency details'}
                </p>

                {state.user?.phone && (
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {state.user.phone}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              Profile
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </section>
        {/* Stealth & Disguise */}
        <section>
          <h2 className="text-xs font-bold text-textMuted uppercase mb-3 flex items-center">
            <EyeOff className="w-4 h-4 mr-2" /> Stealth & Disguise
          </h2>
          <div className="bg-surface border border-surfaceHighlight rounded-xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-surfaceHighlight">
              <div>
                <p className="font-medium">Stealth Mode</p>
                <p className="text-xs text-textMuted">
                  Black screen, app remains active
                </p>
              </div>
              <button
                onClick={() =>
                updateSettings({
                  stealthMode: !state.settings.stealthMode
                })
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${state.settings.stealthMode ? 'bg-safe' : 'bg-surfaceHighlight'}`}>
                
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${state.settings.stealthMode ? 'left-7' : 'left-1'}`} />
                
              </button>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Fake Call Disguise</p>
                <p className="text-xs text-textMuted">
                  Show fake incoming call
                </p>
              </div>
              <button
                onClick={() => setShowFakeCall(true)}
                className="text-xs bg-surfaceHighlight px-3 py-1.5 rounded-lg font-medium hover:bg-surface transition-colors">
                
                Test
              </button>
            </div>
          </div>
        </section>

        {/* Capture Settings Navigation Card */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-textMuted uppercase flex items-center">
              <Camera className="w-4 h-4 mr-2 text-cyan-400" /> Capture Settings
            </h2>
            <span className="text-[10px] text-textMuted font-medium">
              Photo burst, video &amp; audio buffers
            </span>
          </div>

          <div
            onClick={() => navigate('/capture-settings')}
            className="bg-surface hover:bg-surfaceHighlight/80 border border-surfaceHighlight hover:border-cyan-500/40 rounded-2xl p-4 sm:p-5 cursor-pointer transition-all shadow-md group flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                <Camera className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-white group-hover:text-cyan-400 transition-colors">
                    Capture &amp; Surveillance Settings
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
                    {state.settings.photoBurstCount} Photos &bull; {state.settings.videoDuration}
                  </span>
                </div>

                <p className="text-xs text-textMuted mt-0.5">
                  Configure photo burst, video loop duration, audio noise filters, and broadcast templates.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-500 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              Configure
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </section>

        {/* Security & PIN */}
        <section>
          <h2 className="text-xs font-bold text-textMuted uppercase mb-3 flex items-center">
            <Lock className="w-4 h-4 mr-2" /> Security & PIN
          </h2>
          <div className="bg-surface border border-surfaceHighlight rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Safety PIN</p>
              <p className="text-xs text-textMuted">
                Required to stop alerts & delete evidence
              </p>
            </div>
            <button
              onClick={() => {
                setPinPhase('verify');
                setEnteredPin('');
                setFirstNewPin('');
                setChangePinError(false);
                setChangePinErrorMessage('');
                setShowChangePinModal(true);
              }}
              className="text-xs bg-surfaceHighlight px-4 py-2 border border-white/5 rounded-xl font-bold hover:bg-surfaceHighlight/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              Change PIN <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* Resend Emergency Alert Notifications */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-textMuted uppercase flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-amber-400" /> Resend Alert Notifications
            </h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Resend Active
            </span>
          </div>

          <div className="bg-surface border border-surfaceHighlight rounded-xl p-4 space-y-3.5">
            <div className="text-xs text-textMuted leading-relaxed space-y-1">
              <p className="text-white font-medium">Automatic Emergency Dispatch Network</p>
              <p>
                All SOS triggers, live GPS broadcast tracking links, captured media evidence enclosures (photos/audio), and safe cancellation notices are automatically dispatched via <strong>Resend</strong>.
              </p>
            </div>

            <div className="bg-surfaceHighlight/50 border border-white/5 rounded-lg p-3 text-xs space-y-1.5 text-textMuted">
              <div className="flex justify-between items-center">
                <span>Resend Gateway:</span>
                <span className="text-emerald-400 font-mono font-medium">re_2u5w...msP4</span>
              </div>
              <div className="flex justify-between items-center">
                <span>From Address:</span>
                <span className="font-mono text-white/80">SilentSOS &lt;onboarding@resend.dev&gt;</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Emergency Profile Enclosed:</span>
                <span className="text-emerald-400 font-medium">Full Medical & Next-of-Kin</span>
              </div>
            </div>

            {testResendResult && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{testResendResult}</span>
              </div>
            )}

            {testResendError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{testResendError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={testingResend}
              onClick={handleTestResendAlert}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition-all cursor-pointer"
            >
              {testingResend ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Dispatching Test Alert via Resend...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Alert Notification</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Feedback & Suggestions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-textMuted uppercase flex items-center">
              <MessageSquareHeart className="w-4 h-4 mr-2 text-pink-400" /> Feedback & Suggestions
            </h2>
            <span className="text-[10px] text-pink-400 font-semibold px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20">
              We're Listening
            </span>
          </div>

          <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-lg space-y-4">
            {feedbackSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center space-y-4"
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-pink-500/20 to-rose-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-lg shadow-pink-500/10">
                  <Check className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Thank You for Your Feedback!</h3>
                  <p className="text-xs text-textMuted max-w-sm mx-auto leading-relaxed">
                    Your suggestions and safety reports directly help improve SilentSOS emergency response algorithms and protection features.
                  </p>
                </div>
                {feedbackSubmissionId && (
                  <div className="inline-block px-3 py-1 bg-surfaceHighlight/60 border border-white/5 rounded-lg text-[11px] text-textMuted font-mono">
                    Ref ID: <span className="text-pink-400 font-bold">{feedbackSubmissionId}</span>
                  </div>
                )}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackSuccess(false);
                      setFeedbackSubmissionId(null);
                      setFeedbackMessage('');
                    }}
                    className="px-5 py-2 rounded-xl bg-surfaceHighlight hover:bg-white/10 text-xs font-semibold text-white border border-white/10 transition-all cursor-pointer"
                  >
                    Submit Another Feedback
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <p className="text-xs text-textMuted leading-relaxed">
                  Have an emergency feature suggestion, spotted a bug, or want to share your experience? We review every submission.
                </p>

                {/* Rating Stars with Sentiment */}
                <div className="p-3.5 bg-surfaceHighlight/40 border border-white/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-textMuted uppercase tracking-wider">
                      Rate Your Experience
                    </label>
                    <span className="text-xs font-medium text-pink-400">
                      {(feedbackHoverRating || feedbackRating) === 1 && 'Needs Improvement 🙁'}
                      {(feedbackHoverRating || feedbackRating) === 2 && 'Fair 😐'}
                      {(feedbackHoverRating || feedbackRating) === 3 && 'Good & Reliable 🙂'}
                      {(feedbackHoverRating || feedbackRating) === 4 && 'Very Helpful 😊'}
                      {(feedbackHoverRating || feedbackRating) === 5 && 'Outstanding & Lifesaver! 🌟'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive = (feedbackHoverRating || feedbackRating) >= star;
                      return (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setFeedbackRating(star)}
                          onMouseEnter={() => setFeedbackHoverRating(star)}
                          onMouseLeave={() => setFeedbackHoverRating(null)}
                          className="p-1 text-slate-600 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 transition-colors ${
                              isActive
                                ? 'text-amber-400 fill-amber-400 filter drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                                : 'text-slate-600 hover:text-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback Category Chips */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-textMuted uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'Feature Request', label: 'Feature Request', icon: Lightbulb },
                      { id: 'Bug Report', label: 'Bug Report', icon: Bug },
                      { id: 'Emergency SOS Experience', label: 'Emergency SOS', icon: Radio },
                      { id: 'UI & Design', label: 'UI & Usability', icon: Sparkles },
                      { id: 'General Thoughts', label: 'General', icon: HelpCircle }
                    ].map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = feedbackCategory === cat.id;
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setFeedbackCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-pink-500/15 border-pink-500 text-pink-300 shadow-sm shadow-pink-500/20'
                              : 'bg-surfaceHighlight/50 border-white/5 text-textMuted hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message Textarea */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-textMuted uppercase tracking-wider">
                      Your Message
                    </label>
                    <span className="text-[10px] text-textMuted">
                      {feedbackMessage.length}/1000
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={1000}
                    required
                    placeholder="Tell us what happened, any suggestions, or safety improvements you'd like to see..."
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    className="w-full bg-background border border-surfaceHighlight rounded-xl p-3 text-xs text-white placeholder:text-textMuted/50 outline-none focus:border-pink-500 transition-all resize-none"
                  />
                </div>

                {/* Include Diagnostic Details */}
                <label className="flex items-center gap-2.5 p-2.5 bg-surfaceHighlight/20 border border-white/5 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDiagnostics}
                    onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                    className="rounded accent-pink-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <div className="text-[11px] text-textMuted">
                    <span className="text-white font-medium">Attach diagnostic info</span> (Browser, OS & screen resolution) to help resolve issues faster
                  </div>
                </label>

                {/* Error Banner */}
                {feedbackError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{feedbackError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmittingFeedback || !feedbackMessage.trim()}
                  className="w-full py-3 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-900/25 transition-all cursor-pointer active:scale-98"
                >
                  {isSubmittingFeedback ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting Feedback...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Feedback</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Account Session Actions */}
        <section className="pt-4 space-y-3">
          <button
            onClick={() => {
              logout();
              window.location.reload();
            }}
            className="w-full py-4 bg-surfaceHighlight hover:bg-surface border border-surfaceHighlight text-white rounded-xl font-semibold flex items-center justify-center transition-colors"
          >
            <LogOut className="w-5 h-5 mr-2 text-warning" /> Log Out Session
          </button>
          
          <button
            onClick={handleClearData}
            className="w-full py-4 border border-emergency/30 text-emergency rounded-xl font-medium flex items-center justify-center hover:bg-emergency/10 transition-colors"
          >
            <Trash2 className="w-5 h-5 mr-2" /> Reset App Data
          </button>
        </section>
      </div>

      {/* Change PIN Modal Overlay */}
      <AnimatePresence>
        {showChangePinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-xs w-full flex flex-col items-center relative">
              {/* Close Button (only show if not in success state) */}
              {pinPhase !== 'success' && (
                <button
                  onClick={() => setShowChangePinModal(false)}
                  className="absolute -top-12 -right-2 text-white/50 hover:text-white bg-white/10 rounded-full p-2 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {pinPhase === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6 shadow-lg shadow-emerald-950/20">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Safety PIN Changed!
                  </h3>
                  <p className="text-xs text-emerald-400 font-bold tracking-wide uppercase">
                    Settings Saved
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="pin-phases"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-surfaceHighlight border border-white/10 flex items-center justify-center mb-6 shadow-md shadow-red-950/20">
                    <Lock className="w-6 h-6 text-red-400" />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">
                    {pinPhase === 'verify' && 'Verify Current PIN'}
                    {pinPhase === 'new' && 'Enter New PIN'}
                    {pinPhase === 'confirm' && 'Confirm New PIN'}
                  </h3>
                  <p className="text-xs text-textMuted mb-8 leading-relaxed max-w-[240px]">
                    {pinPhase === 'verify' && 'Enter your current 4-digit Safety PIN to verify identity.'}
                    {pinPhase === 'new' && 'Enter your new secure 4-digit Safety PIN.'}
                    {pinPhase === 'confirm' && 'Re-enter your new 4-digit Safety PIN to confirm.'}
                  </p>

                  {/* PIN Dot Indicators */}
                  <div className="flex gap-4 mb-8">
                    {[0, 1, 2, 3].map((index) => (
                      <motion.div
                        key={index}
                        animate={changePinError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                        transition={{ duration: 0.4 }}
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          enteredPin.length > index
                            ? changePinError
                              ? 'bg-red-500 border-red-500'
                              : 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_#10b981]'
                            : 'border-white/25 bg-transparent'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-3 gap-4 w-full max-w-[260px] mb-8">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button
                        key={num}
                        onClick={() => handlePinKeyPress(num)}
                        className="aspect-square rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-lg font-bold text-white flex items-center justify-center transition-all active:scale-90 shadow-sm cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={handlePinClear}
                      disabled={enteredPin.length === 0}
                      className="aspect-square rounded-2xl text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors flex items-center justify-center disabled:opacity-0 disabled:cursor-default cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => handlePinKeyPress('0')}
                      className="aspect-square rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-lg font-bold text-white flex items-center justify-center transition-all active:scale-90 shadow-sm cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      onClick={handlePinBackspace}
                      disabled={enteredPin.length === 0}
                      className="aspect-square rounded-2xl text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors flex items-center justify-center disabled:opacity-0 disabled:cursor-default cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>

                  {changePinErrorMessage && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-red-400 font-bold animate-pulse"
                    >
                      {changePinErrorMessage}
                    </motion.p>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>);
}