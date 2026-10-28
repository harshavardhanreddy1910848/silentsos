import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { AppState, Contact, Settings, AlertEvent, UserProfile, FeedbackSubmission, FeedbackItem } from './types';

const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
export const API_BASE   = `${protocol}//${host}:3001/api`;
export const MEDIA_BASE = `${protocol}//${host}:3001`; // For /evidence/* static files


const defaultSettings: Settings = {
  gestureSensitivity: 'Medium',
  autoRepeatInterval: 5,
  photoBurstCount: 5,
  videoDuration: '1min',
  audioQuality: 'high',
  cameraPreference: 'both',
  fakeCallDisguise: false,
  stealthMode: false,
  messageTemplate:
    '🚨 EMERGENCY ALERT — SilentSOS\nFrom: {name}\nTime: {time}\nType: {type}\n\n📍 GPS Location: {gps_link}\n\n⚠️ Please respond immediately or call emergency services. Updates every 5 minutes until you acknowledge.',
  safetyPin: '1234',
  autoDeleteDays: 30
};

const initialState: AppState = {
  isSetupComplete: false,
  userName: '',
  userRole: 'user',
  contacts: [],
  settings: defaultSettings,
  history: [],
  activeAlert: null
};

type AppContextType = {
  state: AppState;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  sendAuthToken: (email: string) => Promise<{ success: boolean; message: string; forwarded?: boolean }>;
  verifyAuthToken: (email: string, token: string) => Promise<void>;
  testResendAlert: (email?: string) => Promise<any>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; forwarded?: boolean }>;
  resetPassword: (email: string, password: string, token?: string) => Promise<void>;
  logout: () => void;
  updateUser: (name: string) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<UserProfile | void>;
  addContact: (contact: Contact) => Promise<void>;
  updateContact: (id: string, contact: Partial<Contact>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  addHistoryEvent: (event: AlertEvent) => void;
  triggerAlert: (type: string) => Promise<void>;
  cancelAlert: () => Promise<void>;
  stopAlert: () => Promise<void>;
  completeSetup: () => Promise<void>;
  clearData: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  submitFeedback: (feedback: FeedbackSubmission) => Promise<{ success: boolean; feedback?: FeedbackItem; error?: string }>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('silentsos_token') || sessionStorage.getItem('silentsos_token');
  });

  const persistToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem('silentsos_token', newToken);
      sessionStorage.setItem('silentsos_token', newToken);
    } else {
      localStorage.removeItem('silentsos_token');
      sessionStorage.removeItem('silentsos_token');
    }
    setToken(newToken);
  };

  // Sync state with backend on startup
  const fetchState = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/state`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setState({
          isSetupComplete: data.user.isSetupComplete,
          userName: data.user.name,
          userRole: data.user.role || 'user',
          user: data.user,
          contacts: data.contacts,
          settings: data.settings,
          history: data.history,
          activeAlert: data.activeAlert ? {
            isActive: data.activeAlert.isActive,
            isCountingDown: false,
            startTime: data.activeAlert.startTime,
            type: data.activeAlert.type,
            id: data.activeAlert.id,
            contactsNotified: data.activeAlert.contactsNotified
          } : null
        });
      } else if (res.status === 401 || res.status === 403) {
        logout();
      }
    } catch (e) {
      console.error('Failed to sync state with backend:', e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchState(token);
    } else {
      setState(initialState);
    }
  }, [token]);

  const refreshHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const history = await res.json();
        setState(s => ({ ...s, history }));
      }
    } catch (e) {
      console.error('Failed to load alerts history', e);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    persistToken(data.token);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    persistToken(data.token);
  };

  const sendAuthToken = async (email: string) => {
    const res = await fetch(`${API_BASE}/auth/send-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch security token');
    }
    return data;
  };

  const verifyAuthToken = async (email: string, tokenStr: string) => {
    const res = await fetch(`${API_BASE}/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token: tokenStr })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to verify security token');
    }
    persistToken(data.token);
  };

  const testResendAlert = async (email?: string) => {
    const res = await fetch(`${API_BASE}/alerts/test-resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch test alert');
    }
    return data;
  };

  const requestPasswordReset = async (email: string) => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch verification email');
    }
    return data;
  };

  const resetPassword = async (email: string, password: string, token?: string) => {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, token })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Password reset failed');
    }
    return data;
  };

  const logout = () => {
    persistToken(null);
    setState(initialState);
  };

  const updateUser = async (name: string) => {
    setState((s) => ({
      ...s,
      userName: name,
      user: s.user ? { ...s.user, name } : undefined
    }));
    if (!token) return;
    try {
      await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
    } catch (e) {
      console.error('Failed to update user profile:', e);
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<UserProfile | void> => {
    setState((s) => ({
      ...s,
      userName: updates.name !== undefined ? updates.name : s.userName,
      user: s.user ? { ...s.user, ...updates } : (updates as UserProfile)
    }));
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setState((s) => ({
          ...s,
          userName: updated.name || s.userName,
          user: updated
        }));
        return updated;
      }
    } catch (e) {
      console.error('Failed to update full user profile:', e);
      throw e;
    }
  };

  const addContact = async (contact: Contact) => {
    setState((s) => ({
      ...s,
      contacts: [...s.contacts, contact].slice(0, 3)
    }));
    if (!token) return;
    try {
      await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(contact)
      });
    } catch (e) {
      console.error('Failed to add contact:', e);
    }
  };

  const updateContact = async (id: string, updates: Partial<Contact>) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      )
    }));
    if (!token) return;
    try {
      await fetch(`${API_BASE}/contacts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.error('Failed to update contact:', e);
    }
  };

  const removeContact = async (id: string) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.filter((c) => c.id !== id)
    }));
    if (!token) return;
    try {
      await fetch(`${API_BASE}/contacts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Failed to remove contact:', e);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, ...updates }
    }));
    if (!token) return;
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.error('Failed to update settings:', e);
    }
  };

  const addHistoryEvent = (event: AlertEvent) => {
    setState((s) => ({
      ...s,
      history: [event, ...s.history]
    }));
  };

  const triggerAlert = async (type: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      // Set activeAlert with pending state immediately for responsive UI
      setState((s) => ({
        ...s,
        activeAlert: {
          isActive: true,
          isCountingDown: true,
          startTime: Date.now(),
          type,
          id: undefined
        }
      }));

      const dispatchAlertWithLocation = async (loc: { lat: number; lng: number }) => {
        if (!token) {
          resolve();
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/alerts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              type,
              location: loc
            })
          });

          if (res.ok) {
            const data = await res.json();
            setState((s) => ({
              ...s,
              activeAlert: {
                isActive: true,
                isCountingDown: true,
                startTime: data.timestamp,
                type: data.type,
                id: data.id,
                contactsNotified: data.contactsNotified
              }
            }));
            resolve();
          } else {
            const errData = await res.json().catch(() => ({ error: 'Unknown server error' }));
            const errMsg = errData.error || 'Server error triggering alert';
            setState((s) => ({ ...s, activeAlert: null }));
            alert(`🚨 Trigger Failed: ${errMsg}`);
            reject(new Error(errMsg));
          }
        } catch (e: any) {
          setState((s) => ({ ...s, activeAlert: null }));
          alert(`🚨 Network Error: ${e.message}`);
          reject(e);
        }
      };

      if (!navigator.geolocation) {
        console.warn('Geolocation not supported, using emergency default coordinates');
        dispatchAlertWithLocation({ lat: 17.448293, lng: 78.391485 });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          dispatchAlertWithLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn(`Geolocation error (${error.code}): ${error.message}. Dispatching with approximate/last known coordinates...`);
          // Fallback coordinates to guarantee emergency distress signal is dispatched even if GPS signal is blocked indoors or denied
          dispatchAlertWithLocation({ lat: 17.448293, lng: 78.391485 });
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000
        }
      );
    });
  };


  const cancelAlert = async () => {
    const alertId = state.activeAlert?.id;
    setState((s) => ({ ...s, activeAlert: null }));

    if (alertId && token) {
      try {
        await fetch(`${API_BASE}/alerts/${alertId}/cancel`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        await refreshHistory();
      } catch (e) {
        console.error('Failed to cancel alert:', e);
      }
    }
  };

  const stopAlert = async () => {
    const alertId = state.activeAlert?.id;
    setState((s) => ({ ...s, activeAlert: null }));

    if (alertId && token) {
      try {
        await fetch(`${API_BASE}/alerts/${alertId}/stop`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        await refreshHistory();
      } catch (e) {
        console.error('Failed to stop alert:', e);
      }
    }
  };

  const completeSetup = async () => {
    setState((s) => ({ ...s, isSetupComplete: true }));
    if (!token) return;
    try {
      await fetch(`${API_BASE}/user/setup-complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Failed to complete setup:', e);
    }
  };

  const clearData = async () => {
    setState(initialState);
    if (!token) return;
    try {
      await fetch(`${API_BASE}/clear-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Failed to clear data:', e);
    }
  };

  const deleteAlert = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await refreshHistory();
      }
    } catch (e) {
      console.error('Failed to delete alert:', e);
    }
  };

  const submitFeedback = async (feedbackData: FeedbackSubmission) => {
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(feedbackData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }
      return data;
    } catch (e) {
      console.error('Feedback submission error:', e);
      throw e;
    }
  };

  return (
    <AppContext.Provider
      value={{
        state,
        token,
        isAuthenticated: !!token,
        login,
        register,
        sendAuthToken,
        verifyAuthToken,
        testResendAlert,
        requestPasswordReset,
        resetPassword,
        logout,
        updateUser,
        updateUserProfile,
        addContact,
        updateContact,
        removeContact,
        updateSettings,
        addHistoryEvent,
        triggerAlert,
        cancelAlert,
        stopAlert,
        completeSetup,
        clearData,
        refreshHistory,
        deleteAlert,
        submitFeedback
      }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}