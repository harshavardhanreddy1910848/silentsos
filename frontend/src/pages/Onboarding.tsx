import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldIcon,
  UserIcon,
  PlusIcon,
  Trash2Icon,
  CameraIcon,
  MicIcon,
  MapPinIcon,
  HardDriveIcon,
  CheckIcon,
  ArrowRightIcon } from
'lucide-react';
import { useApp } from '../context/AppContext';
import { GestureType, Permissions } from '../lib/types';
import { uid } from '../lib/mock';

const GESTURES: {id: GestureType;label: string;desc: string;Icon: React.ComponentType<{ size?: number | string; color?: string }>;}[] = [
  { id: 'sos-button', label: 'SOS Emergency Button', desc: 'Tap the main red SOS panic button', Icon: ShieldIcon },
  { id: 'voice-mode', label: 'Voice Mode', desc: 'Say "help" or "emergency" to fire alert', Icon: MicIcon },
  { id: 'camera-gesture', label: 'Camera Gesture', desc: 'Wave / blink / raised hand to camera', Icon: CameraIcon }
];


const PERMS: {key: keyof Permissions;label: string;Icon: React.ComponentType<{ size?: number | string; color?: string }>;why: string;}[] = [
{ key: 'camera', label: 'Camera', Icon: CameraIcon, why: 'Photo & video evidence' },
{ key: 'microphone', label: 'Microphone', Icon: MicIcon, why: 'Ambient audio capture' },
{ key: 'location', label: 'Location', Icon: MapPinIcon, why: 'Live GPS tracking' },
{ key: 'storage', label: 'Storage', Icon: HardDriveIcon, why: 'Local evidence backup' }];


