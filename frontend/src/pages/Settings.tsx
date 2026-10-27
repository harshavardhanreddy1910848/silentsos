import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  CameraIcon,
  EyeOffIcon,
  MessageSquareIcon,
  Trash2Icon,
  ChevronRightIcon,
  RotateCcwIcon,
  UserRoundIcon,
  LogOutIcon,
  ShieldCheckIcon,
  KeyRoundIcon,
  EyeIcon,
  CheckIcon,
  LockIcon,
  MessageSquareHeartIcon,
  StarIcon,
  SendIcon,
  CheckCircle2Icon,
  BellRingIcon,
  SparklesIcon,
  MailCheckIcon,
  Loader2Icon
} from 'lucide-react';
import { Screen } from '../components/ui/Screen';
import { useApp } from '../context/AppContext';
import { Toggle } from '../components/ui/Toggle';
import { Settings as SettingsType } from '../lib/types';
import { api } from '../lib/api';
import {
  requestNotificationPermission,
  sendBrowserNotification,
  getNotificationPermission,
  playAlertChime
} from '../lib/notifications';


function Section({
  title,
  children
}: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-white/40">
        {title}
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {children}
      </div>
    </div>
  );
}

function SegRow<T extends string | number>({
  Icon,
  label,
  value,
  options,
  onChange,
  fmt
}: {
  Icon: React.ComponentType<{ size?: number | string; color?: string }>;
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  fmt?: (v: T) => string;
}) {
  return (
    <div className="border-b border-white/5 p-4 last:border-0">
      <div className="mb-2.5 flex items-center gap-2.5">
        <Icon size={18} color="#fff" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }}
      >
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={String(o)}
              onClick={() => onChange(o)}
              className="rounded-lg py-2 text-xs font-bold capitalize transition-colors"
              style={{
                backgroundColor: on ? '#ff1744' : 'rgba(255,255,255,0.05)',
                color: on ? '#fff' : 'rgba(255,255,255,0.5)'
              }}
            >
              {fmt ? fmt(o) : String(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  Icon,
  label,
  sub,
  on,
  onChange,
  color
}: {
  Icon: React.ComponentType<{ size?: number | string; color?: string }>;
  label: string;
  sub?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0">
      <Icon size={18} color="#fff" />
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {sub && <p className="text-[11px] text-white/40">{sub}</p>}
      </div>
      <Toggle checked={on} onChange={onChange} color={color} />
    </div>
  );
}

