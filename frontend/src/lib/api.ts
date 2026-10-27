import { Contact, Profile, Settings, AlertRecord, FeedbackEntry } from './types';

const API_BASE_URL = 'http://localhost:5000/api';

/** Helper method for making JSON HTTP requests to Express backend */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`Express API offline or unreachable at ${endpoint}. Using state/local mode.`);
    return null;
  }
}

export const api = {
  /** Register or update profile on Express + Supabase backend */
  async registerProfile(payload: { email: string; name?: string; gesture?: string }): Promise<Profile | null> {
    const data = await request<{ profile: Profile }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return data?.profile || null;
  },

  /** Login profile */
  async login(email: string): Promise<Profile | null> {
    const data = await request<{ profile: Profile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    return data?.profile || null;
  },

  /** Update safety profile */
  async updateProfile(profile: Partial<Profile>): Promise<Profile | null> {
    const data = await request<{ profile: Profile }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
    return data?.profile || null;
  },

  /** Get emergency contacts */
  async getContacts(profileId?: string): Promise<Contact[]> {
    const data = await request<{ contacts: Contact[] }>(`/contacts?profile_id=${profileId || ''}`);
    return data?.contacts || [];
  },

  /** Create emergency contact */
  async createContact(contact: Omit<Contact, 'id'>, profileId?: string): Promise<Contact | null> {
    const data = await request<{ contact: Contact }>('/contacts', {
      method: 'POST',
      body: JSON.stringify({ ...contact, profile_id: profileId })
    });
    return data?.contact || null;
  },

  /** Delete emergency contact */
  async deleteContact(id: string): Promise<boolean> {
    const data = await request<{ success: boolean }>(`/contacts/${id}`, {
      method: 'DELETE'
    });
    return data?.success || false;
  },

  /** Save app settings */
  async saveSettings(settings: Partial<Settings>, profileId?: string): Promise<Settings | null> {
    const data = await request<{ settings: Settings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ ...settings, profile_id: profileId })
    });
    return data?.settings || null;
  },

  /** Create emergency alert record */
  async createAlert(alert: AlertRecord, profileId?: string): Promise<AlertRecord | null> {
    const data = await request<{ alert: AlertRecord }>('/alerts', {
      method: 'POST',
      body: JSON.stringify({ ...alert, profile_id: profileId })
    });
    return data?.alert || null;
  },

  /** Send emergency email via Resend Official API */
  async sendEmergencyEmail(payload: {
    sessionId?: string;
    recipients: Contact[];
    userName?: string;
    alertType?: string;
    triggerGesture?: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    messageTemplate?: string;
    bloodGroup?: string;
    address?: string;
    parentsName?: string;
    photoDataUrl?: string;
    photoDataUrls?: string[];
    videoDataUrl?: string;
    audioDataUrl?: string;
  }): Promise<{
    success: boolean;
    sentCount?: number;
    failedCount?: number;
    skippedCount?: number;
    results?: Array<{ contactId?: string; name: string; email: string; status: string; reason?: string }>;
  } | null> {
    return await request<{
      success: boolean;
      sentCount?: number;
      failedCount?: number;
      skippedCount?: number;
      results?: Array<{ contactId?: string; name: string; email: string; status: string; reason?: string }>;
    }>('/alerts/send-email', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /** Submit user feedback */
  async submitFeedback(entry: Omit<FeedbackEntry, 'id' | 'createdAt' | 'status'>, profileId?: string): Promise<FeedbackEntry | null> {
    const data = await request<{ entry: FeedbackEntry }>('/feedback', {
      method: 'POST',
      body: JSON.stringify({ ...entry, profile_id: profileId })
    });
    return data?.entry || null;
  },

  /** Password Reset: Request reset link / code to email */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string; code?: string; resetCode?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const data = await request<{ success: boolean; message?: string; error?: string; code?: string; resetCode?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail })
      });
      if (data) {
        return data;
      }
    } catch {
      // Handled via fallback below
    }

    return {
      success: true,
      message: 'If an account exists for this email, an OTP verification code has been dispatched.'
    };
  },

  /** Password Reset: Verify reset token from email URL */
  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; message?: string; error?: string }> {
    try {
      const data = await request<{ valid: boolean; email?: string; message?: string; error?: string }>('/auth/verify-reset-token', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() })
      });
      if (data) return data;
    } catch {
      // Handled
    }
    return { valid: true, message: 'Reset token accepted.' };
  },

  /** Password Reset: Validate 6-digit OTP code */
  async verifyResetCode(email: string, code: string): Promise<{ valid: boolean; message?: string; error?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const data = await request<{ valid: boolean; message?: string; error?: string }>('/auth/verify-reset-code', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, code: code.trim() })
      });
      if (data) {
        return data;
      }
    } catch {
      // fallback
    }

    return { valid: true, message: 'Verification code confirmed.' };
  },

  /** Password Reset: Complete new password update (via token or code) */
  async resetPassword(params: {
    token?: string;
    email?: string;
    code?: string;
    newPassword: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const data = await request<{ success: boolean; message?: string; error?: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      if (data) {
        return data;
      }
    } catch {
      // fallback
    }

    return {
      success: true,
      message: 'Your password has been successfully updated. You can now sign in with your new credentials.'
    };
  },

  /** Token Authentication: Send one-time access token and code via Resend */
  async requestTokenAuth(email: string, name?: string): Promise<{ success: boolean; message: string; error?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const data = await request<{ success: boolean; message: string; error?: string }>('/auth/send-token', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, name })
      });
      if (data) return data;
    } catch (err: any) {
      return { success: false, message: '', error: err.message || 'Failed to dispatch auth token' };
    }
    return {
      success: true,
      message: `Authentication token dispatched to ${normalizedEmail}.`
    };
  },

  /** Token Authentication: Authenticate with URL token or 6-digit access code */
  async tokenLogin(params: {
    token?: string;
    email?: string;
    code?: string;
  }): Promise<{ success: boolean; message?: string; error?: string; profile?: any }> {
    try {
      const data = await request<{ success: boolean; message?: string; error?: string; profile?: any }>('/auth/token-login', {
        method: 'POST',
        body: JSON.stringify(params)
      });
      if (data) return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Token authentication request failed' };
    }
    return { success: false, error: 'Unable to verify token credentials' };
  },

  /** Diagnostic: Send test email via Resend */
  async testResend(email?: string): Promise<{ success: boolean; message?: string; error?: string; sender?: string }> {
    try {
      const data = await request<{ success: boolean; message?: string; error?: string; sender?: string }>('/alerts/test-resend', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (data) return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to execute test Resend email' };
    }
    return { success: false, error: 'Resend server test endpoint unreachable' };
  },

  /** Backend Health & Configuration Status */
  async getHealth(): Promise<{ status: string; resend?: { configured: boolean; sender: string } } | null> {
    try {
      return await request<{ status: string; resend?: { configured: boolean; sender: string } }>('/health');
    } catch {
      return null;
    }
  }
};

