import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import TechDashboard from './components/TechDashboard';
import RadDashboard from './components/RadDashboard';
import MedicalAdminDashboard from './components/MedicalAdminDashboard';

// Generate unique user ID
const generateUserId = () => `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

// Demo users for authentication
const DEMO_USERS = [
  { username: 'tech1', password: 'tech123', role: 'TECH', name: 'John Tech' },
  { username: 'tech2', password: 'tech123', role: 'TECH', name: 'Sarah Tech' },
  { username: 'rad1', password: 'rad123', role: 'RAD', name: 'Dr. Smith' },
  { username: 'rad2', password: 'rad123', role: 'RAD', name: 'Dr. Johnson' },
  { username: 'admin', password: 'admin123', role: 'ADMIN', name: 'Medical Admin' },
];

// Session storage key
const SESSION_KEY = 'rology_session';

interface SessionData {
  route: 'TECH' | 'RAD' | 'ADMIN';
  userId: string;
  userName: string;
}

const App: React.FC = () => {
  const [route, setRoute] = useState<'LANDING' | 'TECH' | 'RAD' | 'ADMIN'>('LANDING');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<'TECH' | 'RAD' | 'ADMIN' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from sessionStorage on mount (per-tab session)
  useEffect(() => {
    try {
      const savedSession = sessionStorage.getItem(SESSION_KEY);
      if (savedSession) {
        const session: SessionData = JSON.parse(savedSession);
        setRoute(session.route);
        setUserId(session.userId);
        setUserName(session.userName);
      } else {
        setUserId(generateUserId());
      }
    } catch (e) {
      console.error('Failed to load session:', e);
      setUserId(generateUserId());
    }
    setIsLoading(false);
  }, []);

  // Save session to sessionStorage when logged in (per-tab)
  const saveSession = (route: 'TECH' | 'RAD' | 'ADMIN', userId: string, userName: string) => {
    const session: SessionData = { route, userId, userName };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  // Clear session on logout
  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setRoute('LANDING');
    setUserName('');
    setUsername('');
    setPassword('');
    setSelectedRole(null);
    setError('');
  };

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }

    if (!selectedRole) {
      setError('Please select your role');
      return;
    }

    const user = DEMO_USERS.find(
      u => u.username === username && u.password === password && u.role === selectedRole
    );

    if (user) {
      const newUserId = userId || generateUserId();
      setUserName(user.name);
      setUserId(newUserId);
      setRoute(selectedRole);
      saveSession(selectedRole, newUserId, user.name);
      setError('');
    } else {
      setError('Invalid credentials or role mismatch');
    }
  };

  // Show loading while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-rology-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rology-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (route === 'TECH') {
    return <TechDashboard userId={userId} userName={userName} onLeave={clearSession} />;
  }

  if (route === 'RAD') {
    return <RadDashboard userId={userId} userName={userName} onLeave={clearSession} />;
  }

  if (route === 'ADMIN') {
    return <MedicalAdminDashboard userId={userId} userName={userName} onLeave={clearSession} />;
  }

  return (
    <div className="min-h-screen bg-rology-950 flex flex-col items-center justify-center p-4">
      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-rology-800 rounded-lg border border-rology-700 p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-xl text-gray-300 mb-6">Sign in to your account</h1>
            
            {/* Logo */}
            <div className="flex items-center justify-center gap-4 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-rology-500 rounded flex items-center justify-center text-white font-bold text-lg">R</div>
                <span className="text-xl font-bold text-white tracking-wide">ROLOGY</span>
              </div>
              <div className="w-px h-8 bg-rology-600"></div>
              <div className="text-blue-400 font-bold text-sm">FDA<br/><span className="text-[10px] font-normal text-gray-400">CLEARED</span></div>
            </div>
            <p className="text-xs text-gray-500">Teleradiology Platform</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Username *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your username"
                className="w-full bg-rology-900 border border-rology-600 rounded px-4 py-3 text-white placeholder-gray-500 text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-rology-900 border border-rology-600 rounded px-4 py-3 text-white placeholder-gray-500 text-sm"
              />
            </div>

            {/* Forgot Links */}
            <div className="text-xs space-y-1">
              <p className="text-gray-500">Forgot your password? <span className="text-rology-400 cursor-pointer hover:underline">Reset password</span></p>
              <p className="text-gray-500">Forgot your username? <span className="text-rology-400 cursor-pointer hover:underline">Send username</span></p>
            </div>

            {/* Role Selection */}
            <div className="pt-4">
              <label className="block text-sm text-gray-400 mb-3">Select Your Role</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole('TECH')}
                  className={`p-3 rounded border transition-all text-center ${
                    selectedRole === 'TECH'
                      ? 'bg-rology-500/20 border-rology-500 text-rology-400'
                      : 'bg-rology-850 border-rology-700 text-gray-400 hover:border-rology-600'
                  }`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                  <div className="text-xs">Technician</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('RAD')}
                  className={`p-3 rounded border transition-all text-center ${
                    selectedRole === 'RAD'
                      ? 'bg-rology-500/20 border-rology-500 text-rology-400'
                      : 'bg-rology-850 border-rology-700 text-gray-400 hover:border-rology-600'
                  }`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <div className="text-xs">Radiologist</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('ADMIN')}
                  className={`p-3 rounded border transition-all text-center ${
                    selectedRole === 'ADMIN'
                      ? 'bg-rology-500/20 border-rology-500 text-rology-400'
                      : 'bg-rology-850 border-rology-700 text-gray-400 hover:border-rology-600'
                  }`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <div className="text-xs">Admin</div>
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              onClick={handleLogin}
              className="w-full mt-4 px-6 py-3 bg-rology-500 hover:bg-rology-400 text-white font-semibold rounded transition-colors"
            >
              LOGIN
            </button>
          </div>
        </div>

        {/* New to us section */}
        <div className="mt-4 bg-rology-750 rounded-lg border border-rology-700 p-6 text-center">
          <p className="text-gray-400 text-sm mb-4">New to us?</p>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-rology-700 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-rology-700 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>Rology, Inc. © 2020-2024</p>
          <p className="mt-1">v develop</p>
        </div>

        {/* Demo Credentials */}
        <div className="mt-4 p-3 bg-rology-850 rounded border border-rology-700 text-xs">
          <p className="text-gray-500 mb-1">Demo Credentials:</p>
          <p className="text-gray-500"><span className="text-rology-400">Tech:</span> tech1 / tech123 | <span className="text-rology-400">Rad:</span> rad1 / rad123 | <span className="text-rology-400">Admin:</span> admin / admin123</p>
        </div>
      </div>
    </div>
  );
};

export default App;