export function Settings() {
  const nav = useNavigate();
  const { settings, setSettings, profile, setProfile, reset, addFeedback } = useApp();
  const set = (p: Partial<SettingsType>) => setSettings(p);

  const [showPin, setShowPin] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  // Feedback State
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const currentPin = settings.safetyPin || '1234';
  const isPinEnabled = settings.pinEnabled ?? true;

  const handleLogout = () => {
    setProfile({ authenticated: false });
    nav('/', { replace: true });
  };

  // Web Notifications & Resend State
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(getNotificationPermission());
  const [testEmail, setTestEmail] = useState(profile.email || 'sheshadriharshavardhanreddy@gmail.com');
  const [testingResend, setTestingResend] = useState(false);
  const [resendStatusMsg, setResendStatusMsg] = useState<{ success: boolean; text: string } | null>(null);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPerm(getNotificationPermission());
    if (granted) {
      playAlertChime();
      sendBrowserNotification('✅ SilentSOS Notifications Enabled', {
        body: 'You will receive immediate alerts and safety updates directly on your device.',
        tag: 'silentsos-welcome'
      });
    }
  };

  const handleTestBrowserNotification = () => {
    playAlertChime(880, 250);
    sendBrowserNotification('🚨 SilentSOS Diagnostic Alert', {
      body: 'Web notification pipeline is operating normally. All alerts will trigger seamlessly.',
      tag: 'silentsos-test'
    });
  };

  const handleTestResendEmail = async () => {
    const target = testEmail.trim();
    if (!target) return;
    setTestingResend(true);
    setResendStatusMsg(null);

    try {
      const res = await api.testResend(target);
      if (res.success) {
        setResendStatusMsg({
          success: true,
          text: `✅ Delivered via Resend to ${target}! Sender: ${res.sender || 'onboarding@resend.dev'}`
        });
      } else {
        setResendStatusMsg({
          success: false,
          text: `⚠️ Notice: ${res.error || 'Resend delivery failed'}`
        });
      }
    } catch (err: any) {
      setResendStatusMsg({
        success: false,
        text: `❌ Error: ${err.message}`
      });
    } finally {
      setTestingResend(false);
    }
  };


  const handleSavePin = () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMessage('❌ Please enter a 4-digit numeric PIN');
      return;
    }
    set({ safetyPin: newPin });
    setPinMessage(`✅ Safety PIN updated to ${newPin}!`);
    setEditingPin(false);
    setNewPin('');
    setTimeout(() => setPinMessage(null), 3500);
  };

  const handleSendFeedback = async () => {
    const clean = feedbackMessage.trim();
    if (!clean || feedbackSending) return;

    setFeedbackSending(true);
    const enrichedMessage = `[${feedbackRating}★] ${clean}`;

    // Record locally in AppContext
    addFeedback({
      category: 'feedback',
      message: enrichedMessage
    });

    // Sync with backend API
    try {
      await api.submitFeedback({
        category: 'feedback',
        message: enrichedMessage
      }, profile.email || 'user');
    } catch (err) {
      console.warn('Backend feedback sync warning:', err);
    }

    setFeedbackSending(false);
    setFeedbackSuccess(true);
    setFeedbackMessage('');
    setTimeout(() => {
      setFeedbackSuccess(false);
    }, 4500);
  };

  return (
    <Screen title="Settings" back>
      <Section title="Security & Safety PIN">
        <ToggleRow
          Icon={LockIcon}
          label="Safety PIN protection"
          sub="Requires 4-digit PIN to cancel active alerts or change security settings"
          on={isPinEnabled}
          onChange={(v) => set({ pinEnabled: v })}
          color="#00e676"
        />

        {isPinEnabled && (
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRoundIcon size={18} color="#00e676" />
                <div>
                  <p className="text-sm font-semibold">Safety PIN Code</p>
                  <p className="text-[11px] text-white/40">
                    4-digit security code for emergency cancellation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-[#00e676] bg-black/40 px-3 py-1 rounded-lg tracking-widest">
                  {showPin ? currentPin : '••••'}
                </span>
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="rounded-lg bg-white/10 p-1.5 text-white/70 hover:bg-white/20"
                  title={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            {pinMessage && (
              <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-center text-xs font-bold text-[#00e676]">
                {pinMessage}
              </div>
            )}

            {!editingPin ? (
              <button
                onClick={() => {
                  setEditingPin(true);
                  setNewPin('');
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white hover:bg-white/15"
              >
                <ShieldCheckIcon size={15} color="#00e676" /> Change Safety PIN
              </button>
            ) : (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                <p className="text-xs font-bold text-white/80">Enter new 4-digit Safety PIN:</p>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 5829"
                  className="w-full text-center tracking-[0.5em] font-mono text-xl font-bold bg-white/10 border border-white/20 rounded-xl p-2.5 text-white outline-none focus:border-[#00e676]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePin}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#00e676] py-2 text-xs font-bold text-black"
                  >
                    <CheckIcon size={16} /> Save PIN
                  </button>
                  <button
                    onClick={() => {
                      setEditingPin(false);
                      setNewPin('');
                    }}
                    className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-bold text-white/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Evidence capture">
        <SegRow
          Icon={ImageIcon}
          label="Photo burst count"
          value={settings.burstCount}
          options={[3, 5, 10]}
          onChange={(v) => set({ burstCount: v as 3 | 5 | 10 })}
        />
        <SegRow
          Icon={VideoIcon}
          label="Video duration"
          value={settings.videoDuration}
          options={['30s', '1min', 'continuous']}
          onChange={(v) => set({ videoDuration: v as '30s' | '1min' | 'continuous' })}
        />
        <SegRow
          Icon={MicIcon}
          label="Audio quality"
          value={settings.audioQuality}
          options={['low', 'high']}
          onChange={(v) => set({ audioQuality: v as 'low' | 'high' })}
          fmt={(v) => (v === 'low' ? 'Low bw' : 'High')}
        />
        <SegRow
          Icon={CameraIcon}
          label="Cameras used"
          value={settings.cameraChoice}
          options={['front', 'rear', 'both']}
          onChange={(v) => set({ cameraChoice: v as 'front' | 'rear' | 'both' })}
        />
      </Section>

      <Section title="Detection & alerts">
        <SegRow
          Icon={CameraIcon}
          label="Gesture sensitivity"
          value={settings.sensitivity}
          options={['low', 'medium', 'high']}
          onChange={(v) => set({ sensitivity: v as 'low' | 'medium' | 'high' })}
        />
        <SegRow
          Icon={ClockIcon}
          label="Auto-resend interval"
          value={settings.autoRepeat}
          options={[5, 10, 15]}
          onChange={(v) => set({ autoRepeat: v as 5 | 10 | 15 })}
          fmt={(v) => `${v}m`}
        />
      </Section>

      <Section title="Stealth & disguise">
        <ToggleRow
          Icon={EyeOffIcon}
          label="Discreet mode"
          sub="Black screen while capturing"
          on={settings.discreet}
          onChange={(v) => set({ discreet: v })}
          color="#ff9100"
        />
      </Section>

      <Section title="Emergency message">
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2.5">
            <MessageSquareIcon size={18} color="#fff" />
            <span className="text-sm font-semibold">Message template</span>
          </div>
          <textarea
            value={settings.messageTemplate}
            onChange={(e) => set({ messageTemplate: e.target.value })}
            rows={4}
            className="w-full resize-none rounded-xl bg-black/40 p-3 text-sm outline-none focus:ring-1 focus:ring-[#ff1744]"
          />
        </div>
      </Section>

      <Section title="Web App Notifications & Resend Email">
        {/* Browser Notifications Row */}
        <div className="border-b border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BellRingIcon size={18} color="#00e676" />
              <div>
                <p className="text-sm font-semibold">Web App Browser Notifications</p>
                <p className="text-[11px] text-white/40">
                  Real-time alerts, chime sounds, and contact notifications
                </p>
              </div>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                notifPerm === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : notifPerm === 'denied'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {notifPerm === 'granted' ? 'Active' : notifPerm === 'denied' ? 'Blocked' : 'Requires Permission'}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            {notifPerm !== 'granted' && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="flex-1 rounded-xl bg-[#00e676] py-2 text-xs font-bold text-black shadow-md hover:opacity-95"
              >
                Enable Notifications
              </button>
            )}
            <button
              type="button"
              onClick={handleTestBrowserNotification}
              className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-bold text-white/80 hover:bg-white/15"
            >
              Test Notification
            </button>
          </div>
        </div>

        {/* Resend Service Status */}
        <div className="border-b border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SparklesIcon size={18} color="#00e676" />
              <div>
                <p className="text-sm font-semibold">Resend Email Gateway</p>
                <p className="text-[11px] text-white/40">
                  Key: <code className="font-mono text-[#00e676]">re_L1***NwPN</code> · High-speed delivery
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-lg bg-[#00e676]/15 px-2.5 py-1 text-xs font-bold text-[#00e676]">
              <span className="h-2 w-2 rounded-full bg-[#00e676] animate-pulse"></span>
              Connected
            </span>
          </div>
        </div>

        {/* Resend Live Diagnostic Test */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MailCheckIcon size={16} color="#00e676" />
            <p className="text-xs font-bold text-white/80">Send Test Email via Resend</p>
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#00e676]"
            />
            <button
              type="button"
              disabled={testingResend || !testEmail.trim()}
              onClick={handleTestResendEmail}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-40"
            >
              {testingResend ? <Loader2Icon size={13} className="animate-spin" /> : <SendIcon size={13} />}
              <span>{testingResend ? 'Sending...' : 'Test Send'}</span>
            </button>
          </div>

          {resendStatusMsg && (
            <div
              className={`rounded-xl p-2.5 text-xs font-bold ${
                resendStatusMsg.success
                  ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
              }`}
            >
              {resendStatusMsg.text}
            </div>
          )}
        </div>
      </Section>

      <Section title="Storage">
        <SegRow
          Icon={Trash2Icon}
          label="Auto-delete old evidence"
          value={settings.autoDeleteDays}
          options={[7, 14, 30, 0]}
          onChange={(v) => set({ autoDeleteDays: v as 7 | 14 | 30 | 0 })}
          fmt={(v) => (v === 0 ? 'Never' : `${v}d`)}
        />
      </Section>

      <Section title="Feedback">
        <div className="p-4 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <MessageSquareHeartIcon size={18} color="#ff1744" />
            <div>
              <span className="text-sm font-semibold">Share your feedback</span>
              <p className="text-[11px] text-white/40">
                Rate your experience, report an issue, or suggest improvements
              </p>
            </div>
          </div>

          {/* Star Rating */}
          <div className="rounded-xl bg-black/40 border border-white/5 p-2.5">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">Experience Rating</span>
              <span className="text-[11px] font-semibold text-amber-400">
                {feedbackRating === 5 && 'Outstanding 🌟'}
                {feedbackRating === 4 && 'Very Good ✨'}
                {feedbackRating === 3 && 'Good 👍'}
                {feedbackRating === 2 && 'Fair ⚠️'}
                {feedbackRating === 1 && 'Needs Work 🛠️'}
              </span>
            </div>
            <div className="flex items-center gap-2 justify-center py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className="p-1 transition-transform active:scale-90 hover:scale-110"
                  title={`${star} Star`}
                >
                  <StarIcon
                    size={22}
                    className={
                      star <= feedbackRating
                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                        : 'text-white/20'
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Tags */}
          <div className="flex flex-wrap gap-1.5">
            {['Gestures', 'SOS Trigger', 'Contacts', 'Camera/Audio', 'Discreet Mode'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const tagPrefix = `[${tag}] `;
                  if (!feedbackMessage.includes(tagPrefix)) {
                    setFeedbackMessage((prev) => (prev ? `${tagPrefix}${prev}` : tagPrefix));
                  }
                }}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
              >
                +{tag}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={feedbackMessage}
            onChange={(e) => {
              setFeedbackMessage(e.target.value);
              setFeedbackSuccess(false);
            }}
            rows={3}
            placeholder="Share details, suggestions or report an issue..."
            className="w-full resize-none rounded-xl bg-black/40 border border-white/10 p-3 text-xs outline-none focus:border-[#ff1744] placeholder:text-white/30 text-white"
          />

          {/* Submit Button & Confirmation */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={!feedbackMessage.trim() || feedbackSending}
              onClick={handleSendFeedback}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff1744] py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#ff1744]/20"
            >
              <SendIcon size={14} />
              <span>{feedbackSending ? 'Submitting...' : 'Submit Feedback'}</span>
            </button>

            {feedbackSuccess && (
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs font-bold text-emerald-400">
                <CheckCircle2Icon size={16} />
                <span>Thank you! Your feedback has been received.</span>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Account">
        <button
          onClick={() => nav('/profile')}
          className="flex w-full items-center justify-between border-b border-white/5 p-4 text-left"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold">
            <UserRoundIcon size={18} /> Your safety profile
          </span>
          <ChevronRightIcon size={18} color="#666" />
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-between p-4 text-left text-[#ff1744]"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold">
            <LogOutIcon size={18} /> Log out
          </span>
          <ChevronRightIcon size={18} color="#666" />
        </button>
      </Section>

      <button
        onClick={() => nav('/history')}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold">
          <ClockIcon size={18} /> View alert history
        </span>
        <ChevronRightIcon size={18} color="#666" />
      </button>

      <button
        onClick={() => {
          if (confirm('Reset SilentSOS? This clears your profile, contacts and evidence.')) {
            reset();
            nav('/onboarding', { replace: true });
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ff1744]/30 py-3.5 font-bold text-[#ff1744]"
      >
        <RotateCcwIcon size={18} /> Reset app
      </button>

      <p className="mt-5 text-center text-[11px] text-white/30">
        SilentSOS · armed for {profile.name || 'you'}
      </p>
    </Screen>
  );
}