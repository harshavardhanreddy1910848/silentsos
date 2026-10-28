import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import {
  ShieldAlert,
  Camera,
  Mic,
  MapPin,
  HardDrive,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Droplet,
  Heart,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Onboarding() {
  const { state, updateUser, updateUserProfile, addContact, removeContact, completeSetup } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);

  // Step 1: Comprehensive User Emergency Profile
  const [profileForm, setProfileForm] = useState({
    name: state.user?.name || state.userName || '',
    email: state.user?.email || '',
    phone: state.user?.phone || '',
    bloodGroup: state.user?.bloodGroup || '',
    address: state.user?.address || '',
    motherName: state.user?.motherName || '',
    fatherName: state.user?.fatherName || '',
    profileImage: state.user?.profileImage || ''
  });

  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync profileForm if state.user becomes available
  useEffect(() => {
    if (state.user) {
      setProfileForm((prev) => ({
        ...prev,
        name: prev.name || state.user?.name || state.userName || '',
        email: prev.email || state.user?.email || '',
        phone: prev.phone || state.user?.phone || '',
        bloodGroup: prev.bloodGroup || state.user?.bloodGroup || '',
        address: prev.address || state.user?.address || '',
        motherName: prev.motherName || state.user?.motherName || '',
        fatherName: prev.fatherName || state.user?.fatherName || '',
        profileImage: prev.profileImage || state.user?.profileImage || ''
      }));
    }
  }, [state.user, state.userName]);

  // Step 2: Emergency Contact state
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: ''
  });

  // Step 3: Permissions state
  const [permissionsState, setPermissionsState] = useState({
    camera: 'prompt' as 'prompt' | 'granted' | 'denied',
    microphone: 'prompt' as 'prompt' | 'granted' | 'denied',
    location: 'prompt' as 'prompt' | 'granted' | 'denied',
    storage: 'granted' as 'prompt' | 'granted' | 'denied'
  });

  // Avatar upload handler with canvas compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStep1Error('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 360;
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfileForm((prev) => ({ ...prev, profileImage: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfileForm((prev) => ({ ...prev, profileImage: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const requestPermissions = async () => {
    // 1. Request Location
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setPermissionsState((prev) => ({ ...prev, location: 'granted' }));
            resolve();
          },
          () => {
            setPermissionsState((prev) => ({ ...prev, location: 'denied' }));
            resolve();
          }
        );
      });
    }

    // 2. Request Camera and Audio with fallback
    let cameraGranted = false;
    let microphoneGranted = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      cameraGranted = true;
      microphoneGranted = true;
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraGranted = true;
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignored fallback
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        microphoneGranted = true;
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignored fallback
      }
    }

    setPermissionsState((prev) => ({
      ...prev,
      camera: cameraGranted ? 'granted' : 'denied',
      microphone: microphoneGranted ? 'granted' : 'denied'
    }));
  };

  const handleNext = async () => {
    if (step === 1) {
      // Validate mandatory fields for newly registered user profile
      if (!profileForm.name.trim()) {
        setStep1Error('Full Name is required.');
        return;
      }
      if (!profileForm.phone.trim()) {
        setStep1Error('Mobile / Emergency Phone Number is required.');
        return;
      }
      if (!profileForm.bloodGroup) {
        setStep1Error('Please select your Medical Blood Group.');
        return;
      }
      if (!profileForm.address.trim()) {
        setStep1Error('Residential Address is required for emergency dispatch.');
        return;
      }
      if (!profileForm.motherName.trim() && !profileForm.fatherName.trim()) {
        setStep1Error("Please provide at least one next-of-kin (Mother's or Father's) name.");
        return;
      }

      setStep1Error(null);
      setIsSavingProfile(true);

      try {
        // Save to user profile in backend database and state
        await updateUserProfile({
          name: profileForm.name.trim(),
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim(),
          bloodGroup: profileForm.bloodGroup,
          address: profileForm.address.trim(),
          motherName: profileForm.motherName.trim(),
          fatherName: profileForm.fatherName.trim(),
          profileImage: profileForm.profileImage
        });
        await updateUser(profileForm.name.trim());
        setStep(2);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
        setStep1Error(message);
      } finally {
        setIsSavingProfile(false);
      }
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      completeSetup();
      navigate('/');
    }
  };

  const handleAddContact = () => {
    if (newContact.name && (newContact.phone || newContact.email) && state.contacts.length < 3) {
      addContact({
        id: Date.now().toString(),
        ...newContact,
        preferences: {
          gps: true,
          photos: true,
          video: true,
          audio: true,
          message: true
        }
      });
      setNewContact({
        name: '',
        phone: '',
        email: ''
      });
    }
  };

  const hasAsked = permissionsState.camera !== 'prompt' || permissionsState.location !== 'prompt';
  const hasDenied = permissionsState.camera === 'denied' || permissionsState.location === 'denied';

  const initials = profileForm.name
    ? profileForm.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SOS';

  return (
    <div className="flex flex-col min-h-screen bg-[#07090e] text-white p-4 sm:p-6 md:p-8 overflow-y-auto no-scrollbar pb-28">
      <div className="max-w-2xl mx-auto w-full">
        {/* ── Brand Header ── */}
        <div className="flex items-center justify-center mb-6 mt-2">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mr-3 shadow-lg shadow-rose-950/40">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              SilentSOS
            </h1>
            <p className="text-[11px] text-rose-400/90 font-bold uppercase tracking-widest">
              Emergency Safety Setup
            </p>
          </div>
        </div>

        {/* ── Onboarding Step Progress Tracker ── */}
        <div className="flex items-center justify-between mb-8 px-2 max-w-md mx-auto">
          {[
            { num: 1, title: 'Profile' },
            { num: 2, title: 'Contacts' },
            { num: 3, title: 'Permissions' }
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all shadow-md ${
                    step === s.num
                      ? 'bg-rose-600 text-white shadow-rose-900/50 ring-2 ring-rose-400/40'
                      : step > s.num
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-900 border border-slate-800 text-slate-500'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    step === s.num ? 'text-white font-bold' : step > s.num ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {s.title}
                </span>
              </div>
              {idx < 2 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded transition-all ${
                    step > idx + 1 ? 'bg-emerald-500/60' : 'bg-slate-800'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step Content Motion Container ── */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
        >
          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: COMPREHENSIVE EMERGENCY USER PROFILE
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
                  <User className="w-6 h-6 text-rose-400" />
                  Complete Emergency Profile
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Newly registered users must fill out their medical and guardian details. This profile is automatically saved into your <strong>Settings Profile</strong> and dispatched to responders during an SOS trigger.
                </p>
              </div>

              {/* Error banner */}
              <AnimatePresence>
                {step1Error && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-semibold text-rose-300 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{step1Error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 1. Portrait Photo Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer shrink-0"
                    title="Upload identification photo"
                  >
                    {profileForm.profileImage ? (
                      <img
                        src={profileForm.profileImage}
                        alt={profileForm.name || 'User avatar'}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-rose-500/80 shadow-md shadow-rose-950/40"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-rose-600 via-pink-600 to-amber-600 flex items-center justify-center text-white text-xl font-black shadow-md border-2 border-white/10">
                        {initials}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 p-1.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-white shadow-md border-2 border-[#07090e] transition-all">
                      <Camera className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="font-bold text-sm text-white">Identification Photo</span>
                      {profileForm.profileImage ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                          Uploaded
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Helps emergency dispatchers and field contacts instantly identify you.
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5 text-rose-400" />
                        <span>{profileForm.profileImage ? 'Change Image' : 'Upload Image'}</span>
                      </button>
                      {profileForm.profileImage && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="text-xs font-semibold px-2.5 py-1.5 bg-rose-950/30 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/30 transition-all"
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

              {/* 2. Personal & Medical Information */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Primary Identification & Medical Data
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" /> Full Legal Name{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Harsha Vardhan Reddy"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="w-full bg-[#07090e] border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile / Emergency Number{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full bg-[#07090e] border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> Registered Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full bg-[#07090e] border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                    />
                  </div>

                  {/* Blood Group */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Droplet className="w-3.5 h-3.5 text-rose-500" /> Medical Blood Group{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={profileForm.bloodGroup}
                      onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
                      className="w-full bg-[#07090e] border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors cursor-pointer"
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

                {/* Residential Address */}
                <div className="pt-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Residential Address{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Permanent home address, flat / apartment number, city, postal code..."
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full bg-[#07090e] border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              {/* 3. Family / Guardian References */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-purple-400" />
                  Family & Next-of-Kin Verification
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Mother&apos;s Full Name <span className="text-slate-500 font-normal">(Next-of-Kin)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mary Jenkins"
                      value={profileForm.motherName}
                      onChange={(e) => setProfileForm({ ...profileForm, motherName: e.target.value })}
                      className="w-full bg-[#07090e] border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Father&apos;s / Guardian&apos;s Name <span className="text-slate-500 font-normal">(Next-of-Kin)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Robert Jenkins"
                      value={profileForm.fatherName}
                      onChange={(e) => setProfileForm({ ...profileForm, fatherName: e.target.value })}
                      className="w-full bg-[#07090e] border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: EMERGENCY CONTACTS
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <Phone className="w-6 h-6 text-rose-400" />
                  Emergency Contacts
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Add up to 3 trusted people who will be immediately notified with your GPS path and live evidence when you trigger an alert.
                </p>
              </div>

              <div className="space-y-3">
                {state.contacts.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-900/90 p-4 rounded-2xl flex justify-between items-center border border-slate-800 shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-white text-sm">{c.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{c.phone || c.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeContact(c.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {state.contacts.length < 3 && (
                <div className="bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Add Responder ({state.contacts.length + 1} of 3)
                  </span>
                  <input
                    type="text"
                    placeholder="Contact Full Name"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-rose-500 text-white text-xs sm:text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Phone Number"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-rose-500 text-white text-xs sm:text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email Address (Receives media evidence)"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="w-full bg-[#07090e] border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-rose-500 text-white text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddContact}
                    disabled={!newContact.name || (!newContact.phone && !newContact.email)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold flex items-center justify-center disabled:opacity-50 text-white text-xs transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Add Emergency Contact
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3: SYSTEM PERMISSIONS
             ═══════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  Emergency Hardware Permissions
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  SilentSOS needs device sensor access to silently capture evidence and broadcast live location trails in an emergency.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    icon: Camera,
                    title: 'Camera Feeds',
                    desc: 'Captures stealth photo bursts and video evidence',
                    status: permissionsState.camera
                  },
                  {
                    icon: Mic,
                    title: 'Microphone Stream',
                    desc: 'Records background audio during distress events',
                    status: permissionsState.microphone
                  },
                  {
                    icon: MapPin,
                    title: 'Live GPS Location',
                    desc: 'Broadcasts exact coordinate breadcrumbs',
                    status: permissionsState.location
                  },
                  {
                    icon: HardDrive,
                    title: 'Local Encrypted Storage',
                    desc: 'Safely caches evidence locally before dispatch',
                    status: permissionsState.storage
                  }
                ].map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-slate-900/90 rounded-2xl border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-800 p-2.5 rounded-xl text-rose-400">
                        <p.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs sm:text-sm">{p.title}</p>
                        <p className="text-[11px] text-slate-400 max-w-[220px]">{p.desc}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        p.status === 'granted'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : p.status === 'denied'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {p.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>

              {hasDenied && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-relaxed">
                    Some permissions were blocked. Synthetic mock fallbacks will be used, but real-time hardware tracking will be restricted until enabled in browser settings.
                  </p>
                </div>
              )}

              {!hasAsked ? (
                <button
                  type="button"
                  onClick={requestPermissions}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-2xl text-xs sm:text-sm transition-all border border-slate-700/80 shadow-md"
                >
                  Request System Sensor Permissions
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 py-2.5 rounded-2xl">
                  <CheckCircle className="w-4 h-4" /> Device Sensors Armed & Verified
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Footer Navigation Buttons ── */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={isSavingProfile}
            className="flex-1 sm:flex-initial px-8 py-3.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold rounded-xl flex items-center justify-center transition-all shadow-lg shadow-rose-950/40 text-xs sm:text-sm disabled:opacity-50"
          >
            {isSavingProfile ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Profile...</span>
              </span>
            ) : (
              <>
                <span>{step === 3 ? 'Complete Setup & Launch SOS Hub' : 'Continue'}</span>
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
