import React, { useState, useEffect } from 'react';
import { useApp, API_BASE } from '../AppContext';
import { 
  Search, 
  Edit2, 
  Trash2, 
  UserX, 
  UserCheck, 
  ShieldAlert, 
  X,
  Lock,
  Mail,
  User
} from 'lucide-react';

export function AdminUsers() {
  const { token, state } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [editDisabled, setEditDisabled] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete Confirm State
  const [deletingUser, setDeletingUser] = useState<any>(null);

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleToggleStatus = async (user: any) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ disabled: !user.disabled })
      });
      if (res.ok) {
        // Update local list
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, disabled: !u.disabled } : u));
      }
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role || 'user');
    setEditDisabled(!!user.disabled);
    setEditPassword('');
    setErrorMsg(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMsg(null);
    setSaving(true);

    try {
      const updates: any = {
        name: editName,
        email: editEmail,
        role: editRole,
        disabled: editDisabled
      };
      if (editPassword.trim() !== '') {
        updates.password = editPassword;
      }

      const res = await fetch(`${API_BASE}/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      // Update local state list
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updates } : u));
      setEditingUser(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during save');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (user: any) => {
    // Cannot delete self
    if (user.email === state.userName || user.email === 'admin@silentsos.com') {
      alert('🔒 For safety, you cannot delete active System Admin accounts.');
      return;
    }
    setDeletingUser(user);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
        setDeletingUser(null);
      } else {
        const data = await res.json();
        alert(`Failed to delete user: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="w-8 h-8 border-4 border-emergency/20 border-t-emergency rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">User Directory</h1>
          <p className="text-sm text-textMuted mt-1">Manage registration properties, role scopes, and state access controls</p>
        </div>
      </div>

      {/* Search Bar Utility */}
      <div className="bg-surface/40 border border-surfaceHighlight p-4 rounded-2xl flex items-center gap-3">
        <Search className="w-5 h-5 text-textMuted" />
        <input 
          type="text" 
          placeholder="Search by name, email or user ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-textMain placeholder-textMuted w-full"
        />
      </div>

      {/* Users Table Grid */}
      <div className="bg-surface/30 border border-surfaceHighlight rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-surfaceHighlight text-textMuted text-xs font-bold uppercase tracking-wider bg-surface/50">
                <th className="py-4 px-6">User Detail</th>
                <th className="py-4 px-6">Security Role</th>
                <th className="py-4 px-6">Joined Date</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surfaceHighlight/50">
              {filteredUsers.map((user) => {
                const signupTs = parseInt(user.id);
                const joinDateStr = !isNaN(signupTs) 
                  ? new Date(signupTs).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'Pre-existing';

                return (
                  <tr key={user.id} className="hover:bg-surfaceHighlight/10 transition-colors">
                    {/* User profile identifier */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm
                          ${user.role === 'admin' ? 'bg-emergency/15 text-emergency border border-emergency/30' : 'bg-surfaceHighlight text-textMain'}
                        `}>
                          {user.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block truncate text-textMain">{user.name}</span>
                          <span className="text-xs text-textMuted block truncate">{user.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize
                        ${user.role === 'admin' 
                          ? 'bg-emergency/10 text-emergency border border-emergency/20' 
                          : 'bg-surfaceHighlight text-textMuted'}`}
                      >
                        {user.role === 'admin' ? 'Administrator' : 'Standard User'}
                      </span>
                    </td>

                    {/* Registration date */}
                    <td className="py-4 px-6 text-xs text-textMuted font-mono">
                      {joinDateStr}
                    </td>

                    {/* Enabled / Disabled Switch */}
                    <td className="py-4 px-6 text-center">
                      <button 
                        onClick={() => handleToggleStatus(user)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all
                          ${user.disabled 
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}
                      >
                        {user.disabled ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {user.disabled ? 'Disabled' : 'Active'}
                      </button>
                    </td>

                    {/* Actions dropdown/buttons */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(user)}
                          className="p-2 bg-surfaceHighlight hover:bg-surfaceHighlight/80 text-textMuted hover:text-textMain rounded-xl transition-all"
                          title="Edit User details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="p-2 bg-surfaceHighlight hover:bg-emergency/20 text-textMuted hover:text-emergency rounded-xl transition-all"
                          title="Delete User account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-textMuted">No users found matching query</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal Dialog */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-surfaceHighlight rounded-3xl overflow-hidden relative shadow-2xl animate-scale-up">
            
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emergency to-transparent" />
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-surfaceHighlight">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emergency" />
                <h3 className="font-extrabold text-lg">Modify User Properties</h3>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-textMuted hover:text-textMain hover:bg-surfaceHighlight transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-emergency/15 text-emergency border border-emergency/20 text-xs rounded-xl font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">Display Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textMuted">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textMuted">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">Security Scope</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain outline-none transition-all"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                {/* Account Enabled Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">Login Status</label>
                  <div className="flex items-center h-[42px]">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!editDisabled}
                        onChange={() => setEditDisabled(!editDisabled)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-surfaceHighlight peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-3 text-sm font-semibold text-textMain">
                        {editDisabled ? 'Suspended' : 'Allowed'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Password update (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-1">Update Password (Optional)</label>
                <p className="text-[10px] text-textMuted mb-2">Leave blank to retain current hashed security credentials.</p>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textMuted">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    placeholder="New admin-enforced password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain placeholder-textMuted outline-none transition-all"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-surfaceHighlight">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 border border-surfaceHighlight text-textMuted hover:text-textMain text-sm rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-emergency hover:bg-emergencyHover text-white text-sm rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Commit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-surfaceHighlight rounded-3xl p-6 shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-emergency" />
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-emergency/10 text-emergency rounded-full mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-xl mb-2 text-textMain">Permanent Account Purge?</h3>
              <p className="text-sm text-textMuted mb-6">
                Are you absolutely sure you want to delete <strong>{deletingUser.name}</strong> ({deletingUser.email})? 
                This will recursively wipe out all their user logs, contact structures, history settings, and alert media. This action is irreversible.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeletingUser(null)}
                  className="flex-1 py-3 border border-surfaceHighlight text-textMuted hover:text-textMain text-sm rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-emergency hover:bg-emergencyHover text-white text-sm rounded-xl font-bold transition-all"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
