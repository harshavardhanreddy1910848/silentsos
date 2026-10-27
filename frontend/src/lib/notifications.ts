/**
 * Web App Browser Notifications & Audio Chime Helper
 * Integrates HTML5 Notification API for SilentSOS Emergency Alerts
 */

/**
 * Check if browser notifications are supported
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current browser notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('Browser notifications are not supported on this platform.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Dispatch an in-browser desktop notification
 */
export function sendBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!isNotificationSupported()) return null;

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        silent: false,
        ...options
      });

      // Focus window when notification is clicked
      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return notif;
    } catch (err) {
      console.warn('Notification instantiation warning:', err);
      return null;
    }
  }

  return null;
}

/**
 * Play alert audio chime via Web Audio API (no external file dependency)
 */
export function playAlertChime(frequency = 880, durationMs = 300) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, ctx.currentTime + durationMs / 1000);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Non-blocking if audio context is restricted
  }
}

/**
 * Convenience helper to dispatch an SOS alert notification
 */
export function notifyEmergencyDispatched(params: {
  userName: string;
  recipientCount: number;
  alertType?: string;
}) {
  playAlertChime(950, 400);

  sendBrowserNotification('🚨 SilentSOS Emergency Alert Dispatched', {
    body: `Emergency signal for ${params.userName} was broadcast to ${params.recipientCount} contact(s) via Resend.`,
    tag: 'silentsos-emergency-active',
    requireInteraction: true
  });
}
