import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import {
  EyeOff,
  PhoneCall,
  Trash2,
  Smartphone,
  MessageSquare,
  LogOut,
  Lock,
  CheckCircle2,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Settings() {
  const { state, updateSettings, clearData, logout } = useApp();
  const [showFakeCall, setShowFakeCall] = useState(false);

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

        {/* Capture Settings */}
        <section>
          <h2 className="text-xs font-bold text-textMuted uppercase mb-3 flex items-center">
            <Smartphone className="w-4 h-4 mr-2" /> Capture Settings
          </h2>
          <div className="bg-surface border border-surfaceHighlight rounded-xl overflow-hidden">
            <div className="p-4 border-b border-surfaceHighlight">
              <div className="flex justify-between mb-2">
                <p className="font-medium">Photo Burst Count</p>
                <span className="text-sm text-textMuted">
                  {state.settings.photoBurstCount}
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="10"
                step="1"
                value={state.settings.photoBurstCount}
                onChange={(e) =>
                updateSettings({
                  photoBurstCount: parseInt(e.target.value) as any
                })
                }
                className="w-full accent-safe" />
              
            </div>
            <div className="p-4 border-b border-surfaceHighlight">
              <p className="font-medium mb-2">Video Duration</p>
              <div className="flex gap-2">
                {['30s', '1min', 'continuous'].map((dur) =>
                <button
                  key={dur}
                  onClick={() =>
                  updateSettings({
                    videoDuration: dur as any
                  })
                  }
                  className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${state.settings.videoDuration === dur ? 'bg-safe text-black font-bold' : 'bg-surfaceHighlight text-textMuted'}`}>
                  
                    {dur}
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 bg-warning/10">
              <p className="text-xs text-warning">
                Battery &lt; 20% → Video quality will automatically lower to
                save power.
              </p>
            </div>
          </div>
        </section>

        {/* Message Template */}
        <section>
          <h2 className="text-xs font-bold text-textMuted uppercase mb-3 flex items-center">
            <MessageSquare className="w-4 h-4 mr-2" /> Message Template
          </h2>
          <div className="bg-surface border border-surfaceHighlight rounded-xl p-4">
            <textarea
              value={state.settings.messageTemplate}
              onChange={(e) =>
              updateSettings({
                messageTemplate: e.target.value
              })
              }
              className="w-full h-32 bg-background rounded-lg p-3 text-xs text-textMuted outline-none focus:ring-1 focus:ring-safe resize-none mb-2" />
            
            <p className="text-[10px] text-textMuted">
              Available tags: {'{name}, {time}, {type}, {gps_link}'}
            </p>
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