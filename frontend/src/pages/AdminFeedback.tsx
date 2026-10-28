import { useState, useEffect } from 'react';
import { useApp, API_BASE } from '../AppContext';
import { 
  MessageSquareHeart, 
  Search, 
  Download, 
  Star, 
  Trash2, 
  Clock, 
  Mail, 
  User, 
  Lightbulb, 
  Bug, 
  Radio, 
  Sparkles, 
  HelpCircle, 
  Monitor, 
  RefreshCw,
  ThumbsUp
} from 'lucide-react';
import { motion } from 'framer-motion';

export function AdminFeedback() {
  const { token } = useApp();
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [ratingFilter, setRatingFilter] = useState('All');

  // Deletion State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFeedback = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/feedback`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbackList(data);
      }
    } catch (err) {
      console.error('Failed to load admin feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
    const interval = setInterval(fetchFeedback, 20000); // refresh periodically
    return () => clearInterval(interval);
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user feedback entry?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/admin/feedback/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setFeedbackList(prev => prev.filter(f => f.id !== id));
      } else {
        alert('Failed to delete feedback entry.');
      }
    } catch (err) {
      console.error('Failed to delete feedback:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = 'Feedback ID,User Name,User Email,Rating,Category,Message,Date\n';
      const rows = feedbackList.map(f => {
        const uName = (f.userName || 'Anonymous').replace(/"/g, '""');
        const uEmail = (f.userEmail || '').replace(/"/g, '""');
        const msg = (f.message || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const dateStr = new Date(f.createdAt).toISOString();
        return `"${f.id}","${uName}","${uEmail}",${f.rating || 5},"${f.category || 'General'}","${msg}","${dateStr}"`;
      });

      const csvContent = headers + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `user_feedback_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
    }
  };

  // Calculations
  const totalCount = feedbackList.length;
  const avgRating = totalCount > 0 
    ? (feedbackList.reduce((acc, f) => acc + (f.rating || 5), 0) / totalCount).toFixed(1)
    : '5.0';
  const fiveStarCount = feedbackList.filter(f => Number(f.rating) === 5).length;
  const bugCount = feedbackList.filter(f => f.category?.toLowerCase().includes('bug')).length;
  const featureCount = feedbackList.filter(f => f.category?.toLowerCase().includes('feature')).length;

  // Filtered List
  const filteredFeedback = feedbackList.filter(f => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = 
      (f.userName && f.userName.toLowerCase().includes(query)) ||
      (f.userEmail && f.userEmail.toLowerCase().includes(query)) ||
      (f.message && f.message.toLowerCase().includes(query)) ||
      (f.category && f.category.toLowerCase().includes(query));

    const matchesCategory = categoryFilter === 'All' || f.category === categoryFilter;
    const matchesRating = ratingFilter === 'All' || String(f.rating) === ratingFilter;

    return matchesQuery && matchesCategory && matchesRating;
  });

  const getCategoryBadge = (category: string) => {
    const cat = category || 'General';
    if (cat.includes('Bug')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Bug className="w-3 h-3" /> Bug Report
        </span>
      );
    }
    if (cat.includes('Feature')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Lightbulb className="w-3 h-3" /> Feature Request
        </span>
      );
    }
    if (cat.includes('SOS') || cat.includes('Emergency')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <Radio className="w-3 h-3" /> Emergency SOS
        </span>
      );
    }
    if (cat.includes('UI') || cat.includes('Design')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Sparkles className="w-3 h-3" /> UI & Design
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
        <HelpCircle className="w-3 h-3" /> {cat}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto max-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surfaceHighlight/60">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-pink-600/20 to-rose-600/20 border border-pink-500/30 rounded-xl text-pink-400 shadow-lg shadow-pink-500/10">
              <MessageSquareHeart className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              User Feedback & Reviews
              <span className="text-xs px-2.5 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-400 font-semibold">
                {totalCount} Total
              </span>
            </h1>
          </div>
          <p className="text-xs text-textMuted max-w-xl">
            Real-time feedback and ratings submitted by users from the SilentSOS Settings screen. Monitor bug alerts, feature requests, and user satisfaction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchFeedback}
            title="Refresh Feedback"
            className="p-2.5 bg-surface border border-surfaceHighlight rounded-xl text-textMuted hover:text-white hover:bg-surfaceHighlight transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={feedbackList.length === 0}
            className="px-4 py-2.5 bg-surfaceHighlight hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/5 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-pink-400" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Feedback */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-textMuted font-bold uppercase tracking-wider">Total Submissions</span>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
              <MessageSquareHeart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{totalCount}</div>
          <p className="text-[11px] text-textMuted mt-1">From registered & live users</p>
        </div>

        {/* Average Rating */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-textMuted font-bold uppercase tracking-wider">Average Rating</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 flex items-center gap-2">
            {avgRating} <span className="text-xs font-normal text-textMuted">/ 5.0</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3 h-3 ${s <= Math.round(Number(avgRating)) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`}
              />
            ))}
          </div>
        </div>

        {/* 5-Star Reviews */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-textMuted font-bold uppercase tracking-wider">5-Star Ratings</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Star className="w-4 h-4 fill-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{fiveStarCount}</div>
          <p className="text-[11px] text-emerald-400 font-medium mt-1">
            {totalCount > 0 ? `${Math.round((fiveStarCount / totalCount) * 100)}% highest satisfaction` : 'Awaiting reviews'}
          </p>
        </div>

        {/* Category Insights */}
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-textMuted font-bold uppercase tracking-wider">Category Breakdown</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <ThumbsUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1 mt-1 text-xs text-textMuted">
            <div className="flex justify-between">
              <span>Features Requested:</span>
              <span className="text-white font-bold">{featureCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Bug Reports:</span>
              <span className="text-rose-400 font-bold">{bugCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-surface border border-surfaceHighlight rounded-2xl p-4 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted" />
            <input
              type="text"
              placeholder="Search by user name, email, or message keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-surfaceHighlight rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-textMuted/50 outline-none focus:border-pink-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-background border border-surfaceHighlight rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition-all cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="Feature Request">Feature Request</option>
            <option value="Bug Report">Bug Report</option>
            <option value="Emergency SOS Experience">Emergency SOS</option>
            <option value="UI & Design">UI & Design</option>
            <option value="General Thoughts">General Thoughts</option>
          </select>

          {/* Rating Filter */}
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="bg-background border border-surfaceHighlight rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-pink-500 transition-all cursor-pointer"
          >
            <option value="All">All Ratings</option>
            <option value="5">5 Stars (Excellent)</option>
            <option value="4">4 Stars (Very Good)</option>
            <option value="3">3 Stars (Good)</option>
            <option value="2">2 Stars (Fair)</option>
            <option value="1">1 Star (Needs Improvement)</option>
          </select>
        </div>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <span className="w-8 h-8 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin" />
        </div>
      ) : filteredFeedback.length === 0 ? (
        <div className="bg-surface border border-surfaceHighlight rounded-2xl p-12 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-surfaceHighlight/50 border border-white/5 flex items-center justify-center text-textMuted">
            <MessageSquareHeart className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">No Feedback Matches Found</h3>
          <p className="text-xs text-textMuted max-w-sm mx-auto">
            {feedbackList.length === 0
              ? 'No users have submitted feedback yet. Submissions from the Settings screen will appear here automatically.'
              : 'Try clearing your search query or filter tags to see all user feedback submissions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedback.map((item) => {
            const dateFormatted = new Date(item.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            });

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-surfaceHighlight hover:border-surfaceHighlight/80 rounded-2xl p-5 shadow-lg transition-all space-y-4"
              >
                {/* Top Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surfaceHighlight/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-pink-500/10">
                      {item.userName ? item.userName.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{item.userName || 'Anonymous User'}</span>
                        {item.userId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surfaceHighlight text-textMuted font-mono">
                            ID: {item.userId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-textMuted">
                        {item.userEmail ? (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Mail className="w-3 h-3 text-pink-400" /> {item.userEmail}
                          </span>
                        ) : (
                          <span className="text-textMuted/60 italic">No email attached</span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3" /> {dateFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rating & Category Badges */}
                  <div className="flex items-center gap-2 sm:self-center">
                    {getCategoryBadge(item.category)}

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{item.rating || 5}/5</span>
                    </div>
                  </div>
                </div>

                {/* Feedback Message */}
                <div className="bg-background/80 border border-surfaceHighlight/50 rounded-xl p-4">
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    "{item.message}"
                  </p>
                </div>

                {/* Diagnostics Preview (if available) */}
                {item.deviceInfo && Object.keys(item.deviceInfo).length > 0 && (
                  <div className="bg-surfaceHighlight/30 border border-white/5 rounded-xl px-3.5 py-2 text-[11px] text-textMuted flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1 text-white font-medium">
                      <Monitor className="w-3 h-3 text-pink-400" /> Diagnostics:
                    </span>
                    {item.deviceInfo.platform && (
                      <span>OS: <strong className="text-slate-300">{item.deviceInfo.platform}</strong></span>
                    )}
                    {item.deviceInfo.screenResolution && (
                      <span>Screen: <strong className="text-slate-300">{item.deviceInfo.screenResolution}</strong></span>
                    )}
                    {item.deviceInfo.browser && (
                      <span className="truncate max-w-xs" title={item.deviceInfo.browser}>
                        Client: <strong className="text-slate-300">{item.deviceInfo.browser.split(' ')[0]}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-textMuted font-mono">
                    ID: {item.id}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-emergency/10 hover:bg-emergency/20 text-emergency border border-emergency/20 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                      title="Delete Feedback"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