export function Onboarding() {
  const nav = useNavigate();
  const { setProfile, addContact } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedGestures, setSelectedGestures] = useState<GestureType[]>([
    'sos-button',
    'voice-mode',
    'camera-gesture'
  ]);
  const [perms, setPerms] = useState<Permissions>({
    camera: false,
    microphone: false,
    location: false,
    storage: false
  });
  const [contacts, setContacts] = useState(
    [{ id: uid(), name: '', phone: '', email: '' }]
  );

  const toggleGesture = (id: GestureType) => {
    setSelectedGestures((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedGestures(['sos-button', 'voice-mode', 'camera-gesture']);
  };

  const setContact = (id: string, k: string, v: string) =>
  setContacts((c) => c.map((x) => x.id === id ? { ...x, [k]: v } : x));

  const finish = () => {
    contacts.
    filter((c) => c.name.trim()).
    forEach((c) =>
    addContact({
      name: c.name,
      phone: c.phone,
      email: c.email,
      prefs: { gps: true, photos: true, video: true, audio: true, message: true }
    })
    );
    setProfile({
      name: name.trim() || 'User',
      gesture: selectedGestures[0] || 'sos-button',
      selectedGestures,
      permissions: perms,
      onboarded: true
    });
    nav('/home', { replace: true });
  };

  const canNext =
    (step === 0 && selectedGestures.length > 0) ||
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && contacts.some((c) => c.name.trim())) ||
    step === 3;

  const allSelected = selectedGestures.length === GESTURES.length;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* progress */}
      <div className="flex gap-1.5 px-5 pt-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i <= step ? '#ff1744' : '#2a2a2a' }}
          />
        ))}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}>
            
            {step === 0 && (
              <div>
                <StepHead
                  icon={ShieldIcon}
                  title="Select panic triggers"
                  sub="Select all trigger options you wish to activate."
                />

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs font-bold text-[#00e676] hover:underline">
                    {allSelected ? '✓ All options selected' : '+ Select all triggers'}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {GESTURES.map((g) => {
                    const active = selectedGestures.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGesture(g.id)}
                        className="flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors"
                        style={{
                          borderColor: active ? '#ff1744' : 'rgba(255,255,255,0.1)',
                          backgroundColor: active ? 'rgba(255,23,68,0.1)' : 'rgba(255,255,255,0.03)'
                        }}>
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: active ? '#ff1744' : 'rgba(255,255,255,0.06)' }}>
                          <g.Icon size={22} color="#fff" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{g.label}</p>
                          <p className="text-xs text-white/50">{g.desc}</p>
                        </div>
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-lg border transition-colors"
                          style={{
                            borderColor: active ? '#ff1744' : 'rgba(255,255,255,0.2)',
                            backgroundColor: active ? '#ff1744' : 'transparent'
                          }}>
                          {active && <CheckIcon size={16} color="#fff" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <StepHead icon={UserIcon} title="Your name" sub="Contacts will see who needs help." />
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg font-semibold outline-none focus:border-[#ff1744]"
                />
              </div>
            )}

            {step === 2 && (
              <div>
                <StepHead
                  icon={UserIcon}
                  title="Emergency contacts"
                  sub="Add up to 3 people who receive your alerts."
                />

                <div className="mt-5 space-y-4">
                  {contacts.map((c, i) => (
                    <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-white/40">
                          Contact {i + 1}
                        </span>
                        {contacts.length > 1 && (
                          <button
                            onClick={() => setContacts((x) => x.filter((y) => y.id !== c.id))}
                            className="text-white/40 hover:text-[#ff1744]"
                            aria-label="Remove contact">
                            <Trash2Icon size={18} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        <input
                          value={c.name}
                          onChange={(e) => setContact(c.id, 'name', e.target.value)}
                          placeholder="Name"
                          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm font-medium outline-none focus:ring-1 focus:ring-[#ff1744]"
                        />
                        <input
                          value={c.phone}
                          onChange={(e) => setContact(c.id, 'phone', e.target.value)}
                          placeholder="Phone"
                          inputMode="tel"
                          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm font-medium outline-none focus:ring-1 focus:ring-[#ff1744]"
                        />
                        <input
                          value={c.email}
                          onChange={(e) => setContact(c.id, 'email', e.target.value)}
                          placeholder="Email (optional)"
                          inputMode="email"
                          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm font-medium outline-none focus:ring-1 focus:ring-[#ff1744]"
                        />
                      </div>
                    </div>
                  ))}
                  {contacts.length < 3 && (
                    <button
                      onClick={() =>
                        setContacts((x) => [...x, { id: uid(), name: '', phone: '', email: '' }])
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-3.5 text-sm font-semibold text-white/60 hover:border-white/40">
                      <PlusIcon size={18} /> Add another contact
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <StepHead
                  icon={ShieldIcon}
                  title="Permissions"
                  sub="Grant access so evidence capture works instantly."
                />

                <div className="mt-5 space-y-3">
                  {PERMS.map((p) => {
                    const granted = perms[p.key];
                    return (
                      <button
                        key={p.key}
                        onClick={() => setPerms((x) => ({ ...x, [p.key]: !x[p.key] }))}
                        className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/6">
                          <p.Icon size={22} color="#fff" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{p.label}</p>
                          <p className="text-xs text-white/50">{p.why}</p>
                        </div>
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: granted ? '#00e676' : 'rgba(255,255,255,0.1)'
                          }}>
                          {granted && <CheckIcon size={16} color="#000" strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    setPerms({ camera: true, microphone: true, location: true, storage: true })
                  }
                  className="mt-4 w-full text-sm font-semibold text-[#00e676]">
                  Grant all permissions
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-white/10 p-5">
        <button
          disabled={!canNext}
          onClick={() => (step === 3 ? finish() : setStep((s) => s + 1))}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ff1744] py-4 text-lg font-bold text-white transition-opacity disabled:opacity-30">
          {step === 3 ? 'Arm SilentSOS' : 'Continue'}
          <ArrowRightIcon size={20} />
        </button>
      </div>
    </div>
  );
}

function StepHead({ icon: Icon, title, sub }: {icon: React.ComponentType<{ size?: number | string; color?: string }>;title: string;sub: string;}) {
  return (
    <div className="pt-4">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff1744]/15">
        <Icon size={24} color="#ff1744" />
      </div>
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-white/50">{sub}</p>
    </div>);

}