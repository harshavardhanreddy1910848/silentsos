/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback } from
'react';
import {
  AlertRecord,
  CaptureToggles,
  Contact,
  FeedbackEntry,
  Profile,
  Settings } from
'../lib/types';
import { uid } from '../lib/mock';
import { saveEvidenceToDb, deleteEvidenceFromDb } from '../lib/evidenceStore';

const KEY = 'silentsos_state_v1';

interface PersistShape {
  profile: Profile;
  contacts: Contact[];
  settings: Settings;
  capture: CaptureToggles;
  history: AlertRecord[];
  feedback: FeedbackEntry[];
}

const DEFAULT_SETTINGS: Settings = {
  sensitivity: 'medium',
  autoRepeat: 5,
  burstCount: 5,
  videoDuration: '1min',
  audioQuality: 'high',
  cameraChoice: 'both',
  discreet: false,
  messageTemplate:
  '🚨 EMERGENCY ALERT — SilentSOS\nI need help. My live location and evidence are attached. Please respond immediately or call emergency services.',
  autoDeleteDays: 14,
  safetyPin: '1234',
  pinEnabled: true
};

const DEFAULT_PROFILE: Profile = {
  name: '',
  email: '',
  address: '',
  parentsName: '',
  bloodGroup: '',
  createdAt: null,
  role: 'user',
  gesture: 'camera-gesture',
  permissions: { camera: false, microphone: false, location: false, storage: false },
  authenticated: false,
  onboarded: false
};

const DEFAULT_STATE: PersistShape = {
  profile: DEFAULT_PROFILE,
  contacts: [],
  settings: DEFAULT_SETTINGS,
  capture: { photos: true, video: true, audio: true },
  history: [],
  feedback: []
};

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
        safetyPin: parsed.settings?.safetyPin || DEFAULT_SETTINGS.safetyPin,
        pinEnabled: parsed.settings?.pinEnabled ?? DEFAULT_SETTINGS.pinEnabled
      },
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
      capture: { ...DEFAULT_STATE.capture, ...(parsed.capture || {}) }
    };
  } catch {
    return DEFAULT_STATE;
  }
}

