import { useState, useEffect } from 'react';
import { useApp, API_BASE } from '../AppContext';
import { 
  Users, 
  ShieldAlert, 
  Activity, 
  MapPin, 
  Mail, 
  Clock, 
  AlertCircle,
  TrendingUp,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export function AdminDashboard() {
  const { token } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const fetchData = async () => {
    if (!token) return;
    try {
      // Parallel fetches for performance
      const [statsRes, alertsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/alerts`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (statsRes.ok && alertsRes.ok && usersRes.ok) {
        const statsData = await statsRes.json();
        const alertsData = await alertsRes.json();
        const usersData = await usersRes.json();

        setStats(statsData);
        // Sort alerts by timestamp descending
        setAlerts(alertsData.sort((a: any, b: any) => b.timestamp - a.timestamp));
        // Sort users by signup date (id is timestamp) descending
        setUsers(usersData.sort((a: any, b: any) => parseInt(b.id) - parseInt(a.id)));
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="w-8 h-8 border-4 border-emergency/20 border-t-emergency rounded-full animate-spin"></span>
      </div>
    );
  }

  // Calculate email notification logs from alerts history
  const emailLogs: any[] = [];
  alerts.forEach(alert => {
    if (alert.contactsNotified && Array.isArray(alert.contactsNotified)) {
      alert.contactsNotified.forEach((c: any) => {
        // Find matching contact detail from users or display placeholder
        emailLogs.push({
          alertId: alert.id,
          userName: alert.userName,
          recipientEmail: c.email || 'Emergency Contact',
          status: c.status || 'Sent',
          timestamp: alert.timestamp,
          type: alert.type
        });
      });
    }
  });

  // Calculate alert locations
  const locationLogs = alerts
    .filter(a => a.gpsPath && a.gpsPath.length > 0)
    .map(a => {
      const latestLoc = a.gpsPath[a.gpsPath.length - 1];
      return {
        alertId: a.id,
        userName: a.userName,
        userEmail: a.userEmail,
        timestamp: a.timestamp,
        lat: latestLoc.lat,
        lng: latestLoc.lng,
        mapsLink: `https://www.google.com/maps?q=${latestLoc.lat},${latestLoc.lng}`
      };
    });

  // Generate activities
  const activities: any[] = [];
  // 1. Add alert activities
  alerts.forEach(a => {
    activities.push({
      type: 'alert_trigger',
      title: `${a.type || 'General'} Alert Triggered`,
      desc: `Triggered by ${a.userName} (${a.userEmail})`,
      timestamp: a.timestamp,
      badgeColor: 'bg-emergency/20 text-emergency'
    });
    if (a.status === 'Cancelled') {
      activities.push({
        type: 'alert_cancel',
        title: 'Alert Cancelled',
        desc: `Cancelled by user ${a.userName}`,
        timestamp: a.timestamp + (a.durationSeconds ? a.durationSeconds * 1000 : 5000),
        badgeColor: 'bg-slate-500/20 text-textMuted'
      });
    } else if (a.status === 'Sent') {
      activities.push({
        type: 'alert_resolve',
        title: 'Alert Resolved',
        desc: `Marked resolved (duration ${a.durationSeconds}s)`,
        timestamp: a.timestamp + (a.durationSeconds ? a.durationSeconds * 1000 : 5000),
        badgeColor: 'bg-emerald-500/20 text-emerald-500'
      });
    }
  });
  // 2. Add user registration activities
  users.forEach(u => {
    const signupTs = parseInt(u.id);
    if (!isNaN(signupTs)) {
      activities.push({
        type: 'user_register',
        title: 'New User Registered',
        desc: `${u.name} (${u.email}) joined as ${u.role}`,
        timestamp: signupTs,
        badgeColor: 'bg-blue-500/20 text-blue-400'
      });
    }
  });
  // Sort activities by timestamp desc
  activities.sort((a, b) => b.timestamp - a.timestamp);

  // Custom Chart Generator: Let's create weekly stats for SVG drawing
  // Get past 7 dates
  const getLastNDays = (n: number) => {
    const arr = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  };

  const chartDays = chartPeriod === 'weekly' ? 7 : chartPeriod === 'monthly' ? 14 : 5;
  const labels = getLastNDays(chartDays);
  
  const alertsChartData = labels.map(day => stats?.alertsByDate?.[day] || 0);
  const registrationsChartData = labels.map(day => stats?.registrations?.[day] || 0);

  // Max value calculation for scaling
  const maxAlert = Math.max(...alertsChartData, 1);
  const maxReg = Math.max(...registrationsChartData, 1);

  // SVG dimensions
  const svgWidth = 500;
  const svgHeight = 160;
  const padding = 20;

  // Compute Line chart points
  const points = alertsChartData.map((val, idx) => {
    const x = padding + (idx * (svgWidth - padding * 2)) / (chartDays - 1);
    const y = svgHeight - padding - (val * (svgHeight - padding * 2)) / maxAlert;
    return `${x},${y}`;
  }).join(' ');

  // Area under line
  const areaPoints = points ? `${padding},${svgHeight - padding} ${points} ${svgWidth - padding},${svgHeight - padding}` : '';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">System Overview</h1>
          <p className="text-sm text-textMuted mt-1">Real-time status of emergency systems and registrations</p>
        </div>
        
        {/* Toggle Chart Interval */}
        <div className="bg-surface border border-surfaceHighlight p-1 rounded-xl flex gap-1 self-start">
          {(['daily', 'weekly', 'monthly'] as const).map(period => (
            <button
              key={period}
              onClick={() => setChartPeriod(period)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all duration-200
                ${chartPeriod === period 
                  ? 'bg-emergency text-white' 
                  : 'text-textMuted hover:text-textMain'}`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card: Active Alerts */}
        <div className="bg-surface/50 border border-surfaceHighlight hover:border-emergency/30 p-6 rounded-3xl transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emergency/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emergency/10 rounded-2xl group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-6 h-6 text-emergency" />
            </div>
            {stats?.activeAlerts > 0 && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emergency opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emergency"></span>
              </span>
            )}
          </div>
          <span className="text-3xl font-extrabold block tracking-tight">
            {stats?.activeAlerts || 0}
          </span>
          <span className="text-sm text-textMuted font-medium mt-1 block">Active SOS Alerts</span>
        </div>

        {/* Card: Total Users */}
        <div className="bg-surface/50 border border-surfaceHighlight hover:border-blue-500/30 p-6 rounded-3xl transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <span className="text-3xl font-extrabold block tracking-tight">
            {stats?.totalUsers || 0}
          </span>
          <span className="text-sm text-textMuted font-medium mt-1 block">Registered Users</span>
        </div>

        {/* Card: Total Alerts History */}
        <div className="bg-surface/50 border border-surfaceHighlight hover:border-purple-500/30 p-6 rounded-3xl transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <span className="text-3xl font-extrabold block tracking-tight">
            {alerts.length}
          </span>
          <span className="text-sm text-textMuted font-medium mt-1 block">All-time Alert Incidents</span>
        </div>

        {/* Card: Email Dispatch Count */}
        <div className="bg-surface/50 border border-surfaceHighlight hover:border-emerald-500/30 p-6 rounded-3xl transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl group-hover:scale-110 transition-transform">
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <span className="text-3xl font-extrabold block tracking-tight">
            {emailLogs.length}
          </span>
          <span className="text-sm text-textMuted font-medium mt-1 block">Emails Dispatched</span>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: SOS Incident Trends */}
        <div className="bg-surface/40 border border-surfaceHighlight p-6 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base">Emergency SOS Incidents</h3>
              <p className="text-xs text-textMuted mt-0.5">Volume of alarms triggered over period</p>
            </div>
            <TrendingUp className="w-5 h-5 text-emergency" />
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {alertsChartData.length > 0 ? (
              <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                <defs>
                  <linearGradient id="glowRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF1744" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#FF1744" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                {/* Grid horizontal markers */}
                <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4" />
                <line x1={padding} y1={(svgHeight) / 2} x2={svgWidth - padding} y2={(svgHeight) / 2} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4" />
                <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#2a2a2a" strokeWidth="2" />
                
                {/* Area under line */}
                {areaPoints && <polygon points={areaPoints} fill="url(#glowRed)" />}
                {/* Main line */}
                {points && <polyline fill="none" stroke="#FF1744" strokeWidth="3" points={points} />}
                
                {/* Data point dots */}
                {alertsChartData.map((val, idx) => {
                  const x = padding + (idx * (svgWidth - padding * 2)) / (chartDays - 1);
                  const y = svgHeight - padding - (val * (svgHeight - padding * 2)) / maxAlert;
                  return (
                    <g key={idx} className="group/dot cursor-pointer">
                      <circle cx={x} cy={y} r="5" fill="#FF1744" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx={x} cy={y} r="9" fill="#FF1744" opacity="0" className="hover:opacity-35 transition-opacity" />
                    </g>
                  );
                })}
              </svg>
            ) : (
              <span className="text-textMuted text-xs">No chart data available</span>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px] text-textMuted px-2 mt-2">
            {labels.map((date, idx) => (
              <span key={idx}>{new Date(date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
            ))}
          </div>
        </div>

        {/* Chart 2: User Registrations */}
        <div className="bg-surface/40 border border-surfaceHighlight p-6 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base">User Registration Trends</h3>
              <p className="text-xs text-textMuted mt-0.5">Frequency of signups per day</p>
            </div>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {registrationsChartData.length > 0 ? (
              <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                {/* Grid horizontal markers */}
                <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4" />
                <line x1={padding} y1={(svgHeight) / 2} x2={svgWidth - padding} y2={(svgHeight) / 2} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4" />
                <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#2a2a2a" strokeWidth="2" />
                
                {/* Bars */}
                {registrationsChartData.map((val, idx) => {
                  const barWidth = 24;
                  const x = padding + (idx * (svgWidth - padding * 2)) / (chartDays - 1) - barWidth / 2;
                  const itemHeight = (val * (svgHeight - padding * 2)) / maxReg;
                  const y = svgHeight - padding - itemHeight;

                  return (
                    <rect
                      key={idx}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(itemHeight, 2)}
                      rx="4"
                      fill="#3b82f6"
                      className="hover:fill-blue-400 transition-colors cursor-pointer"
                    />
                  );
                })}
              </svg>
            ) : (
              <span className="text-textMuted text-xs">No chart data available</span>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px] text-textMuted px-2 mt-2">
            {labels.map((date, idx) => (
              <span key={idx}>{new Date(date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
            ))}
          </div>
        </div>

      </div>

      {/* Main Content Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width on desktop): Logs Tables */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Table: Location Tracking Logs */}
          <div className="bg-surface/40 border border-surfaceHighlight rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-5 h-5 text-emergency" />
              <h3 className="font-extrabold text-lg">GPS Location Logs</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-surfaceHighlight text-textMuted text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3 pr-4">User</th>
                    <th className="pb-3 px-4">Coordinates</th>
                    <th className="pb-3 px-4">Alert Time</th>
                    <th className="pb-3 pl-4 text-right">View Map</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surfaceHighlight/50">
                  {locationLogs.slice(0, 5).map((log, idx) => (
                    <tr key={idx} className="hover:bg-surfaceHighlight/20 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="font-semibold">{log.userName}</div>
                        <div className="text-xs text-textMuted truncate max-w-[150px]">{log.userEmail}</div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-textMuted">
                        {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                      </td>
                      <td className="py-4 px-4 text-xs text-textMuted">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <a 
                          href={log.mapsLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surfaceHighlight hover:bg-surfaceHighlight/80 rounded-xl text-xs font-bold transition-all"
                        >
                          Google Maps
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {locationLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-textMuted">No geolocation logs available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Email Notification Logs */}
          <div className="bg-surface/40 border border-surfaceHighlight rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Mail className="w-5 h-5 text-emerald-400" />
              <h3 className="font-extrabold text-lg">Email Notification Dispatches</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-surfaceHighlight text-textMuted text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3 pr-4">Recipient Contact</th>
                    <th className="pb-3 px-4">Linked User</th>
                    <th className="pb-3 px-4">Event Type</th>
                    <th className="pb-3 px-4">Time</th>
                    <th className="pb-3 pl-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surfaceHighlight/50">
                  {emailLogs.slice(0, 5).map((log, idx) => (
                    <tr key={idx} className="hover:bg-surfaceHighlight/20 transition-colors">
                      <td className="py-4 pr-4">
                        <span className="font-mono text-xs font-medium">{log.recipientEmail}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold">{log.userName}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 bg-surfaceHighlight rounded text-[10px] uppercase font-bold text-textMuted">
                          {log.type || 'General'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-textMuted">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${log.status === 'Sent' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {log.status === 'Sent' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {emailLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-textMuted">No email logs dispatched yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column (1/3 width on desktop): Recent System Activity Feed */}
        <div className="bg-surface/40 border border-surfaceHighlight rounded-3xl p-6 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-purple-400" />
            <h3 className="font-extrabold text-lg">System Activity Stream</h3>
          </div>
          
          <div className="space-y-6 max-h-[550px] overflow-y-auto pr-1 no-scrollbar">
            {activities.slice(0, 15).map((act, idx) => (
              <div key={idx} className="flex gap-4 items-start relative group">
                {/* Timeline connector dot line */}
                {idx < activities.slice(0, 15).length - 1 && (
                  <div className="absolute top-8 left-4 bottom-0 w-[1.5px] bg-surfaceHighlight group-hover:bg-slate-700 transition-colors -translate-x-1/2" />
                )}
                
                {/* Icon wrapper badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${act.badgeColor}`}>
                  {act.type === 'alert_trigger' && <ShieldAlert className="w-4 h-4" />}
                  {act.type === 'alert_resolve' && <CheckCircle2 className="w-4 h-4" />}
                  {act.type === 'alert_cancel' && <Clock className="w-4 h-4" />}
                  {act.type === 'user_register' && <Users className="w-4 h-4" />}
                </div>

                {/* Text details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="font-bold text-sm truncate">{act.title}</h4>
                    <span className="text-[10px] text-textMuted shrink-0">
                      {new Date(act.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <p className="text-xs text-textMuted truncate">{act.desc}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="py-8 text-center text-textMuted text-sm">
                No activity detected.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
