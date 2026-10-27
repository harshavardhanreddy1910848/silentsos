export type GestureType =
  | 'volume-hold'
  | 'triple-tap'
  | 'shake'
  | 'power-pattern'
  | 'camera-gesture'
  | 'voice-mode';

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

export interface DbProfile {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  address?: string;
  parents_name?: string;
  parentsName?: string;
  blood_group?: string;
  bloodGroup?: string;
  role: string;
  gesture: GestureType;
  permissions: Permissions;
  authenticated: boolean;
  onboarded: boolean;
  created_at?: string;
}

export interface DbContact {
  id: string;
  profile_id: string;
  name: string;
  phone: string;
  email: string;
  prefs: ContactPrefs;
  created_at?: string;
}

export interface DbSettings {
  id: string;
  profile_id: string;
  sensitivity: 'low' | 'medium' | 'high';
  auto_repeat: number;
  burst_count: number;
  video_duration: string;
  audio_quality: string;
  camera_choice: string;
  discreet: boolean;
  message_template: string;
  auto_delete_days: number;
}

export interface DbAlert {
  id: string;
  profile_id: string;
  type: AlertType;
  started_at: string;
  ended_at?: string | null;
  status: AlertStatus;
  gps_path: any[];
  photo_count: number;
  video_count: number;
  audio_count: number;
  deliveries: any[];
}

export interface DbFeedback {
  id: string;
  profile_id?: string;
  category: string;
  message: string;
  status: 'open' | 'resolved';
  created_at?: string;
}
