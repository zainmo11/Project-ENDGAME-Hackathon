import React, { useState } from 'react';
import { UserRole } from './types';
import TechDashboard from './components/TechDashboard';
import RadDashboard from './components/RadDashboard';

const App: React.FC = () => {
  const [route, setRoute] = useState<'LANDING' | 'TECH' | 'RAD'>('LANDING');
  const [roomId, setRoomId] = useState('');

  const handleJoin = (targetRoute: 'TECH' | 'RAD') => {
    if (!roomId.trim()) {
      alert("Please enter a Room ID (e.g. 101)");
      return;
    }
    setRoute(targetRoute);
  };

  if (route === 'TECH') {
    return <TechDashboard roomId={roomId} onLeave={() => setRoute('LANDING')} />;
  }

  if (route === 'RAD') {
    return <RadDashboard roomId={roomId} onLeave={() => setRoute('LANDING')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rology-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">

        {/* Left: Branding */}
        <div className="space-y-6">
          <div className="inline-block px-3 py-1 bg-rology-accent/10 text-rology-accent text-sm font-bold rounded-full border border-rology-accent/20">
            Project ENDGAME Hackathon
          </div>
          <h1 className="text-5xl font-extrabold text-white leading-tight">
            Live Ultrasound <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rology-400 to-rology-accent">Tele-Collaboration</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Connect remote clinics with expert radiologists instantly.
            Real-time streaming, remote control, and AI-powered reporting.
          </p>

          <div className="pt-8 grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-2xl font-bold text-white mb-1">50%</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Faster TAT</div>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-2xl font-bold text-white mb-1">24/7</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Expert Access</div>
            </div>
          </div>
        </div>

        {/* Right: Login Card */}
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">Start Demo Session</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Room Code</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. US-101"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rology-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                onClick={() => handleJoin('TECH')}
                className="group relative w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl border border-slate-600 transition-all"
              >
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:text-white group-hover:bg-blue-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                </div>
                <div className="text-left">
                  <div className="font-bold">Enter as Tech</div>
                  <div className="text-xs text-slate-400">Modality Side</div>
                </div>
              </button>

              <button
                onClick={() => handleJoin('RAD')}
                className="group relative w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl border border-slate-600 transition-all"
              >
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover:text-white group-hover:bg-emerald-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div className="text-left">
                  <div className="font-bold">Enter as Radiologist</div>
                  <div className="text-xs text-slate-400">Remote Expert</div>
                </div>
              </button>
            </div>
          </div>

          {/* Powered by Rology branding */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <span className="text-xs text-slate-500">Powered by</span>
            <img src="/rology.png" alt="Rology" className="h-5 w-auto" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;