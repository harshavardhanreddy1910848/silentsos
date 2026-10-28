import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Droplet,
  MapPin,
  Heart,
  Camera,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Profile() {
  const navigate = useNavigate();
  const { state, updateUserProfile, testResendAlert } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    name: state.user?.name || state.userName || '',
    email: state.user?.email || '',
    phone: state.user?.phone || '',
    profileImage: state.user?.profileImage || '',
    bloodGroup: state.user?.bloodGroup || '',
    address: state.user?.address || '',
    motherName: state.user?.motherName || '',
    fatherName: state.user?.fatherName || ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resend Alert Testing
  const [testingResend, setTestingResend] = useState(false);
  const [testResendResult, setTestResendResult] = useState<string | null>(null);
  const [testResendError, setTestResendError] = useState<string | null>(null);

  // Synchronize state when state.user loads
  useEffect(() => {
    if (state.user) {
      setProfile({
        name: state.user.name || state.userName || '',
        email: state.user.email || '',
        phone: state.user.phone || '',
        profileImage: state.user.profileImage || '',
        bloodGroup: state.user.bloodGroup || '',
        address: state.user.address || '',
        motherName: state.user.motherName || '',
        fatherName: state.user.fatherName || ''
      });
    } else if (state.userName) {
      setProfile((p) => ({ ...p, name: state.userName }));
    }
  }, [state.user, state.userName]);

  // Handle avatar upload with client-side scaling/compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfile((p) => ({ ...p, profileImage: compressedDataUrl }));
          setErrorMsg(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfile((p) => ({ ...p, profileImage: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      await updateUserProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        profileImage: profile.profileImage,
        bloodGroup: profile.bloodGroup,
        address: profile.address.trim(),
        motherName: profile.motherName.trim(),
        fatherName: profile.fatherName.trim()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestResendAlert = async () => {
    setTestingResend(true);
    setTestResendResult(null);
    setTestResendError(null);
    try {
      const targetEmail = profile.email || state.user?.email;
      const res = await testResendAlert(targetEmail);
      setTestResendResult(
        `Test emergency alert dispatched successfully via Resend! (ID: ${res.result?.id || 'delivered'})`
      );
      setTimeout(() => setTestResendResult(null), 4000);
    } catch (err: any) {
      setTestResendError(err.message || 'Failed to dispatch test alert via Resend.');
    } finally {
      setTestingResend(false);
    }
  };

  const initials = profile.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'US';

  return (
    <div className="flex-1 w-full bg-[#07090e] text-slate-100 flex flex-col overflow-y-auto no-scrollbar pb-28 select-none">
      
      {/* ─── TOP HEADER ────────────────────────────────────────────────── */}
      <header className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Settings
        </button>

        <span className="text-xs font-mono text-emerald-400 font-semibold px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30">
          Emergency Profile
        </span>
      </header>

      {/* ─── MAIN PROFILE FORM ─────────────────────────────────────────── */}
      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 flex flex-col gap-6">
        
        {/* Title Heading */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <User className="w-7 h-7 text-[#00E676]" />
            User Profile &amp; Emergency Details
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Fill in your personal identification and medical data. This information is instantly transmitted to emergency responders during an SOS trigger.
          </p>
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-400 flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Profile updated and saved to encrypted vault successfully!
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl text-xs font-semibold text-red-400 flex items-center gap-2 shadow-lg"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* ─── CARD 1: PORTRAIT PHOTO ─────────────────────────────────── */}
          <div className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              Identification Portrait
            </h2>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Photo Preview with Clickable Overlay */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer shrink-0"
                title="Click to choose a photo"
              >
                {profile.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt={profile.name || 'User profile'}
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/10"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-500/10 border-2 border-white/10">
                    {initials}
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white shadow-md border-2 border-[#0c1017] transition-all">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              {/* Photo Description & Actions */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="font-bold text-sm text-white">Dispatcher Avatar</span>
                  {profile.profileImage ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Not Uploaded
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload a clear face photo. This enables emergency dispatchers and field contacts to rapidly identify you in critical situations.
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> Upload Image
                  </button>

                  {profile.profileImage && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs font-semibold px-3 py-2 bg-red-950/30 hover:bg-red-900/30 text-red-400 rounded-xl border border-red-500/20 transition-all"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* ─── CARD 2: PRIMARY CONTACT & MEDICAL DETAILS ──────────────── */}
          <div className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              Primary Contact &amp; Medical Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Full Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sheshadri Harsha Vardhan Reddy"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" /> Email ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile / Emergency Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 96301712591"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
                />
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5 text-rose-500" /> Blood Group
                </label>
                <select
                  value={profile.bloodGroup}
                  onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
                  className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors cursor-pointer"
                >
                  <option value="">Select Blood Group...</option>
                  <option value="A+">A+ (A Positive)</option>
                  <option value="A-">A- (A Negative)</option>
                  <option value="B+">B+ (B Positive)</option>
                  <option value="B-">B- (B Negative)</option>
                  <option value="O+">O+ (O Positive)</option>
                  <option value="O-">O- (O Negative)</option>
                  <option value="AB+">AB+ (AB Positive)</option>
                  <option value="AB-">AB- (AB Negative)</option>
                </select>
              </div>
            </div>

            {/* Address */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Residential Address
              </label>
              <textarea
                rows={2}
                placeholder="Street address, flat / apartment number, city, postal code..."
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* ─── CARD 3: FAMILY / GUARDIAN REFERENCES ────────────────────── */}
          <div className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Heart className="w-4 h-4 text-purple-400" />
              Family / Next-of-Kin References
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mother&apos;s Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mary Jenkins"
                  value={profile.motherName}
                  onChange={(e) => setProfile({ ...profile, motherName: e.target.value })}
                  className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Father&apos;s / Guardian&apos;s Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Robert Jenkins"
                  value={profile.fatherName}
                  onChange={(e) => setProfile({ ...profile, fatherName: e.target.value })}
                  className="w-full bg-[#07090e] border border-slate-800 focus:border-emerald-500/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* ─── CARD 4: RESEND ALERT VERIFICATION TEST ─────────────────── */}
          <div className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-amber-400" />
                  Test Live Resend Dispatch to Your Email
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sends an instantaneous emergency test alert packet to <strong>{profile.email || 'your email'}</strong> to verify delivery.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestResendAlert}
                disabled={testingResend || !profile.email}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {testingResend ? (
                  <>
                    <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <BellRing className="w-3.5 h-3.5 text-amber-400" />
                    Send Test Email
                  </>
                )}
              </button>
            </div>

            {testResendResult && (
              <p className="mt-3 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl">
                {testResendResult}
              </p>
            )}

            {testResendError && (
              <p className="mt-3 text-xs font-mono text-red-400 bg-red-950/40 border border-red-500/30 p-2.5 rounded-xl">
                {testResendError}
              </p>
            )}
          </div>

          {/* ─── BOTTOM SUBMIT BAR ───────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || !profile.name.trim() || !profile.email.trim()}
              className="px-6 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c853] text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Saving Details...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Profile Details
                </>
              )}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}

export default Profile;
