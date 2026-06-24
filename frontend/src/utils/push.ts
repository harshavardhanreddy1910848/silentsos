import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export async function initPushNotifications(authToken: string | null) {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Push notifications are only supported on native platforms.');
    return;
  }

  if (!authToken) {
    console.log('[Push] User not authenticated. Skipping registration.');
    return;
  }

  try {
    // Request permission to use push notifications
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] User denied permissions for push notifications.');
      return;
    }

    // Register with Google FCM to receive push notifications
    await PushNotifications.register();

    // On success, receive FCM device token
    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Registration token:', token.value);
      
      // OPTIONAL: Send FCM device token to the backend API to target this device specifically
      // In the future, we can invoke fetch(`${API_BASE}/user/device-token`, { method: 'POST', ... })
    });

    // Some registration error occurred
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error.error);
    });

    // Show us the notification alert if the app is currently open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Push received:', notification);
      alert(`🚨 SilentSOS Update: ${notification.title}\n${notification.body}`);
    });

    // Handle tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Push action performed:', action);
    });

  } catch (e) {
    console.error('[Push] Failed to initialize push notifications:', e);
  }
}
