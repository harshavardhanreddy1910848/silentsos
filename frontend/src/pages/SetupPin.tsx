import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ShieldAlert, Lock, CheckCircle2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function SetupPin() {
  const { updateSettings, logout } = useApp();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<'create' | 'confirm' | 'success'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleKeyPress = (num: string) => {
    if (phase === 'success') return;
    setPinError(false);
    setErrorMessage('');

    if (enteredPin.length < 4) {
      const newPin = enteredPin + num;
      setEnteredPin(newPin);

      if (newPin.length === 4) {
        if (phase === 'create') {
          // Transition to confirmation phase
          setTimeout(() => {
            setFirstPin(newPin);
            setEnteredPin('');
            setPhase('confirm');
          }, 400);
        } else if (phase === 'confirm') {
          // Verify PIN matches
          if (newPin === firstPin) {
            handleSuccess(newPin);
          } else {
            setPinError(true);
            setErrorMessage('PINs do not match. Please try again.');
            setTimeout(() => {
              setEnteredPin('');
              setFirstPin('');
              setPhase('create');
              setPinError(false);
            }, 1200);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    if (phase === 'success') return;
    setPinError(false);
    setErrorMessage('');
    setEnteredPin(p => p.slice(0, -1));
  };

  const handleClear = () => {
    if (phase === 'success') return;
    setPinError(false);
    setErrorMessage('');
    setEnteredPin('');
  };

  const handleSuccess = async (pin: string) => {
    setPhase('success');
    try {
      await updateSettings({ safetyPin: pin });
      setTimeout(() => {
        navigate('/onboarding');
      }, 1500);
    } catch (err) {
      console.error('Failed to update safety PIN settings:', err);
      setPhase('confirm');
      setPinError(true);
      setErrorMessage('Failed to save safety PIN. Please try again.');
    }
  };

  const handleLogOut = () => {
    logout();
    window.location.reload();
  };

  // Keyboard listener for physical PIN typing
  useEffect(() => {
    if (phase === 'success') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, enteredPin, firstPin]);

  return (
    <div className="relative flex flex-col w-full h-full bg-[#0a0a0f] overflow-y-auto no-scrollbar text-white p-6 justify-between min-h-screen">
      {/* Decorative Blur Background Orbs */}
      <div className="absolute top-10 left-10 w-48 h-48 rounded-full bg-red-600/10 blur-[60px] pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-pink-600/10 blur-[60px] pointer-events-none" />

      {/* Header Navigation/Actions */}
      <div className="relative z-10 flex items-center justify-between w-full mt-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-500" />
          <span className="font-bold tracking-tight text-white/90 text-sm">SilentSOS</span>
        </div>
        <button
          onClick={handleLogOut}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white/55 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-6 max-w-xs mx-auto w-full">
        <AnimatePresence mode="wait">
          {phase === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6 shadow-lg shadow-emerald-950/20">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Safety PIN Configured!</h2>
              <p className="text-xs text-emerald-400 font-bold mb-6 tracking-wide uppercase">Your Security is Active</p>
              <p className="text-xs text-white/50 leading-relaxed max-w-[240px]">
                Proceeding to complete system permissions and contacts configuration...
              </p>
              <div className="mt-8 flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
                <span className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                Loading setup steps...
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pin-setup"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col items-center"
            >
              {/* Lock Shield Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600/20 to-pink-600/10 border border-red-500/20 flex items-center justify-center mb-6 shadow-md shadow-red-950/30">
                <Lock className="w-7 h-7 text-red-400" />
              </div>

              {/* Title & Description */}
              <h2 className="text-2xl font-black text-white text-center mb-2">
                {phase === 'create' ? 'Create Safety PIN' : 'Confirm Safety PIN'}
              </h2>
              <p className="text-xs text-white/40 text-center mb-8 max-w-[260px] leading-relaxed">
                {phase === 'create'
                  ? 'Set a custom 4-digit code. In an emergency, this PIN is required to cancel or disarm active alerts.'
                  : 'Please re-enter the 4-digit code to confirm it is correct.'}
              </p>

              {/* Dot Indicators */}
              <div className="flex gap-5 mb-8">
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    animate={pinError ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      enteredPin.length > index
                        ? pinError
                          ? 'bg-red-500 border-red-500'
                          : 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_#10b981]'
                        : 'border-white/20 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* PIN Error Message */}
              <div className="h-6 flex items-center justify-center mb-4">
                {errorMessage && (
                  <span className="text-xs text-red-400 font-bold animate-pulse text-center">
                    {errorMessage}
                  </span>
                )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="aspect-square rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-lg font-bold text-white flex items-center justify-center transition-all active:scale-90 shadow-sm cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  disabled={enteredPin.length === 0}
                  className="aspect-square rounded-2xl text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors flex items-center justify-center disabled:opacity-0 disabled:cursor-default cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleKeyPress('0')}
                  className="aspect-square rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-lg font-bold text-white flex items-center justify-center transition-all active:scale-90 shadow-sm cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  disabled={enteredPin.length === 0}
                  className="aspect-square rounded-2xl text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors flex items-center justify-center disabled:opacity-0 disabled:cursor-default cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Safety Notice Footer Card */}
      {phase !== 'success' && (
        <div className="relative z-10 bg-white/[0.02] border border-white/5 rounded-2xl p-4 mt-auto">
          <div className="flex gap-3 items-start">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-1">
                Security Advice
              </p>
              <p className="text-[10px] text-white/50 leading-relaxed">
                Choose a PIN that you can easily remember under stress. Avoid simple patterns like 1234 or 0000.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
