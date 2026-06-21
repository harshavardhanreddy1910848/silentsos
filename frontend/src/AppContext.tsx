import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { AppState, Contact, Settings, AlertEvent } from './types';

export const API_BASE   = 'http://localhost:3001/api';
export const MEDIA_BASE = 'http://localhost:3001'; // For /evidence/* static files


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
  resetPassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (name: string) => Promise<void>;
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
  currentLocation: {
    lat: number | null;
    lng: number | null;
    accuracy: number;
    timestamp: number;
  };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('silentsos_token'));

  // Background geolocation tracker
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number | null;
    lng: number | null;
    accuracy: number;
    timestamp: number;
  }>({
    lat: null,
    lng: null,
    accuracy: Infinity,
    timestamp: 0
  });

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now()
        });
      },
      (err) => {
        console.warn('[Background Geolocation] Error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const getCurrentPreciseLocation = (maxWaitMs = 3500, desiredAccuracyMeters = 30): Promise<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
    googleMapsLink: string;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      let watchId: number | null = null;
      let bestPosition: GeolocationPosition | null = null;
      let hasResolved = false;

      const resolveWithPosition = (pos: GeolocationPosition) => {
        if (hasResolved) return;
        hasResolved = true;
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        resolve({
          lat,
          lng,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
          googleMapsLink: `https://maps.google.com/?q=${lat},${lng}`
        });
      };

      const timeoutId = setTimeout(() => {
        if (!hasResolved) {
          if (bestPosition) {
            console.log(`[Geolocation] Resolve on timeout with best position: accuracy ${bestPosition.coords.accuracy}m`);
            resolveWithPosition(bestPosition);
          } else {
            console.log('[Geolocation] No position received during watch, falling back to getCurrentPosition');
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolveWithPosition(pos);
              },
              (err) => {
                reject(err);
              },
              { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 }
            );
          }
        }
      }, maxWaitMs);

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          console.log(`[Geolocation] Received update: accuracy ${pos.coords.accuracy}m`);
          if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = pos;
          }
          if (pos.coords.accuracy <= desiredAccuracyMeters) {
            console.log(`[Geolocation] Desired accuracy (${desiredAccuracyMeters}m) met: accuracy ${pos.coords.accuracy}m. Resolving immediately.`);
            clearTimeout(timeoutId);
            resolveWithPosition(pos);
          }
        },
        (err) => {
          console.warn('[Geolocation] watchPosition error:', err);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: maxWaitMs
        }
      );
    });
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
    sessionStorage.setItem('silentsos_token', data.token);
    setToken(data.token);
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
    sessionStorage.setItem('silentsos_token', data.token);
    setToken(data.token);
  };

  const resetPassword = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Password reset failed');
    }
  };

  const logout = () => {
    sessionStorage.removeItem('silentsos_token');
    setToken(null);
    setState(initialState);
  };

  const updateUser = async (name: string) => {
    setState((s) => ({ ...s, userName: name }));
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
    return new Promise<void>(async (resolve, reject) => {
      if (!navigator.geolocation) {
        const errMsg = 'Geolocation is not supported by your browser. Location access is required to trigger an SOS alert.';
        alert(`🚨 Error: ${errMsg}`);
        reject(new Error(errMsg));
        return;
      }

      // Check if we already have an accurate background location (< 50 meters) and it's fresh (< 10 seconds)
      const now = Date.now();
      const isFreshAndAccurate =
        currentLocation.lat !== null &&
        currentLocation.lng !== null &&
        currentLocation.accuracy <= 50 &&
        (now - currentLocation.timestamp) < 10000;

      let loc;

      if (isFreshAndAccurate) {
        console.log('[Geolocation] Using fresh and accurate background location:', currentLocation);
        loc = {
          lat: currentLocation.lat!,
          lng: currentLocation.lng!,
          accuracy: currentLocation.accuracy,
          timestamp: currentLocation.timestamp,
          googleMapsLink: `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`
        };
      } else {
        console.log('[Geolocation] Background location not sufficient. Running precise lookup...');
        try {
          loc = await getCurrentPreciseLocation(3500, 30);
        } catch (err: any) {
          console.warn('[Geolocation] Precise lookup failed, attempting fallback getCurrentPosition:', err);
          try {
            const pos = await new Promise<GeolocationPosition>((res, rej) => {
              navigator.geolocation.getCurrentPosition(res, rej, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
              });
            });
            loc = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp || Date.now(),
              googleMapsLink: `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`
            };
          } catch (fallbackErr: any) {
            let msg = 'Location access is required to trigger an SOS alert. ';
            if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
              msg += 'Permission was denied. Please allow location access in your browser settings and try again.';
            } else if (fallbackErr.code === fallbackErr.POSITION_UNAVAILABLE) {
              msg += 'Location information is unavailable.';
            } else if (fallbackErr.code === fallbackErr.TIMEOUT) {
              msg += 'Location request timed out.';
            } else {
              msg += fallbackErr.message;
            }
            alert(`🚨 Geolocation Error: ${msg}`);
            reject(new Error(msg));
            return;
          }
        }
      }

      // Set activeAlert with pending status
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

  return (
    <AppContext.Provider
      value={{
        state,
        token,
        isAuthenticated: !!token,
        login,
        register,
        resetPassword,
        logout,
        updateUser,
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
        currentLocation
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