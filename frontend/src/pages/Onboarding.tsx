import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import {
  ShieldAlert,
  Camera,
  Mic,
  MapPin,
  HardDrive,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

export function Onboarding() {
  const { state, updateUser, addContact, removeContact, completeSetup } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(state.userName);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: ''
  });

  // Permissions state
  const [permissionsState, setPermissionsState] = useState({
    camera: 'prompt' as 'prompt' | 'granted' | 'denied',
    microphone: 'prompt' as 'prompt' | 'granted' | 'denied',
    location: 'prompt' as 'prompt' | 'granted' | 'denied',
    storage: 'granted' as 'prompt' | 'granted' | 'denied' // Storage is implicitly granted in web (localStorage/IndexedDB)
  });

  const requestPermissions = async () => {
    // 1. Request Location
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setPermissionsState(prev => ({ ...prev, location: 'granted' }));
            resolve();
          },
          () => {
            setPermissionsState(prev => ({ ...prev, location: 'denied' }));
            resolve();
          }
        );
      });
    }

    // 2. Request Camera and Audio with fallback
    let cameraGranted = false;
    let microphoneGranted = false;

    try {
      // Try both first
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      cameraGranted = true;
      microphoneGranted = true;
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.warn('Onboarding: Direct video+audio request failed, trying fallbacks:', err);
      
      // Try camera only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraGranted = true;
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Onboarding: Video-only request failed:', e);
      }

      // Try mic only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        microphoneGranted = true;
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Onboarding: Audio-only request failed:', e);
      }
    }

    setPermissionsState(prev => ({
      ...prev,
      camera: cameraGranted ? 'granted' : 'denied',
      microphone: microphoneGranted ? 'granted' : 'denied'
    }));
  };

  const handleNext = () => {
    if (step === 1 && name.trim()) {
      updateUser(name);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      completeSetup();
      navigate('/');
    }
  };

  const handleAddContact = () => {
    if (
      newContact.name &&
      (newContact.phone || newContact.email) &&
      state.contacts.length < 3
    ) {
      addContact({
        id: Date.now().toString(),
        ...newContact,
        preferences: {
          gps: true,
          photos: true,
          video: true,
          audio: true,
          message: true
        }
      });
      setNewContact({
        name: '',
        phone: '',
        email: ''
      });
    }
  };

  const hasAsked = permissionsState.camera !== 'prompt' || permissionsState.location !== 'prompt';
  const hasDenied = permissionsState.camera === 'denied' || permissionsState.location === 'denied';

  return (
    <div className="flex flex-col h-full bg-background p-6 overflow-y-auto no-scrollbar pb-24">
      <div className="flex items-center justify-center mb-8 mt-4">
        <ShieldAlert className="w-12 h-12 text-emergency mr-3" />
        <h1 className="text-3xl font-bold tracking-tight">SilentSOS</h1>
      </div>

      <p className="text-center text-textMuted mb-10 font-medium">
        When words fail, SilentSOS speaks for you.
      </p>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1"
      >
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Who are you?</h2>
            <p className="text-textMuted text-sm">
              This name will be sent to your emergency contacts.
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-surface border border-surfaceHighlight rounded-xl p-4 text-lg focus:border-emergency focus:ring-1 focus:ring-emergency outline-none transition-all"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Emergency Contacts</h2>
            <p className="text-textMuted text-sm">
              Add up to 3 people to notify when you trigger an alert.
            </p>

            <div className="space-y-3">
              {state.contacts.map((c) => (
                <div
                  key={c.id}
                  className="bg-surface p-4 rounded-xl flex justify-between items-center border border-surfaceHighlight"
                >
                  <div>
                    <p className="font-bold text-white">{c.name}</p>
                    <p className="text-sm text-textMuted">{c.phone || c.email}</p>
                  </div>
                  <button
                    onClick={() => removeContact(c.id)}
                    className="p-2 text-textMuted hover:text-emergency"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {state.contacts.length < 3 && (
              <div className="bg-surface p-4 rounded-xl border border-surfaceHighlight space-y-3">
                <input
                  type="text"
                  placeholder="Contact Name"
                  value={newContact.name}
                  onChange={(e) =>
                    setNewContact({
                      ...newContact,
                      name: e.target.value
                    })
                  }
                  className="w-full bg-background rounded-lg p-3 outline-none focus:ring-1 focus:ring-emergency text-white text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newContact.phone}
                  onChange={(e) =>
                    setNewContact({
                      ...newContact,
                      phone: e.target.value
                    })
                  }
                  className="w-full bg-background rounded-lg p-3 outline-none focus:ring-1 focus:ring-emergency text-white text-sm"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact({
                      ...newContact,
                      email: e.target.value
                    })
                  }
                  className="w-full bg-background rounded-lg p-3 outline-none focus:ring-1 focus:ring-emergency text-white text-sm"
                />
                <button
                  onClick={handleAddContact}
                  disabled={!newContact.name || (!newContact.phone && !newContact.email)}
                  className="w-full py-3 bg-surfaceHighlight rounded-lg font-bold flex items-center justify-center disabled:opacity-50 text-white text-sm transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" /> Add Contact
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Permissions</h2>
            <p className="text-textMuted text-sm">
              SilentSOS needs access to capture evidence during an emergency.
            </p>

            <div className="space-y-3">
              {[
                {
                  icon: Camera,
                  title: 'Camera',
                  desc: 'To capture photo bursts and video evidence',
                  status: permissionsState.camera
                },
                {
                  icon: Mic,
                  title: 'Microphone',
                  desc: 'To record ambient audio logs',
                  status: permissionsState.microphone
                },
                {
                  icon: MapPin,
                  title: 'Location',
                  desc: 'To broadcast live GPS coordinates',
                  status: permissionsState.location
                },
                {
                  icon: HardDrive,
                  title: 'Storage',
                  desc: 'To cache assets locally',
                  status: permissionsState.storage
                }
              ].map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-surface rounded-xl border border-surfaceHighlight"
                >
                  <div className="flex items-center">
                    <div className="bg-surfaceHighlight p-3 rounded-full mr-4">
                      <p.icon className="w-5 h-5 text-emergency" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{p.title}</p>
                      <p className="text-[10px] text-textMuted max-w-[180px]">{p.desc}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      p.status === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : p.status === 'denied'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-surfaceHighlight text-textMuted'
                    }`}
                  >
                    {p.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {hasDenied && (
              <div className="bg-warning/15 border border-warning/20 p-3.5 rounded-xl flex gap-2.5">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                <p className="text-[10px] text-warning">
                  ⚠️ Some permissions were denied. The app will use secure synthetic fallbacks, but live tracking and camera feeds will be restricted. Please enable them in your browser/OS settings for real security.
                </p>
              </div>
            )}

            {!hasAsked ? (
              <button
                onClick={requestPermissions}
                className="w-full bg-surfaceHighlight hover:bg-surface text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
              >
                Allow System Permissions
              </button>
            ) : (
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold">
                <CheckCircle className="w-4 h-4" /> System Configured
              </div>
            )}

            <p className="text-[10px] text-center text-textMuted mt-4">
              Complies with Apple and Android privacy frameworks. Assets are encrypted in transit.
            </p>
          </div>
        )}
      </motion.div>

      <div className="mt-auto pt-6">
        <button
          onClick={handleNext}
          disabled={step === 1 && !name.trim()}
          className="w-full bg-emergency hover:bg-emergencyHover text-white font-bold py-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {step === 3 ? 'Complete Setup' : 'Continue'}
          <ChevronRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}