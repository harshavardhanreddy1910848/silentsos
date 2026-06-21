import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ShieldAlert, Eye, EyeOff, Lock, Mail, ChevronRight } from 'lucide-react';

export function AdminLogin() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      // After login completes successfully, the AppContext token state gets updated,
      // which triggers fetchState and updates userRole.
      // We navigate immediately to dashboard, the router guard will protect if not admin.
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      
      {/* Background radial glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emergency/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-emergency/10 border border-emergency/20 rounded-2xl mb-4 animate-pulse-fast">
            <ShieldAlert className="w-10 h-10 text-emergency" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-textMain via-textMain to-emergency bg-clip-text text-transparent">
            SOS ADMINISTRATIVE
          </h1>
          <p className="text-sm text-textMuted mt-1">Authorized personnel only</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-surface/60 backdrop-blur-xl border border-surfaceHighlight p-8 rounded-3xl shadow-2xl relative">
          
          {/* Subtle top indicator bar */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emergency to-transparent rounded-t-3xl" />

          {error && (
            <div className="mb-6 p-4 bg-emergency/10 border border-emergency/20 text-emergency text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@silentsos.com"
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain placeholder-textMuted outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 bg-black/40 border border-surfaceHighlight focus:border-emergency/50 rounded-xl text-sm text-textMain placeholder-textMuted outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-textMuted hover:text-textMain transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-emergency hover:bg-emergencyHover text-white py-3.5 px-4 rounded-xl font-bold text-sm tracking-wider shadow-lg shadow-emergency/20 hover:shadow-emergency/30 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  Enter Dashboard
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Link back to app */}
        <div className="text-center mt-6">
          <button 
            onClick={() => navigate('/')}
            className="text-xs text-textMuted hover:text-textMain hover:underline transition-colors"
          >
            Return to User Application
          </button>
        </div>
      </div>
    </div>
  );
}
