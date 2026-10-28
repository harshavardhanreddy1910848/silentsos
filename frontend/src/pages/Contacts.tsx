import React, { useState } from 'react';
import { useApp } from '../AppContext';
import {
  Shield,
  User,
  ChevronDown,
  ChevronUp,
  Check,
  Trash2,
  BellRing,
  Plus,
  Phone,
  Mail,
  Star,
  Edit3,
  MapPin,
  Camera,
  Video,
  Mic,
  MessageSquare,
  AlertTriangle,
  X,
  Sparkles,
  Heart,
  Stethoscope,
  Users as UsersIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Contact } from '../types';

const countryCodes = [
  { code: '+91 (IN)', dial: '+91' },
  { code: '+1 (US)', dial: '+1' },
  { code: '+44 (UK)', dial: '+44' },
  { code: '+61 (AU)', dial: '+61' },
  { code: '+971 (AE)', dial: '+971' },
  { code: '+65 (SG)', dial: '+65' }
];

const relationshipTypes = [
  { id: 'Family', label: 'Family', icon: Heart, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  { id: 'Friend', label: 'Friend', icon: UsersIcon, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'Doctor', label: 'Doctor', icon: Stethoscope, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'Other', label: 'Other', icon: Shield, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' }
] as const;

export function Contacts() {
  const { state, addContact, removeContact, updateContact, testResendAlert } = useApp();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ [id: string]: string }>({});

  // Modal state for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setSelectedRelationship] = useState<string>('Family');
  const [countryCode, setCountryCode] = useState('+91 (IN)');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

  // Delete confirmation modal state
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const openAddModal = () => {
    setEditingContactId(null);
    setName('');
    setPhone('');
    setEmail('');
    setSelectedRelationship('Family');
    setCountryCode('+91 (IN)');
    setIsPrimary(state.contacts.length === 0);
    setIsModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContactId(contact.id);
    setName(contact.name);

    // Parse phone & country dial prefix if present
    let rawPhone = contact.phone || '';
    const matchedCountry = countryCodes.find((c) => rawPhone.startsWith(c.dial));
    if (matchedCountry) {
      setCountryCode(matchedCountry.code);
      rawPhone = rawPhone.replace(matchedCountry.dial, '').trim();
    }
    setPhone(rawPhone);
    setEmail(contact.email || '');
    setSelectedRelationship(contact.relationship || 'Family');
    setIsPrimary(!!contact.isPrimary);
    setIsModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!phone.trim() && !email.trim())) return;

    const dialPrefix = countryCodes.find((c) => c.code === countryCode)?.dial || '+91';
    let fullPhone = phone.trim();
    if (fullPhone && !fullPhone.startsWith('+')) {
      fullPhone = `${dialPrefix} ${fullPhone}`;
    }

    if (editingContactId) {
      // If setting this one as primary, unset others
      if (isPrimary) {
        state.contacts.forEach((c) => {
          if (c.id !== editingContactId && c.isPrimary) {
            updateContact(c.id, { isPrimary: false });
          }
        });
      }

      await updateContact(editingContactId, {
        name: name.trim(),
        phone: fullPhone,
        email: email.trim(),
        relationship,
        isPrimary
      });
    } else {
      if (state.contacts.length >= 3) return;

      const newEntry: Contact = {
        id: Date.now().toString(),
        name: name.trim(),
        phone: fullPhone,
        email: email.trim(),
        relationship,
        isPrimary: isPrimary || state.contacts.length === 0,
        preferences: {
          gps: true,
          photos: true,
          video: true,
          audio: true,
          message: true
        }
      };

      if (isPrimary) {
        state.contacts.forEach((c) => {
          if (c.isPrimary) updateContact(c.id, { isPrimary: false });
        });
      }

      await addContact(newEntry);
    }

    setIsModalOpen(false);
  };

  const handleSetPrimary = async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    state.contacts.forEach((c) => {
      updateContact(c.id, { isPrimary: c.id === contactId });
    });
  };

  const handleTestAlert = async (contact: Contact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTestStatus((prev) => ({ ...prev, [contact.id]: 'Sending...' }));
    try {
      if (contact.email) {
        await testResendAlert(contact.email);
        setTestStatus((prev) => ({ ...prev, [contact.id]: 'Alert Sent!' }));
      } else {
        setTestStatus((prev) => ({ ...prev, [contact.id]: 'No Email' }));
      }
      setTimeout(() => {
        setTestStatus((prev) => {
          const next = { ...prev };
          delete next[contact.id];
          return next;
        });
      }, 3500);
    } catch {
      setTestStatus((prev) => ({ ...prev, [contact.id]: 'Failed' }));
      setTimeout(() => {
        setTestStatus((prev) => {
          const next = { ...prev };
          delete next[contact.id];
          return next;
        });
      }, 3500);
    }
  };

  const togglePref = (contactId: string, pref: keyof Contact['preferences']) => {
    const contact = state.contacts.find((c) => c.id === contactId);
    if (contact) {
      updateContact(contactId, {
        preferences: {
          ...contact.preferences,
          [pref]: !contact.preferences[pref]
        }
      });
    }
  };

  const getRelationshipBadge = (rel = 'Family') => {
    const match = relationshipTypes.find((r) => r.id.toLowerCase() === rel.toLowerCase());
    const Icon = match?.icon || Shield;
    const colorClasses = match?.color || 'text-slate-400 bg-slate-800/80 border-slate-700/60';
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${colorClasses}`}>
        <Icon className="w-3 h-3" />
        {rel}
      </span>
    );
  };

  const getAvatarGradient = (rel = 'Family') => {
    const r = rel.toLowerCase();
    if (r.includes('family')) return 'from-rose-500/25 to-pink-500/10 border-rose-500/40 text-rose-300';
    if (r.includes('doctor')) return 'from-emerald-500/25 to-teal-500/10 border-emerald-500/40 text-emerald-300';
    if (r.includes('friend')) return 'from-blue-500/25 to-cyan-500/10 border-blue-500/40 text-blue-300';
    return 'from-purple-500/25 to-indigo-500/10 border-purple-500/40 text-purple-300';
  };

  return (
    <div className="flex-1 w-full bg-[#07090e] text-slate-100 flex flex-col overflow-y-auto no-scrollbar pb-32 select-none">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6">

        {/* ── Top Header & Stats ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Emergency Contacts
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {state.contacts.length} / 3 slots
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Trusted responders who receive immediate GPS coordinates, photo bursts, and audio logs during an emergency.
            </p>
          </div>

          {/* Add Contact CTA button */}
          {state.contacts.length < 3 && (
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Responder</span>
            </button>
          )}
        </div>

        {/* ── Security / Protocol Readiness Pill ── */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span>
              {state.contacts.length === 0 ? (
                <span className="text-amber-400 font-medium">No contacts configured. Add a contact to activate automated emergency broadcast.</span>
              ) : (
                <span>
                  <strong>Emergency Dispatch Armed</strong> • {state.contacts.length} {state.contacts.length === 1 ? 'responder' : 'responders'} configured for instant alert broadcast.
                </span>
              )}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            {[0, 1, 2].map((slot) => (
              <div
                key={slot}
                className={`w-2.5 h-2.5 rounded-full border transition-all ${slot < state.contacts.length
                    ? 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-500/50'
                    : 'bg-slate-800 border-slate-700'
                  }`}
                title={`Responder slot ${slot + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ── Emergency Contacts List ── */}
        {state.contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl">
            <div className="w-16 h-16 rounded-full bg-slate-800/70 border border-slate-700/60 flex items-center justify-center mb-4 text-emerald-400 shadow-inner">
              <UsersIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No Emergency Contacts Added</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-5 leading-relaxed">
              When an SOS alert is triggered, SilentSOS immediately broadcasts your GPS breadcrumb trail and captured media to your trusted contacts. Add your primary responder now.
            </p>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add First Contact</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <AnimatePresence>
              {state.contacts.map((contact, index) => {
                const isExpanded = expandedId === contact.id;
                const initial = (contact.name || 'C').charAt(0).toUpperCase();
                const isPrimary = contact.isPrimary ?? index === 0;
                const avatarTheme = getAvatarGradient(contact.relationship);

                return (
                  <motion.div
                    key={contact.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl transition-all duration-200 border overflow-hidden ${isExpanded
                        ? 'bg-slate-900 border-slate-700/80 shadow-2xl ring-1 ring-white/10'
                        : 'bg-slate-900/70 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700/80 shadow-md'
                      }`}
                  >
                    {/* Primary Row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : contact.id)}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    >
                      {/* Left: Avatar & Contact Info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar */}
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarTheme} border flex items-center justify-center font-bold text-base shadow-sm shrink-0`}
                        >
                          {initial}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base text-white tracking-wide truncate">
                              {contact.name}
                            </span>

                            {/* Primary Badge */}
                            {isPrimary ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Star className="w-2.5 h-2.5 fill-emerald-400" />
                                Primary Responder
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleSetPrimary(contact.id, e)}
                                title="Click to set as primary contact"
                                className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors"
                              >
                                Set Primary
                              </button>
                            )}

                            {getRelationshipBadge(contact.relationship)}
                          </div>

                          {/* Contact Details */}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 font-mono hover:text-slate-200 transition-colors"
                              >
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{contact.phone}</span>
                              </a>
                            )}
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 hover:text-slate-200 transition-colors truncate max-w-[200px]"
                              >
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span className="truncate">{contact.email}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Channel Status Chips & Action Buttons */}
                      <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t border-slate-800/60 md:border-t-0">
                        {/* Enabled channels indicators */}
                        <div className="flex items-center gap-1.5" title="Active distress channels">
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${contact.preferences?.gps ?? true
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-800 border-slate-700/60 text-slate-600'
                              }`}
                            title="GPS Location Broadcast"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${contact.preferences?.photos ?? true
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                : 'bg-slate-800 border-slate-700/60 text-slate-600'
                              }`}
                            title="Camera Photo Evidence"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${contact.preferences?.video ?? true
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                : 'bg-slate-800 border-slate-700/60 text-slate-600'
                              }`}
                            title="Video Evidence"
                          >
                            <Video className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`p-1.5 rounded-lg border text-xs ${contact.preferences?.audio ?? true
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-slate-800 border-slate-700/60 text-slate-600'
                              }`}
                            title="Audio Log Recording"
                          >
                            <Mic className="w-3.5 h-3.5" />
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleTestAlert(contact, e)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                            title="Dispatch test verification notification"
                          >
                            <BellRing className={`w-3.5 h-3.5 ${testStatus[contact.id] ? 'animate-bounce text-emerald-400' : 'text-amber-400'}`} />
                            <span className="text-[11px] font-medium hidden sm:inline">
                              {testStatus[contact.id] || 'Test Ping'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(contact);
                            }}
                            title="Edit Responder"
                            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-slate-400 hover:text-white transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactToDelete(contact);
                            }}
                            title="Remove Responder"
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="p-1 text-slate-400 hover:text-white transition-all ml-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Expanded Broadcast Preferences ── */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-slate-800/80 bg-slate-950/60 p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              Distress Broadcast Channels for {contact.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Configure which intelligence and evidence data is automatically dispatched to this responder.
                            </p>
                          </div>
                        </div>

                        {/* Preferences Toggles Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                          {[
                            { key: 'gps', label: 'Live GPS Trail', icon: MapPin, desc: 'Real-time coordinates link' },
                            { key: 'photos', label: 'Photo Bursts', icon: Camera, desc: 'Camera evidence snapshots' },
                            { key: 'video', label: 'Video Clip', icon: Video, desc: 'Cloud recorded video' },
                            { key: 'audio', label: 'Audio Stream', icon: Mic, desc: 'Ambient sound clips' },
                            { key: 'message', label: 'Emergency SMS', icon: MessageSquare, desc: 'Instant distress text' }
                          ].map(({ key, label, icon: Icon, desc }) => {
                            const active = contact.preferences?.[key as keyof Contact['preferences']] ?? true;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => togglePref(contact.id, key as keyof Contact['preferences'])}
                                className={`p-3 rounded-xl border text-left transition-all ${active
                                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 shadow-sm'
                                    : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:border-slate-700'
                                  }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-600'}`} />
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${active ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-slate-700 bg-slate-800'
                                      }`}
                                  >
                                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                </div>
                                <div className="font-semibold text-xs text-white">{label}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Quick Add Another Slot Placeholder */}
            {state.contacts.length < 3 && (
              <button
                type="button"
                onClick={openAddModal}
                className="w-full py-4 border-2 border-dashed border-slate-800/90 hover:border-emerald-500/50 rounded-2xl text-slate-400 hover:text-white flex items-center justify-center gap-2 text-xs font-semibold transition-all group bg-slate-900/20 hover:bg-slate-900/40"
              >
                <div className="w-6 h-6 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <span>Add Emergency Responder (Slot {state.contacts.length + 1} of 3)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modal for Adding / Editing Contact ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingContactId ? 'Edit Emergency Responder' : 'Add Emergency Responder'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingContactId
                      ? 'Update responder contact information & delivery priority'
                      : `Slot ${state.contacts.length + 1} of 3 emergency contacts`}
                  </p>
                </div>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveContact} className="space-y-4">
                {/* Field 1: Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins or Officer Miller"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 focus:border-emerald-500/70 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                {/* Field 2: Relationship Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Relationship
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {relationshipTypes.map((rel) => {
                      const isSelected = relationship === rel.id;
                      const Icon = rel.icon;
                      return (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => setSelectedRelationship(rel.id)}
                          className={`py-2 px-1 rounded-xl text-center text-xs font-medium transition-all flex flex-col items-center gap-1 ${isSelected
                              ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300 shadow-sm'
                              : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{rel.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Field 3: Phone Number with Country Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Mobile Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center relative">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                        className="px-3 py-2.5 bg-slate-950/80 border border-slate-700/60 border-r-0 rounded-l-xl text-xs text-slate-300 font-mono flex items-center gap-1 hover:bg-slate-800 transition-colors"
                      >
                        <span>{countryCode}</span>
                        <ChevronDown className="w-3 h-3 text-slate-500" />
                      </button>

                      {countryDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden py-1">
                          {countryCodes.map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => {
                                setCountryCode(item.code);
                                setCountryDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${countryCode === item.code ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                              {item.code}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      type="tel"
                      required
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 bg-slate-950/80 border border-slate-700/60 focus:border-emerald-500/70 rounded-r-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Field 4: Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address <span className="text-slate-500 text-[11px] font-normal">(Receives multimedia evidence dispatches)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="responder@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 focus:border-emerald-500/70 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                {/* Field 5: Primary Checkbox */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPrimary}
                      onChange={(e) => setIsPrimary(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/30 bg-slate-950"
                    />
                    <span className="text-xs text-slate-300 font-medium">
                      Designate as Primary Emergency Responder
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                    Primary responder is dialed and notified first with top priority in distress situations.
                  </p>
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold bg-slate-800 hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || (!phone.trim() && !email.trim())}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-950/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingContactId ? 'Save Changes' : 'Save Responder'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Confirmation Modal for Deleting Contact ── */}
      <AnimatePresence>
        {contactToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-white mb-1">Remove Responder?</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Are you sure you want to remove <strong className="text-white">{contactToDelete.name}</strong> from your emergency dispatch contacts? They will no longer receive distress alerts.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setContactToDelete(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeContact(contactToDelete.id);
                    setContactToDelete(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition-all active:scale-95"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Contacts;
