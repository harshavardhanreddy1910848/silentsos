import { useState } from 'react';
import {
  UserPlusIcon,
  Trash2Icon,
  PhoneIcon,
  MailIcon,
  SendIcon,
  CheckIcon,
  XIcon } from
'lucide-react';
import { Screen } from '../components/ui/Screen';
import { useApp } from '../context/AppContext';
import { Contact, ContactPrefs } from '../lib/types';
import { Toggle } from '../components/ui/Toggle';
import { api } from '../lib/api';

const PREF_LABELS: {key: keyof ContactPrefs;label: string;}[] = [
{ key: 'gps', label: 'GPS Location' },
{ key: 'photos', label: 'Auto Photos' },
{ key: 'video', label: 'Video Recording' },
{ key: 'audio', label: 'Audio Recording' },
{ key: 'message', label: 'Alert Message' }];


export function Contacts() {
  const { contacts, addContact, updateContact, removeContact, profile, settings } = useApp();
  const [adding, setAdding] = useState(false);
  const [tested, setTested] = useState<string | null>(null);

  const test = async (c: Contact) => {
    setTested(c.id);
    if (c.email && c.email.trim()) {
      try {
        await api.sendEmergencyEmail({
          recipients: [c],
          userName: profile.name || 'SilentSOS User',
          alertType: 'sos',
          lat: 12.9716,
          lng: 77.5946,
          bloodGroup: profile.bloodGroup,
          address: profile.address,
          parentsName: profile.parentsName,
          messageTemplate: `[TEST ALERT] ${settings.messageTemplate}`
        });
      } catch (err) {
        console.error('Test email error:', err);
      }
    }
    setTimeout(() => setTested((t) => (t === c.id ? null : t)), 2500);
  };

  return (
    <Screen
      title="Contacts"
      right={
      contacts.length < 3 && !adding ?
      <button
        onClick={() => setAdding(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff1744]"
        aria-label="Add contact">
        
            <UserPlusIcon size={18} color="#fff" />
          </button> :
      undefined
      }>
      
      <p className="mb-4 text-sm text-white/50">
        {contacts.length}/3 emergency contacts. Choose exactly what each receives.
      </p>

      {adding &&
      <ContactForm
        onCancel={() => setAdding(false)}
        onSave={(c) => {
          addContact(c);
          setAdding(false);
        }} />

      }

      <div className="space-y-4">
        {contacts.map((c) =>
        <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff1744]/15 font-bold text-[#ff1744]">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold">{c.name}</p>
                  {c.phone &&
                <p className="flex items-center gap-1 text-xs text-white/50">
                      <PhoneIcon size={11} /> {c.phone}
                    </p>
                }
                  {c.email &&
                <p className="flex items-center gap-1 text-xs text-white/50">
                      <MailIcon size={11} /> {c.email}
                    </p>
                }
                </div>
              </div>
              <button
              onClick={() => removeContact(c.id)}
              className="text-white/40 hover:text-[#ff1744]"
              aria-label={`Remove ${c.name}`}>
              
                <Trash2Icon size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3">
              {PREF_LABELS.map(({ key, label }) =>
            <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm text-white/70">{label}</span>
                  <Toggle
                checked={c.prefs[key]}
                onChange={(v) =>
                updateContact(c.id, { prefs: { ...c.prefs, [key]: v } })
                } />
              
                </div>
            )}
            </div>

            <button
            onClick={() => test(c)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold"
            style={{
              backgroundColor: tested === c.id ? '#00e676' : 'rgba(255,255,255,0.08)',
              color: tested === c.id ? '#000' : '#fff'
            }}>
            
              {tested === c.id ?
            <>
                  <CheckIcon size={16} strokeWidth={3} /> Test alert sent
                </> :

            <>
                  <SendIcon size={16} /> Send test alert
                </>
            }
            </button>
          </div>
        )}

        {contacts.length === 0 && !adding &&
        <div className="py-16 text-center text-white/40">
            <p className="font-bold">No contacts yet</p>
            <p className="mt-1 text-sm text-white/30">Add someone who should receive your alerts.</p>
          </div>
        }
      </div>
    </Screen>);

}

function ContactForm({
  onSave,
  onCancel



}: {onSave: (c: Omit<Contact, 'id'>) => void;onCancel: () => void;}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div className="mb-4 rounded-2xl border border-[#ff1744]/30 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-bold">New contact</span>
        <button onClick={onCancel} aria-label="Cancel">
          <XIcon size={18} color="#888" />
        </button>
      </div>
      <div className="space-y-2.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#ff1744]" />
        
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          inputMode="tel"
          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#ff1744]" />
        
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          inputMode="email"
          className="w-full rounded-xl bg-black/40 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#ff1744]" />
        
      </div>
      <button
        disabled={!name.trim()}
        onClick={() =>
        onSave({
          name: name.trim(),
          phone,
          email,
          prefs: { gps: true, photos: true, video: true, audio: true, message: true }
        })
        }
        className="mt-3 w-full rounded-xl bg-[#ff1744] py-3 font-bold disabled:opacity-40">
        
        Save contact
      </button>
    </div>);

}