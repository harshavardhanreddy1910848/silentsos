import React, { useState, useEffect } from 'react';
import { useApp, API_BASE, MEDIA_BASE } from '../AppContext';
import { 
  ShieldAlert, 
  Search, 
  Download, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Camera,
  Video,
  Mic
} from 'lucide-react';


export function AdminAlerts() {
  const { token } = useApp();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userQuery, setUserQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Cancelled' | 'Sent'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Sort alerts by timestamp descending
        setAlerts(data.sort((a: any, b: any) => b.timestamp - a.timestamp));
      }
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // refresh every 10s for active incidents
    return () => clearInterval(interval);
  }, [token]);

  const handleResolve = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    setResolvingId(alertId);
    try {
      const res = await fetch(`${API_BASE}/admin/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'Sent' } : a));
      } else {
        alert('Failed to resolve alert');
      }
    } catch (err) {
      console.error('Failed to resolve alert', err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/alerts/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alerts_report_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export CSV report');
    }
  };

  const toggleExpand = (alertId: string) => {
    if (expandedAlert === alertId) {
      setExpandedAlert(null);
    } else {
      setExpandedAlert(alertId);
    }
  };

  // Filter alert incidents
  const filteredAlerts = alerts.filter(a => {
    // User search
    const matchesUser = a.userName.toLowerCase().includes(userQuery.toLowerCase()) || 
                        a.userEmail.toLowerCase().includes(userQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    
    // Date filter
    let matchesDate = true;
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      matchesDate = matchesDate && a.timestamp >= startMs;
    }
    if (endDate) {
      // Add 23h 59m 59s to include the whole end day
      const endMs = new Date(endDate).getTime() + 86399000;
      matchesDate = matchesDate && a.timestamp <= endMs;
    }

    return matchesUser && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="w-8 h-8 border-4 border-emergency/20 border-t-emergency rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">SOS Incidents</h1>
          <p className="text-sm text-textMuted mt-1">Audit historic distress triggers, view rich media evidence, or override system locks</p>
        </div>
        
        <button 
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-all self-start"
        >
          <Download className="w-4 h-4" />
          Export Alerts (CSV)
        </button>
      </div>

      {/* Filter Options Controls */}
      <div className="bg-surface/40 border border-surfaceHighlight p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-textMuted text-xs font-bold uppercase tracking-wider">
          <Filter className="w-4 h-4" />
          Filter Incidents
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* User Input */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">User Identity</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textMuted">
                <Search className="w-4 h-4" />
              </div>
              <input 
                type="text" 
                placeholder="Name or email..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-xs text-textMain outline-none transition-all"
              />
            </div>
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">Incident Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-xs text-textMain outline-none transition-all"
            >
              <option value="All">All Incidents</option>
              <option value="Active">Active Alerts</option>
              <option value="Cancelled">User Cancelled</option>
              <option value="Sent">Resolved / Dispatched</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">From Date</label>
            <div className="relative">
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-xs text-textMain outline-none transition-all"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">To Date</label>
            <div className="relative">
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-xs text-textMain outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {filteredAlerts.map((alert) => {
          const isExpanded = expandedAlert === alert.id;
          const mapLoc = alert.gpsPath && alert.gpsPath.length > 0 ? alert.gpsPath[alert.gpsPath.length - 1] : null;

          return (
            <div 
              key={alert.id}
              onClick={() => toggleExpand(alert.id)}
              className={`bg-surface/30 hover:bg-surface/50 border rounded-3xl p-5 cursor-pointer transition-all duration-200 overflow-hidden relative
                ${alert.status === 'Active' ? 'border-emergency/40 ring-1 ring-emergency/10' : 'border-surfaceHighlight'}
              `}
            >
              {/* Left active glow highlight indicator */}
              {alert.status === 'Active' && (
                <div className="absolute left-0 inset-y-0 w-1.5 bg-emergency animate-pulse-fast" />
              )}

              {/* Card Summary row */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                {/* Details info */}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl shrink-0 ${alert.status === 'Active' ? 'bg-emergency/15 text-emergency' : 'bg-surfaceHighlight text-textMuted'}`}>
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm">{alert.type || 'General'} SOS Alert</span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide
                        ${alert.status === 'Active' ? 'bg-emergency/15 text-emergency animate-pulse-fast' : 
                          alert.status === 'Cancelled' ? 'bg-surfaceHighlight text-textMuted' : 'bg-emerald-500/10 text-emerald-500'}`}
                      >
                        {alert.status === 'Active' && <span className="h-1.5 w-1.5 bg-emergency rounded-full"></span>}
                        {alert.status}
                      </span>
                    </div>
                    <span className="text-xs text-textMuted mt-1 block">
                      By <strong className="text-textMain font-semibold">{alert.userName}</strong> ({alert.userEmail})
                    </span>
                  </div>
                </div>

                {/* Metrics + action row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-textMuted self-stretch md:self-auto justify-between border-t border-surfaceHighlight/50 md:border-none pt-3 md:pt-0">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Duration: {alert.durationSeconds || 0}s</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {alert.status === 'Active' && (
                      <button
                        onClick={(e) => handleResolve(alert.id, e)}
                        disabled={resolvingId === alert.id}
                        className="px-3.5 py-1.5 bg-emergency hover:bg-emergencyHover text-white rounded-xl font-bold text-xs shadow-lg shadow-emergency/15 transition-all flex items-center gap-1"
                      >
                        {resolvingId === alert.id ? 'Resolving...' : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Force Resolve
                          </>
                        )}
                      </button>
                    )}

                    <div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-textMuted" /> : <ChevronDown className="w-5 h-5 text-textMuted" />}
                    </div>
                  </div>
                </div>

              </div>

              {/* Expanded Details Section */}
              {isExpanded && (
                <div 
                  onClick={(e) => e.stopPropagation()} // prevent double-closing when clicking details content
                  className="mt-5 pt-5 border-t border-surfaceHighlight space-y-5 cursor-default text-sm text-textMain animate-slide-down"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Column 1: Incident Location details */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs text-textMuted font-bold uppercase tracking-wider">
                        <MapPin className="w-4 h-4 text-emergency" />
                        Incident Coordinates log
                      </div>
                      
                      {mapLoc ? (
                        <div className="bg-black/30 border border-surfaceHighlight p-4 rounded-2xl space-y-2">
                          <div className="font-mono text-xs">
                            Latitude: <span className="text-textMuted">{mapLoc.lat.toFixed(6)}</span><br />
                            Longitude: <span className="text-textMuted">{mapLoc.lng.toFixed(6)}</span>
                          </div>
                          <a 
                            href={`https://www.google.com/maps?q=${mapLoc.lat},${mapLoc.lng}`}
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surfaceHighlight hover:bg-surfaceHighlight/80 rounded-xl text-xs font-bold transition-all text-textMain"
                          >
                            Open in Google Maps
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <div className="p-4 bg-black/20 border border-surfaceHighlight text-xs text-textMuted rounded-2xl">
                          No GPS location path recorded.
                        </div>
                      )}

                      {/* GPS History Breadcrumbs */}
                      {alert.gpsPath && alert.gpsPath.length > 1 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-textMuted font-bold uppercase block">Tracking History:</span>
                          <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-textMuted font-mono">
                            {alert.gpsPath.map((loc: any, index: number) => (
                              <div key={index} className="flex justify-between items-center bg-black/15 px-2.5 py-1.5 rounded-lg border border-surfaceHighlight/40">
                                <span>{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</span>
                                <span>{new Date(loc.timestamp).toLocaleTimeString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column 2: Evidence Files and contacts */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-xs text-textMuted font-bold uppercase tracking-wider">
                        <FileText className="w-4 h-4 text-purple-400" />
                        Evidence Captured & Notified Contacts
                      </div>

                      {/* Media Counts Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-black/30 border border-surfaceHighlight p-3 rounded-2xl text-center">
                          <Camera className="w-4 h-4 mx-auto mb-1 text-sky-400" />
                          <span className="text-xs font-bold block">{alert.evidence?.photos || 0}</span>
                          <span className="text-[9px] text-textMuted block">Photos</span>
                        </div>
                        <div className="bg-black/30 border border-surfaceHighlight p-3 rounded-2xl text-center">
                          <Video className="w-4 h-4 mx-auto mb-1 text-emergency" />
                          <span className="text-xs font-bold block">{alert.evidence?.videos || 0}</span>
                          <span className="text-[9px] text-textMuted block">Videos</span>
                        </div>
                        <div className="bg-black/30 border border-surfaceHighlight p-3 rounded-2xl text-center">
                          <Mic className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                          <span className="text-xs font-bold block">{alert.evidence?.audio || 0}</span>
                          <span className="text-[9px] text-textMuted block">Voice Logs</span>
                        </div>
                      </div>

                      {/* Evidence Files List */}
                      {alert.evidence?.files && alert.evidence.files.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] text-textMuted font-bold uppercase block">Evidence Records:</span>
                          <div className="max-h-40 overflow-y-auto space-y-1.5">
                            {alert.evidence.files.map((file: any, index: number) => {
                              const relativeUrl = file.url.startsWith('/') ? file.url : `/${file.url}`;
                              const fileFullUrl = `${MEDIA_BASE}${relativeUrl}`;
                              return (
                                <a 
                                  key={index}
                                  href={fileFullUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-center justify-between p-2 bg-black/25 border border-surfaceHighlight hover:bg-surfaceHighlight/30 rounded-xl text-xs transition-colors text-textMain"
                                >
                                  <div className="flex items-center gap-2">
                                    {file.type === 'photo' && <Camera className="w-3.5 h-3.5 text-sky-400" />}
                                    {file.type === 'video' && <Video className="w-3.5 h-3.5 text-emergency" />}
                                    {file.type === 'audio' && <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                                    <span className="font-semibold capitalize">{file.type} Evidence</span>
                                  </div>
                                  <span className="text-[10px] text-textMuted font-mono">
                                    {new Date(file.timestamp).toLocaleTimeString()}
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notified emergency contacts status */}
                      {alert.contactsNotified && alert.contactsNotified.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] text-textMuted font-bold uppercase block">Contact Notification Logs:</span>
                          <div className="space-y-1.5">
                            {alert.contactsNotified.map((c: any, index: number) => (
                              <div key={index} className="flex justify-between items-center text-xs bg-black/15 border border-surfaceHighlight/35 p-2 rounded-xl">
                                <span className="font-medium truncate max-w-[170px]">{c.email || 'Contact'}</span>
                                <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase
                                  ${c.status === 'Sent' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}
                                >
                                  {c.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filteredAlerts.length === 0 && (
          <div className="bg-surface/10 border border-surfaceHighlight rounded-3xl p-12 text-center text-textMuted">
            No incident reports found matching selected filter limits.
          </div>
        )}
      </div>
    </div>
  );
}
