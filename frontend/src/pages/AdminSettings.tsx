import React, { useState, useEffect } from 'react';
import { useApp, API_BASE } from '../AppContext';
import { 
  Settings, 
  User, 
  Mail, 
  Lock, 
  CheckCircle2, 
  FileText
} from 'lucide-react';

export function AdminSettings() {
  const { token, state, updateUser } = useApp();
  
  // Profile settings state
  const [profileName, setProfileName] = useState(state.userName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Global settings state
  const [globalEmails, setGlobalEmails] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [gestureSensitivity, setGestureSensitivity] = useState('Medium');
  const [autoRepeatInterval, setAutoRepeatInterval] = useState(5);
  const [photoBurstCount, setPhotoBurstCount] = useState(5);
  const [videoDuration, setVideoDuration] = useState('1min');
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Sync state name on startup
  useEffect(() => {
    if (state.userName) {
      setProfileName(state.userName);
    }
  }, [state.userName]);

  // Load global settings
  const fetchGlobalSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalEmails(data.globalEmergencyEmails || '');
        setMessageTemplate(data.messageTemplate || '');
        setGestureSensitivity(data.gestureSensitivity || 'Medium');
        setAutoRepeatInterval(data.autoRepeatInterval || 5);
        setPhotoBurstCount(data.photoBurstCount || 5);
        setVideoDuration(data.videoDuration || '1min');
      }
    } catch (err) {
      console.error('Failed to load global settings', err);
    }
  };

  useEffect(() => {
    fetchGlobalSettings();
  }, [token]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);
    setProfileError(null);

    if (newPassword && newPassword !== confirmPassword) {
      setProfileError('Passwords do not match');
      return;
    }

    setProfileSaving(true);
    try {
      const payload: any = { name: profileName };
      if (newPassword) {
        payload.password = newPassword;
      }

      const res = await fetch(`${API_BASE}/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile settings');
      }

      // Update name in local state
      updateUser(profileName);
      setNewPassword('');
      setConfirmPassword('');
      setProfileSuccess(true);
    } catch (err: any) {
      setProfileError(err.message || 'Error occurred while saving profile settings');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess(false);
    setSettingsError(null);
    setSettingsSaving(true);

    try {
      const payload = {
        globalEmergencyEmails: globalEmails,
        messageTemplate,
        gestureSensitivity,
        autoRepeatInterval,
        photoBurstCount,
        videoDuration
      };

      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setSettingsSuccess(true);
    } catch (err: any) {
      setSettingsError(err.message || 'Error occurred while saving global configurations');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">System Configuration</h1>
        <p className="text-sm text-textMuted mt-1">Configure default thresholds, templates, routing receivers, and administrator access profile</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Management Section */}
        <div className="lg:col-span-1 bg-surface/40 border border-surfaceHighlight rounded-3xl p-6 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-emergency" />
            <h3 className="font-extrabold text-lg">Admin Profile Settings</h3>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileSuccess && (
              <div className="p-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs rounded-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Profile updated successfully.
              </div>
            )}
            
            {profileError && (
              <div className="p-3 bg-emergency/15 text-emergency border border-emergency/20 text-xs rounded-xl font-medium">
                {profileError}
              </div>
            )}

            {/* Display Name */}
            <div>
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">Admin Display Name</label>
              <input 
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">Change Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textMuted">
                  <Lock className="w-4 h-4" />
                </div>
                <input 
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain placeholder-textMuted outline-none transition-all"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textMuted">
                  <Lock className="w-4 h-4" />
                </div>
                <input 
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain placeholder-textMuted outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full py-3 bg-emergency hover:bg-emergencyHover text-white rounded-xl font-bold text-xs shadow-lg shadow-emergency/15 transition-all flex justify-center items-center gap-1.5 disabled:opacity-50"
            >
              {profileSaving ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Global Settings Section */}
        <div className="lg:col-span-2 bg-surface/40 border border-surfaceHighlight rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-emergency" />
            <h3 className="font-extrabold text-lg">System-wide Settings</h3>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-6">
            {settingsSuccess && (
              <div className="p-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs rounded-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Global settings saved successfully.
              </div>
            )}
            
            {settingsError && (
              <div className="p-3 bg-emergency/15 text-emergency border border-emergency/20 text-xs rounded-xl font-medium">
                {settingsError}
              </div>
            )}

            {/* Global Emergency email recipient config */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-emergency" />
                Global Emergency Email Recipients
              </label>
              <p className="text-xs text-textMuted">
                All alerts triggered by ANY user will automatically be carbon-copied to these email addresses in real-time. Use commas to separate multiple emails.
              </p>
              <input 
                type="text"
                value={globalEmails}
                onChange={(e) => setGlobalEmails(e.target.value)}
                placeholder="safety-response@agency.org, archive-sos@silentsos.org"
                className="w-full px-3.5 py-3 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain placeholder-textMuted outline-none transition-all font-mono"
              />
            </div>

            {/* Message template config */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emergency" />
                Default Alert Email Message Template
              </label>
              <p className="text-xs text-textMuted">
                Configure template wording using dynamic tags like {"{name}"}, {"{time}"}, {"{type}"}, or {"{gps_link}"}.
              </p>
              <textarea 
                rows={4}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full px-3.5 py-3 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-surfaceHighlight/50 pt-6">
              
              {/* Photo Burst Count */}
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">Default Photo Burst Count</label>
                <select
                  value={photoBurstCount}
                  onChange={(e) => setPhotoBurstCount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
                >
                  <option value={3}>3 Photos</option>
                  <option value={5}>5 Photos</option>
                  <option value={10}>10 Photos</option>
                </select>
              </div>

              {/* Video Recording Duration */}
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">Default Video Clip Length</label>
                <select
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
                >
                  <option value="30s">30 Seconds</option>
                  <option value="1min">1 Minute</option>
                  <option value="continuous">Continuous Feed</option>
                </select>
              </div>

              {/* Gesture Sensitivity */}
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">Gesture Detection Sensitivity</label>
                <select
                  value={gestureSensitivity}
                  onChange={(e) => setGestureSensitivity(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
                >
                  <option value="Low">Low Sensitivity</option>
                  <option value="Medium">Medium Sensitivity</option>
                  <option value="High">High Sensitivity</option>
                </select>
              </div>

              {/* Auto repeat interval */}
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2">Location Update Repeat Interval</label>
                <select
                  value={autoRepeatInterval}
                  onChange={(e) => setAutoRepeatInterval(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
                >
                  <option value={5}>Every 5 minutes</option>
                  <option value={10}>Every 10 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                </select>
              </div>

            </div>

            <div className="border-t border-surfaceHighlight/50 pt-6">
              <button
                type="submit"
                disabled={settingsSaving}
                className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {settingsSaving ? 'Saving Configurations...' : 'Save Global Configurations'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
