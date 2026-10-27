export type GestureType =
  | 'volume-hold'
  | 'triple-tap'
  | 'shake'
  | 'power-pattern'
  | 'camera-gesture'
  | 'voice-mode'
  | 'sos-button';

export type AlertType = 'sos' | 'medical' | 'fire' | 'police' | 'danger';

export type AlertStatus = 'sent' | 'cancelled' | 'failed' | 'partial' | 'active';

export type SendState = 'queued' | 'sending' | 'sent' | 'failed';

export interface Permissions {
  camera: boolean;
  microphone: boolean;
  location: boolean;
  storage: boolean;
}

export interface ContactPrefs {
  gps: boolean;
  photos: boolean;
  video: boolean;
  audio: boolean;
  message: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  prefs: ContactPrefs;
}

export type UserRole = 'user';

export interface Profile {
  name: string;
  email: string;
  address?: string;
  parentsName?: string;
  bloodGroup?: string;
  createdAt: number | null;
  role: UserRole;
  gesture: GestureType;
  selectedGestures?: GestureType[];
  permissions: Permissions;
  authenticated: boolean;
  onboarded: boolean;
}

export interface FeedbackEntry {
  id: string;
  category: 'feedback' | 'bug' | 'help';
  message: string;
  createdAt: number;
  status: 'open' | 'resolved';
}

export interface CaptureToggles {
  photos: boolean;
  video: boolean;
  audio: boolean;
}

export interface Settings {
  sensitivity: 'low' | 'medium' | 'high';
  autoRepeat: 5 | 10 | 15;
  burstCount: 3 | 5 | 10;
  videoDuration: '30s' | '1min' | 'continuous';
  audioQuality: 'low' | 'high';
  cameraChoice: 'front' | 'rear' | 'both';
  discreet: boolean;
  messageTemplate: string;
  autoDeleteDays: 7 | 14 | 30 | 0;
  safetyPin?: string;
  pinEnabled?: boolean;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  t: number; // timestamp
}

export interface ContactDelivery {
  contactId: string;
  contactName: string;
  gps: SendState;
  photos: SendState;
  video: SendState;
  audio: SendState;
  message: SendState;
  acknowledged: boolean;
}

export interface AlertRecord {
  id: string;
  type: AlertType;
  startedAt: number;
  endedAt: number | null;
  status: AlertStatus;
  gpsPath: GpsPoint[];
  photoCount: number;
  videoCount: number;
  audioCount: number;
  deliveries: ContactDelivery[];
  photoDataUrl?: string;
  photoDataUrls?: string[];
  videoDataUrl?: string;
  audioDataUrl?: string;
  triggerGesture?: string;
}