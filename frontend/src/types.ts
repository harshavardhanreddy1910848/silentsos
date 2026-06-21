export type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferences: {
    gps: boolean;
    photos: boolean;
    video: boolean;
    audio: boolean;
    message: boolean;
  };
};

export type Settings = {
  gestureSensitivity: 'Low' | 'Medium' | 'High';
  autoRepeatInterval: 5 | 10 | 15;
  photoBurstCount: 3 | 5 | 10;
  videoDuration: '30s' | '1min' | 'continuous';
  audioQuality: 'low' | 'high';
  cameraPreference: 'front' | 'rear' | 'both';
  fakeCallDisguise: boolean;
  stealthMode: boolean;
  messageTemplate: string;
  safetyPin: string;
  autoDeleteDays: number;
};

export type AlertEvent = {
  id: string;
  timestamp: number;
  type: string;
  durationSeconds: number;
  status: 'Sent' | 'Cancelled' | 'Failed' | 'Partial';
  evidence: {
    photos: number;
    videos: number;
    audio: number;
    files?: {
      type: 'photo' | 'video' | 'audio';
      url: string;
      timestamp: number;
    }[];
  };
  contactsNotified: {
    contactId: string;
    status: 'Sent' | 'Failed' | 'Partial';
  }[];
  gpsPath: {lat: number;lng: number;timestamp: number;}[];
};

export type AppState = {
  isSetupComplete: boolean;
  userName: string;
  userRole?: 'user' | 'admin';
  contacts: Contact[];
  settings: Settings;
  history: AlertEvent[];
  activeAlert: {
    isActive: boolean;
    isCountingDown: boolean;
    startTime: number | null;
    type: string | null;
    id?: string;
    contactsNotified?: any[];
  } | null;
};