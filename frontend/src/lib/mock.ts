import { AlertType } from './types';

// A believable starting coordinate (Mumbai) that we jitter over time.
export const BASE_COORD = { lat: 19.076, lng: 72.8777 };

export function jitterCoord(from: {lat: number;lng: number;}) {
  return {
    lat: from.lat + (Math.random() - 0.5) * 0.0009,
    lng: from.lng + (Math.random() - 0.5) * 0.0009
  };
}

export function fmtCoord(lat: number, lng: number) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}

export function mapsLink(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const ALERT_META: Record<
  AlertType,
  {label: string;emoji: string;color: string;short: string;emergencyNumber: string;numberLabel: string;}> =
{
  sos: { label: 'Emergency SOS', emoji: '🚨', color: '#ff1744', short: 'SOS', emergencyNumber: '112', numberLabel: 'Emergency Helpline' },
  medical: { label: 'Medical Emergency', emoji: '🚑', color: '#00e676', short: 'Medical', emergencyNumber: '108', numberLabel: 'Ambulance' },
  fire: { label: 'Fire Emergency', emoji: '🚒', color: '#ff9100', short: 'Fire', emergencyNumber: '1905', numberLabel: 'Fire Station' },
  police: { label: 'Police Assistance', emoji: '🚔', color: '#2979ff', short: 'Police', emergencyNumber: '100', numberLabel: 'Police' },
  danger: { label: 'Personal Danger', emoji: '⚠️', color: '#ff1744', short: 'Danger', emergencyNumber: '100', numberLabel: 'Police' }
};

export function fmtTime(t: number) {
  return new Date(t).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function fmtClock(t: number) {
  return new Date(t).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, '0')}s`;
}