interface Ctx extends PersistShape {
  setProfile: (p: Partial<Profile>) => void;
  addContact: (c: Omit<Contact, 'id'>) => void;
  updateContact: (id: string, c: Partial<Contact>) => void;
  removeContact: (id: string) => void;
  setSettings: (s: Partial<Settings>) => void;
  setCapture: (c: Partial<CaptureToggles>) => void;
  addAlert: (a: AlertRecord) => void;
  updateAlert: (id: string, a: Partial<AlertRecord>) => void;
  deleteAlert: (id: string) => void;
  addFeedback: (entry: Omit<FeedbackEntry, 'id' | 'createdAt' | 'status'>) => void;
  resolveFeedback: (id: string) => void;
  reset: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: {children: React.ReactNode;}) {
  const [state, setState] = useState<PersistShape>(load);

  // Safe localStorage persistence: saves metadata and state without exceeding quota
  useEffect(() => {
    try {
      // Create a lightweight copy for localStorage that won't exceed browser quota
      const safeState: PersistShape = {
        ...state,
        history: state.history.map((h) => ({
          ...h,
          // If data URLs are huge, IndexedDB preserves them safely
          photoDataUrl: h.photoDataUrl && h.photoDataUrl.length > 200000 ? h.photoDataUrl.slice(0, 100) + '...' : h.photoDataUrl,
          photoDataUrls: h.photoDataUrls?.map((p) => p.length > 200000 ? p.slice(0, 100) + '...' : p),
          videoDataUrl: h.videoDataUrl && h.videoDataUrl.length > 200000 ? undefined : h.videoDataUrl,
          audioDataUrl: h.audioDataUrl && h.audioDataUrl.length > 200000 ? undefined : h.audioDataUrl
        }))
      };
      localStorage.setItem(KEY, JSON.stringify(safeState));
    } catch (err) {
      console.warn('LocalStorage save notice (evidence stored safely in IndexedDB):', err);
    }
  }, [state]);

  const setProfile = useCallback((p: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
  }, []);

  const addContact = useCallback((c: Omit<Contact, 'id'>) => {
    setState((s) =>
    s.contacts.length >= 3 ?
    s :
    { ...s, contacts: [...s.contacts, { ...c, id: uid() }] }
    );
  }, []);

  const updateContact = useCallback((id: string, c: Partial<Contact>) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.map((x) => x.id === id ? { ...x, ...c } : x)
    }));
  }, []);

  const removeContact = useCallback((id: string) => {
    setState((s) => ({ ...s, contacts: s.contacts.filter((x) => x.id !== id) }));
  }, []);

  const setSettings = useCallback((s2: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...s2 } }));
  }, []);

  const setCapture = useCallback((c: Partial<CaptureToggles>) => {
    setState((s) => ({ ...s, capture: { ...s.capture, ...c } }));
  }, []);

  const addAlert = useCallback((a: AlertRecord) => {
    if (a.photoDataUrl || a.photoDataUrls || a.videoDataUrl || a.audioDataUrl) {
      saveEvidenceToDb({
        alertId: a.id,
        photoDataUrl: a.photoDataUrl,
        photoDataUrls: a.photoDataUrls,
        videoDataUrl: a.videoDataUrl,
        audioDataUrl: a.audioDataUrl,
        updatedAt: Date.now()
      });
    }
    setState((s) => ({ ...s, history: [a, ...s.history] }));
  }, []);

  const updateAlert = useCallback((id: string, a: Partial<AlertRecord>) => {
    setState((s) => {
      const nextHistory = s.history.map((x) => {
        if (x.id !== id) return x;
        const updated: AlertRecord = {
          ...x,
          ...a,
          photoDataUrl: a.photoDataUrl !== undefined ? a.photoDataUrl : x.photoDataUrl,
          photoDataUrls: (a.photoDataUrls && a.photoDataUrls.length > 0) ? a.photoDataUrls : x.photoDataUrls,
          videoDataUrl: a.videoDataUrl !== undefined ? a.videoDataUrl : x.videoDataUrl,
          audioDataUrl: a.audioDataUrl !== undefined ? a.audioDataUrl : x.audioDataUrl
        };
        if (updated.photoDataUrl || updated.photoDataUrls || updated.videoDataUrl || updated.audioDataUrl) {
          saveEvidenceToDb({
            alertId: id,
            photoDataUrl: updated.photoDataUrl,
            photoDataUrls: updated.photoDataUrls,
            videoDataUrl: updated.videoDataUrl,
            audioDataUrl: updated.audioDataUrl,
            updatedAt: Date.now()
          });
        }
        return updated;
      });
      return { ...s, history: nextHistory };
    });
  }, []);

  const deleteAlert = useCallback((id: string) => {
    deleteEvidenceFromDb(id);
    setState((s) => ({ ...s, history: s.history.filter((x) => x.id !== id) }));
  }, []);

  const addFeedback = useCallback((entry: Omit<FeedbackEntry, 'id' | 'createdAt' | 'status'>) => {
    setState((s) => ({
      ...s,
      feedback: [
      { ...entry, id: uid(), createdAt: Date.now(), status: 'open' },
      ...s.feedback]

    }));
  }, []);

  const resolveFeedback = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      feedback: s.feedback.map((entry) =>
      entry.id === id ? { ...entry, status: 'resolved' } : entry
      )
    }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setState(DEFAULT_STATE);
  }, []);

  return (
    <AppCtx.Provider
      value={{
        ...state,
        setProfile,
        addContact,
        updateContact,
        removeContact,
        setSettings,
        setCapture,
        addAlert,
        updateAlert,
        deleteAlert,
        addFeedback,
        resolveFeedback,
        reset
      }}>
      
      {children}
    </AppCtx.Provider>);

}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}