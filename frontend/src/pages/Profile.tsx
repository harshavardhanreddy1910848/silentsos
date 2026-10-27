import { useMemo, useState } from 'react';
import {
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  DropletIcon,
  Edit3Icon,
  HardDriveIcon,
  HomeIcon,
  ImageIcon,
  LockKeyholeIcon,
  MailIcon,
  MapPinIcon,
  MicIcon,
  PhoneIcon,
  SaveIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
  XIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/ui/Screen';
import { useApp } from '../context/AppContext';
import { fmtTime } from '../lib/mock';
import { api } from '../lib/api';

const GESTURE_LABELS: Record<string, string> = {
  'triple-tap': 'Triple tap',
  shake: 'Shake device',
  'volume-hold': 'Volume hold',
  'power-pattern': 'Power pattern',
  'camera-gesture': 'Camera gesture',
  'voice-mode': 'Voice Mode (Say "help")',
  'sos-button': 'SOS Emergency Button'
};

const COMMON_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function Profile() {
  const nav = useNavigate();
  const { profile, contacts, history, capture, setProfile } = useApp();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name || '');
  const [address, setAddress] = useState(profile.address || '');
  const [parentsName, setParentsName] = useState(profile.parentsName || '');
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const evidenceCount = useMemo(
    () => history.reduce((total, alert) => total + alert.photoCount + alert.videoCount + alert.audioCount, 0),
    [history]
  );

  const startEditing = () => {
    setName(profile.name || '');
    setAddress(profile.address || '');
    setParentsName(profile.parentsName || '');
    setBloodGroup(profile.bloodGroup || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setName(profile.name || '');
    setAddress(profile.address || '');
    setParentsName(profile.parentsName || '');
    setBloodGroup(profile.bloodGroup || '');
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    const safeName = name.trim() || profile.name || 'SilentSOS User';
    const safeAddress = address.trim();
    const safeParents = parentsName.trim();
    const safeBlood = bloodGroup.trim().toUpperCase();

    const payload = {
      name: safeName,
      address: safeAddress,
      parentsName: safeParents,
      bloodGroup: safeBlood
    };

    // Update in local state
    setProfile(payload);

    // Sync to Express / Supabase backend if online
    if (profile.email) {
      try {
        await api.updateProfile({
          email: profile.email,
          ...payload
        });
      } catch (err) {
        console.warn('Backend profile sync deferred; local update persisted.', err);
      }
    }

    setSaving(false);
    setEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const joined = profile.createdAt ? fmtTime(profile.createdAt) : 'Created on this device';

  return (
    <Screen title="Your safety profile" back>
      {/* Toast Alert on successful profile save */}
      {saveSuccess && (
        <div
          id="profile-save-success-banner"
          className="mb-4 flex items-center gap-2.5 rounded-2xl border border-[#00e676]/30 bg-[#00e676]/10 p-3.5 text-xs font-bold text-[#00e676] shadow-[0_0_20px_rgba(0,230,118,0.15)] animate-in fade-in slide-in-from-top duration-300"
        >
          <CheckIcon size={16} className="shrink-0" />
          <span>Safety profile, parents contact, and medical info saved successfully!</span>
        </div>
      )}

      {/* Main Profile Header Card */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff1744] to-[#b71c1c] text-2xl font-black text-white shadow-[0_0_28px_rgba(255,23,68,0.35)]">
            {(profile.name || 'S').slice(0, 1).toUpperCase()}
            {profile.bloodGroup && (
              <span
                title={`Blood Group: ${profile.bloodGroup}`}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-black bg-white text-[10px] font-black text-[#ff1744] shadow-md"
              >
                {profile.bloodGroup.slice(0, 3)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h1 className="truncate text-xl font-black tracking-tight text-white">
                {profile.name || 'SilentSOS user'}
              </h1>
              {!editing && (
                <button
                  id="btn-edit-profile-header"
                  onClick={startEditing}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Edit Profile"
                >
                  <Edit3Icon size={14} />
                  <span>Edit</span>
                </button>
              )}
            </div>

            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/50">
              <MailIcon size={14} className="shrink-0" />
              <span className="truncate">{profile.email || 'No email saved'}</span>
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-md bg-[#00e676]/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#00e676]">
                <ShieldCheckIcon size={12} /> Active
              </span>

              {profile.bloodGroup && (
                <span
                  id="badge-profile-blood-group"
                  className="flex items-center gap-1 rounded-md border border-[#ff1744]/30 bg-[#ff1744]/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#ff5252]"
                >
                  <DropletIcon size={11} /> {profile.bloodGroup}
                </span>
              )}

              {profile.parentsName && (
                <span
                  id="badge-profile-parents-name"
                  className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70"
                >
                  <UsersIcon size={11} /> {profile.parentsName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/45">
          <CalendarIcon size={14} /> {joined}
        </div>
      </section>

      {/* Editing Form when active */}
      {editing ? (
        <section
          id="profile-edit-section"
          className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#ff1744]/30 bg-[#ff1744]/[0.03] p-5 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="text-base font-black text-white">Edit Profile & Emergency Details</h2>
              <p className="text-xs text-white/50">These details assist responders and contacts in emergencies</p>
            </div>
            <button
              onClick={cancelEditing}
              className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Cancel editing"
            >
              <XIcon size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="input-profile-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/70">
                <UserIcon size={14} className="text-[#ff1744]" /> Your Full Name
              </label>
              <input
                id="input-profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm font-medium text-white placeholder-white/30 outline-none transition-all focus:border-[#ff1744] focus:ring-1 focus:ring-[#ff1744]"
              />
            </div>

            {/* Blood Group */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="input-profile-blood-group" className="flex items-center gap-1.5 text-xs font-bold text-white/70">
                  <DropletIcon size={14} className="text-[#ff1744]" /> Blood Group (Emergency Medical)
                </label>
                {bloodGroup && (
                  <span className="text-[11px] font-black text-[#ff5252]">Selected: {bloodGroup}</span>
                )}
              </div>

              {/* Quick Select Buttons */}
              <div className="mb-2 grid grid-cols-4 gap-1.5">
                {COMMON_BLOOD_GROUPS.map((bg) => {
                  const isSelected = bloodGroup.toUpperCase() === bg;
                  return (
                    <button
                      key={bg}
                      type="button"
                      id={`btn-select-blood-${bg.replace('+', 'pos').replace('-', 'neg')}`}
                      onClick={() => setBloodGroup(bg)}
                      className={`rounded-lg py-1.5 text-xs font-black transition-all ${
                        isSelected
                          ? 'border border-[#ff1744] bg-[#ff1744] text-white shadow-[0_0_12px_rgba(255,23,68,0.4)]'
                          : 'border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {bg}
                    </button>
                  );
                })}
              </div>

              {/* Manual/custom input */}
              <input
                id="input-profile-blood-group"
                type="text"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value.toUpperCase())}
                placeholder="Or type custom blood group (e.g., O+, A-, B+)"
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2 text-sm font-medium text-white placeholder-white/30 outline-none transition-all focus:border-[#ff1744] focus:ring-1 focus:ring-[#ff1744]"
              />
            </div>

            {/* Parents Name */}
            <div>
              <label htmlFor="input-profile-parents-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/70">
                <UsersIcon size={14} className="text-[#00e676]" /> Parents / Guardian Name
              </label>
              <input
                id="input-profile-parents-name"
                type="text"
                value={parentsName}
                onChange={(e) => setParentsName(e.target.value)}
                placeholder="e.g. Robert & Sarah Doe (Parents)"
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm font-medium text-white placeholder-white/30 outline-none transition-all focus:border-[#00e676] focus:ring-1 focus:ring-[#00e676]"
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="input-profile-address" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/70">
                <HomeIcon size={14} className="text-[#ff9100]" /> Residential / Emergency Address
              </label>
              <textarea
                id="input-profile-address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 104 Willow Creek Rd, Apt 3B, New York, NY 10001"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm font-medium text-white placeholder-white/30 outline-none transition-all focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                id="btn-save-profile"
                disabled={saving}
                onClick={save}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00e676] to-[#00c853] py-3 text-sm font-black text-black shadow-[0_0_20px_rgba(0,230,118,0.25)] transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                <SaveIcon size={16} />
                <span>{saving ? 'Saving...' : 'Save details'}</span>
              </button>

              <button
                type="button"
                id="btn-cancel-profile"
                onClick={cancelEditing}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Emergency & Medical Information Card (Read View) */
        <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <DropletIcon size={16} className="text-[#ff1744]" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white/80">
                Emergency & Medical Information
              </h2>
            </div>
            <button
              id="btn-edit-medical-info"
              onClick={startEditing}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#ff1744] hover:bg-[#ff1744]/10"
            >
              <Edit3Icon size={13} />
              <span>Update</span>
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {/* Blood Group */}
            <div className="flex items-center gap-3.5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ff1744]/30 bg-[#ff1744]/10 text-[#ff1744]">
                <DropletIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">Blood Group</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {profile.bloodGroup ? (
                    <span
                      id="display-profile-blood-group"
                      className="rounded-lg border border-[#ff1744]/40 bg-[#ff1744]/20 px-2.5 py-0.5 text-sm font-black text-[#ff5252]"
                    >
                      {profile.bloodGroup}
                    </span>
                  ) : (
                    <span id="display-profile-blood-group" className="text-sm font-medium italic text-white/40">
                      Not specified — tap update to set
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Parents Name */}
            <div className="flex items-center gap-3.5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00e676]/30 bg-[#00e676]/10 text-[#00e676]">
                <UsersIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">Parents / Guardian</p>
                <p id="display-profile-parents-name" className="mt-0.5 text-sm font-bold text-white">
                  {profile.parentsName || (
                    <span className="font-medium italic text-white/40">Not specified — tap update to set</span>
                  )}
                </p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3.5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ff9100]/30 bg-[#ff9100]/10 text-[#ff9100]">
                <HomeIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">Residential / Emergency Address</p>
                <p id="display-profile-address" className="mt-0.5 text-sm font-medium leading-relaxed text-white">
                  {profile.address || (
                    <span className="italic text-white/40">No address saved — tap update to set</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats Counter Section */}
      <section className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Trusted contacts" value={contacts.length} Icon={UsersIcon} color="#00e676" />
        <Stat label="Alerts logged" value={history.length} Icon={ShieldCheckIcon} color="#ff1744" />
        <Stat label="Evidence items" value={evidenceCount} Icon={HardDriveIcon} color="#ff9100" />
      </section>

      {/* Safety Configuration */}
      <Heading>Safety configuration</Heading>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <InfoRow
          Icon={ShieldCheckIcon}
          label="Primary silent trigger"
          value={GESTURE_LABELS[profile.gesture] || profile.gesture}
        />
        <InfoRow
          Icon={UsersIcon}
          label="Emergency contacts"
          value={`${contacts.length} of 3 configured`}
          onClick={() => nav('/contacts')}
        />
        <InfoRow
          Icon={CameraIcon}
          label="Camera access"
          value={profile.permissions.camera ? 'Granted' : 'Not granted'}
          ok={profile.permissions.camera}
        />
        <InfoRow
          Icon={MicIcon}
          label="Microphone access"
          value={profile.permissions.microphone ? 'Granted' : 'Not granted'}
          ok={profile.permissions.microphone}
        />
        <InfoRow
          Icon={MapPinIcon}
          label="Location access"
          value={profile.permissions.location ? 'Granted' : 'Not granted'}
          ok={profile.permissions.location}
        />
      </section>

      {/* Trusted Contacts */}
      <Heading>Trusted contacts</Heading>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {contacts.length === 0 ? (
          <button onClick={() => nav('/contacts')} className="flex w-full items-center gap-3 p-4 text-left">
            <UsersIcon size={18} color="#ff9100" />
            <span className="flex-1 text-sm text-white/55">No emergency contacts added yet.</span>
            <ChevronRightIcon size={17} color="#777" />
          </button>
        ) : (
          contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => nav('/contacts')}
              className="flex w-full items-center gap-3 border-b border-white/5 p-4 text-left last:border-0"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff1744]/15 font-black text-[#ff1744]">
                {contact.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{contact.name}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/45">
                  {contact.phone ? <PhoneIcon size={11} /> : <MailIcon size={11} />}
                  {contact.phone || contact.email || 'No contact method'}
                </p>
              </div>
              <ChevronRightIcon size={17} color="#777" />
            </button>
          ))
        )}
      </section>

      {/* Evidence Status */}
      <Heading>Evidence status</Heading>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <InfoRow Icon={ImageIcon} label="Photo capture" value={capture.photos ? 'On' : 'Off'} ok={capture.photos} />
        <InfoRow Icon={VideoIcon} label="Video capture" value={capture.video ? 'On' : 'Off'} ok={capture.video} />
        <InfoRow Icon={MicIcon} label="Audio capture" value={capture.audio ? 'On' : 'Off'} ok={capture.audio} />
        <InfoRow Icon={LockKeyholeIcon} label="Local protection" value="Stored on this device" />
      </section>

      <button
        onClick={() => nav('/settings')}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 text-sm font-bold transition-colors hover:bg-white/15"
      >
        Review safety settings <ChevronRightIcon size={17} />
      </button>
    </Screen>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-6 px-1 text-xs font-black uppercase tracking-[0.16em] text-white/40">{children}</p>;
}

function Stat({
  label,
  value,
  Icon,
  color
}: {
  label: string;
  value: number;
  Icon: typeof UsersIcon;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <Icon size={18} color={color} />
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-white/45">{label}</p>
    </div>
  );
}

function InfoRow({
  Icon,
  label,
  value,
  ok,
  onClick
}: {
  Icon: typeof ShieldCheckIcon;
  label: string;
  value: string;
  ok?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Icon size={18} color={ok === true ? '#00e676' : ok === false ? '#ff9100' : '#fff'} />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <span className="text-right text-xs text-white/45">{value}</span>
      {onClick && <ChevronRightIcon size={17} color="#777" />}
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-white/5 p-4 text-left last:border-0">
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0">{content}</div>
  );
}