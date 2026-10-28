import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import {
  History as HistoryIcon,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Download,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Camera,
  Video,
  Mic,
  Users,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Lock,
  X,
  Radio,
  Flame,
  Activity
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMapView } from '../components/GoogleMapView';

export function History() {
  const { state, refreshHistory, deleteAlert } = useApp();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Sent' | 'Cancelled' | 'Active' | 'Failed'>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Deletion PIN Verification Modal
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    refreshHistory();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshHistory();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Toggle card expansion
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Filter and sort alerts
  const filteredAlerts = useMemo(() => {
    let list = [...state.history];

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'Active') {
        list = list.filter((a) => (a as any).status === 'Active' || !(a.status === 'Sent' || a.status === 'Cancelled'));
      } else {
        list = list.filter((a) => a.status === statusFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => {
        const typeMatch = a.type?.toLowerCase().includes(q);
        const statusMatch = a.status?.toLowerCase().includes(q);
        const dateMatch = format(new Date(a.timestamp), 'MMM d yyyy h:mm a').toLowerCase().includes(q);
        return typeMatch || statusMatch || dateMatch;
      });
    }

    list.sort((a, b) => {
      return sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });

    return list;
  }, [state.history, statusFilter, searchQuery, sortOrder]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = state.history.length;
    const sent = state.history.filter((a) => a.status === 'Sent').length;
    const cancelled = state.history.filter((a) => a.status === 'Cancelled').length;
    const totalEvidence = state.history.reduce(
      (acc, a) => acc + (a.evidence?.photos || 0) + (a.evidence?.videos || 0) + (a.evidence?.audio || 0),
      0
    );
    const sentRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    return { total, sent, cancelled, totalEvidence, sentRate };
  }, [state.history]);

  // Export alerts as CSV Report
  const handleExportCSV = () => {
    if (state.history.length === 0) return;

    const headers = [
      'Incident ID',
      'Date & Time',
      'Alert Type',
      'Status',
      'Duration (sec)',
      'GPS Updates',
      'Latest Latitude',
      'Latest Longitude',
      'Contacts Notified',
      'Photos Captured',
      'Videos Captured',
      'Audio Captured'
    ];

    const rows = state.history.map((a) => {
      const latestCoord = a.gpsPath && a.gpsPath.length > 0 ? a.gpsPath[a.gpsPath.length - 1] : null;
      const contactsCount = a.contactsNotified ? a.contactsNotified.length : 0;
      return [
        `"${a.id}"`,
        `"${format(new Date(a.timestamp), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${a.type || 'SOS'}"`,
        `"${a.status}"`,
        a.durationSeconds || 0,
        a.gpsPath?.length || 0,
        latestCoord ? latestCoord.lat : 'N/A',
        latestCoord ? latestCoord.lng : 'N/A',
        contactsCount,
        a.evidence?.photos || 0,
        a.evidence?.videos || 0,
        a.evidence?.audio || 0
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SilentSOS_Alert_History_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle PIN input for deletion
  const handlePinKeyPress = (num: string) => {
    setPinError(false);
    if (enteredPin.length < 4) {
      const newPin = enteredPin + num;
      setEnteredPin(newPin);

      if (newPin.length === 4) {
        const targetPin = state.settings.safetyPin || '1234';
        if (newPin === targetPin) {
          if (confirmDeleteId) {
            deleteAlert(confirmDeleteId);
          }
          setConfirmDeleteId(null);
          setEnteredPin('');
        } else {
          setPinError(true);
          setTimeout(() => {
            setEnteredPin('');
          }, 800);
        }
      }
    }
  };

  const handlePinBackspace = () => {
    setPinError(false);
    setEnteredPin((p) => p.slice(0, -1));
  };

  // Status badge helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Dispatched
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            Active Alert
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            {status || 'Partial'}
          </span>
        );
    }
  };

  // Alert type icon helper
  const getAlertIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('fall')) return <Activity className="w-4 h-4 text-amber-400" />;
    if (t.includes('gesture')) return <Radio className="w-4 h-4 text-blue-400" />;
    if (t.includes('voice')) return <Mic className="w-4 h-4 text-purple-400" />;
    if (t.includes('stealth')) return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    return <Flame className="w-4 h-4 text-rose-500" />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#07090e] text-white p-4 md:p-8 overflow-y-auto no-scrollbar pb-32">
      {/* ── Top Header Section ── */}
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/10 border border-rose-500/30">
                <HistoryIcon className="w-6 h-6 text-rose-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Alert History
              </h1>
              <span className="ml-2 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {state.history.length} {state.history.length === 1 ? 'incident' : 'incidents'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400">
              Audit trail of triggered distress events, GPS location trails, and responder notifications.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh logs"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500 transition-all text-xs font-medium shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={state.history.length === 0}
              title="Export Incident Audit Report (CSV)"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-lg shadow-emerald-950/40 border border-emerald-400/20 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Total Alerts</span>
              <ShieldAlert className="w-4 h-4 text-rose-400/80" />
            </div>
            <div className="text-2xl font-black text-white">{stats.total}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Lifetime logs</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Dispatched</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400/80" />
            </div>
            <div className="text-2xl font-black text-emerald-400">{stats.sent}</div>
            <div className="text-[11px] text-emerald-500/80 mt-1">
              {stats.sentRate}% success rate
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Cancelled / Safe</span>
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-300">{stats.cancelled}</div>
            <div className="text-[11px] text-slate-500 mt-1">Countdown cleared</div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/80 border border-slate-800/80 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Evidence Vault</span>
              <Camera className="w-4 h-4 text-blue-400/80" />
            </div>
            <div className="text-2xl font-black text-blue-400">{stats.totalEvidence}</div>
            <div className="text-[11px] text-slate-500 mt-1">Media files logged</div>
          </div>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-3 md:p-4 mb-6 shadow-md backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alerts by type, status, or date..."
                className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl pl-10 pr-9 py-2 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/30 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'Sent', label: 'Dispatched' },
                  { id: 'Cancelled', label: 'Cancelled' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    statusFilter === tab.id
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-950/50'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-slate-700/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* Sort selector */}
              <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />
              <button
                onClick={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
                title={`Sort: ${sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}`}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/40 flex items-center gap-1 shrink-0"
              >
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{sortOrder === 'newest' ? 'Latest' : 'Earliest'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Alerts Incident Feed ── */}
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl mt-4">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mb-4 text-slate-500">
              {searchQuery || statusFilter !== 'ALL' ? (
                <Search className="w-8 h-8" />
              ) : (
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              )}
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {searchQuery || statusFilter !== 'ALL' ? 'No matching incidents found' : 'All Clear — No Incidents'}
            </h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-sm mb-4">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search criteria or clear your current filter.'
                : 'No SOS alerts or distress events have been recorded. When an alert is triggered, detailed audit logs will be stored here.'}
            </p>
            {searchQuery || statusFilter !== 'ALL' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-all"
              >
                Reset Filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition-all"
              >
                Go to SOS Hub
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            <AnimatePresence>
              {filteredAlerts.map((event) => {
                const isExpanded = expandedId === event.id;
                const dateObj = new Date(event.timestamp);
                const hasGps = event.gpsPath && event.gpsPath.length > 0;
                const latestCoord = hasGps ? event.gpsPath[event.gpsPath.length - 1] : null;
                const totalMedia =
                  (event.evidence?.photos || 0) + (event.evidence?.videos || 0) + (event.evidence?.audio || 0);

                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl transition-all duration-200 border overflow-hidden ${
                      isExpanded
                        ? 'bg-slate-900 border-slate-700/80 shadow-2xl ring-1 ring-white/10'
                        : 'bg-slate-900/70 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700/80 shadow-md'
                    }`}
                  >
                    {/* Primary Card Row */}
                    <div
                      onClick={() => toggleExpand(event.id)}
                      className="p-4 md:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                    >
                      {/* Left: Type, Icon & Status */}
                      <div className="flex items-start md:items-center gap-3.5">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                            event.status === 'Sent'
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : event.status === 'Cancelled'
                              ? 'bg-slate-800 border-slate-700/60'
                              : 'bg-rose-500/10 border-rose-500/30'
                          }`}
                        >
                          {getAlertIcon(event.type)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm md:text-base text-white">
                              {event.type ? `${event.type} Incident` : 'SOS Distress Alert'}
                            </span>
                            {renderStatusBadge(event.status)}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {format(dateObj, 'MMM d, yyyy • h:mm a')}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">
                              {formatDistanceToNow(dateObj, { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Info Chips & Expand Toggle */}
                      <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t border-slate-800/60 md:border-t-0">
                        {/* Metrics Pills */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-300">
                          {/* Duration */}
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50"
                            title="Active alert duration"
                          >
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-[11px]">{event.durationSeconds || 0}s</span>
                          </div>

                          {/* GPS points */}
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50"
                            title="GPS breadcrumb points"
                          >
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span className="font-mono text-[11px]">{event.gpsPath?.length || 0} pts</span>
                          </div>

                          {/* Contacts */}
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50"
                            title="Responders notified"
                          >
                            <Users className="w-3 h-3 text-blue-400" />
                            <span className="font-mono text-[11px]">
                              {event.contactsNotified?.filter((c) => c.status === 'Sent').length || 0} sent
                            </span>
                          </div>

                          {/* Media count */}
                          {totalMedia > 0 && (
                            <div
                              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50"
                              title="Evidence files"
                            >
                              <Camera className="w-3 h-3 text-purple-400" />
                              <span className="font-mono text-[11px]">{totalMedia} files</span>
                            </div>
                          )}
                        </div>

                        {/* Expand Button */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(event.id);
                            }}
                            title="Delete incident log"
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="p-1.5 text-slate-400 hover:text-white transition-all">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Expanded Detail Accordion ── */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-slate-800/80 bg-slate-950/60 p-4 md:p-6 space-y-6"
                      >
                        {/* 1. Map & Location Section */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                              GPS Location Trail & Breadcrumbs
                            </h4>
                            {latestCoord && (
                              <a
                                href={`https://www.google.com/maps?q=${latestCoord.lat},${latestCoord.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                              >
                                <span>Open Google Maps</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {hasGps && latestCoord ? (
                            <div className="space-y-2">
                              <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner h-56 w-full relative">
                                <GoogleMapView
                                  path={event.gpsPath}
                                  center={latestCoord}
                                  height="100%"
                                  distressType={event.type}
                                  status={event.status}
                                  interactive={true}
                                  showControls={true}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                                <div>
                                  Latest: {latestCoord.lat.toFixed(5)}, {latestCoord.lng.toFixed(5)}
                                </div>
                                <div>Total Breadcrumbs: {event.gpsPath.length} recorded</div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center text-xs text-slate-500">
                              No GPS coordinates were captured for this incident.
                            </div>
                          )}
                        </div>

                        {/* 2. Responders Dispatched Section */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            Emergency Responders Contacted
                          </h4>

                          {event.contactsNotified && event.contactsNotified.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {event.contactsNotified.map((cn, idx) => {
                                // Find matched contact profile from App state
                                const matchedContact = state.contacts.find((c) => c.id === cn.contactId);
                                const displayName = matchedContact?.name || `Responder #${idx + 1}`;
                                const displayRelation = matchedContact?.relationship || 'Contact';
                                const displayPhone = matchedContact?.phone || '';
                                const isDelivered = cn.status === 'Sent';

                                return (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-xs text-white truncate">
                                          {displayName}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                                          {displayRelation}
                                        </span>
                                      </div>
                                      {displayPhone && (
                                        <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                                          {displayPhone}
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      {isDelivered ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                          <CheckCircle2 className="w-3 h-3" /> Sent
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                          <AlertCircle className="w-3 h-3" /> {cn.status || 'Pending'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center text-xs text-slate-500">
                              No contacts were dispatched during this incident.
                            </div>
                          )}
                        </div>

                        {/* 3. Evidence Captured Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Evidence Vault Assets</div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Camera className="w-3 h-3 text-slate-400" />
                                  {event.evidence?.photos || 0} Photos
                                </span>
                                <span className="flex items-center gap-1">
                                  <Video className="w-3 h-3 text-slate-400" />
                                  {event.evidence?.videos || 0} Videos
                                </span>
                                <span className="flex items-center gap-1">
                                  <Mic className="w-3 h-3 text-slate-400" />
                                  {event.evidence?.audio || 0} Audio clips
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => navigate('/evidence')}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5 self-start sm:self-center"
                          >
                            <span>Open in Evidence</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Security PIN Confirmation Modal for Deletion ── */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-xs w-full shadow-2xl relative text-center"
            >
              <button
                onClick={() => {
                  setConfirmDeleteId(null);
                  setEnteredPin('');
                  setPinError(false);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-white mb-1">Enter Safety PIN</h3>
              <p className="text-xs text-slate-400 mb-4">
                Enter your 4-digit PIN to permanently delete this alert record.
              </p>

              {/* PIN Bubbles */}
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border transition-all ${
                      enteredPin.length > i
                        ? 'bg-rose-500 border-rose-400 scale-110 shadow-sm shadow-rose-500/50'
                        : 'border-slate-600 bg-slate-800'
                    } ${pinError ? 'animate-bounce border-rose-500' : ''}`}
                  />
                ))}
              </div>

              {pinError && <p className="text-xs text-rose-400 mb-3 font-medium">Incorrect PIN. Please try again.</p>}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinKeyPress(num)}
                    className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-white font-bold text-lg active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handlePinKeyPress('0')}
                  className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-white font-bold text-lg active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  onClick={handlePinBackspace}
                  className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center active:scale-95 transition-all"
                >
                  ⌫
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
