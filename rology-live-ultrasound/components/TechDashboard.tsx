import React, { useState, useEffect, useRef } from 'react';
import { UserRole, ChatMessage, SessionState } from '../types';
import MockSignalingService from '../services/mockSignaling';
import UltrasoundCanvas from './UltrasoundCanvas';
import Chat from './Chat';

interface TechDashboardProps {
  roomId: string;
  onLeave: () => void;
}

const TechDashboard: React.FC<TechDashboardProps> = ({ roomId, onLeave }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gain, setGain] = useState(50);
  const [depth, setDepth] = useState(15);
  const [isLive, setIsLive] = useState(false);
  const signaling = useRef<MockSignalingService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Initialize Signaling
    signaling.current = new MockSignalingService(roomId);
    
    // Subscribe to events
    const unsubscribe = signaling.current.subscribe((event) => {
      if (event.type === 'CHAT') {
        setMessages(prev => [...prev, event.payload]);
      } else if (event.type === 'SYNC_STATE') {
        // In a real app, we might sync remotely controlled params here
        if (event.payload.gain !== undefined) setGain(event.payload.gain);
        if (event.payload.depth !== undefined) setDepth(event.payload.depth);
      }
    });

    // Notify join
    signaling.current.send({
      type: 'JOIN',
      payload: { role: UserRole.TECH, roomId }
    });

    return () => {
      unsubscribe();
      signaling.current?.close();
    };
  }, [roomId]);

  // Sync state changes to Radiologist
  useEffect(() => {
    signaling.current?.send({
      type: 'SYNC_STATE',
      payload: { gain, depth, isLive }
    });
  }, [gain, depth, isLive]);

  const handleSendMessage = (text: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'Tech (You)',
      role: UserRole.TECH,
      text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
    signaling.current?.send({ type: 'CHAT', payload: msg });
  };

  const toggleLive = async () => {
    if (!isLive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsLive(true);
      } catch (e) {
        alert("Camera permission denied or not available. Using Simulation only.");
        setIsLive(true); // Fallback to just sim state
      }
    } else {
      // Stop tracks
      const stream = localVideoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsLive(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-rology-900 text-slate-100">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
          <span className="font-bold tracking-wide">ROLOGY <span className="text-rology-accent font-light">LIVE</span></span>
          <span className="ml-4 text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">ROOM: {roomId}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleLive} className={`px-4 py-1.5 rounded font-semibold text-sm transition-colors ${isLive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {isLive ? 'Stop Sharing' : 'Start Live Session'}
          </button>
          <button onClick={onLeave} className="text-slate-400 hover:text-white">Leave</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Controls & Webcam */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-6 overflow-y-auto">
          
          {/* Webcam Preview */}
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-600 relative">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 px-2 py-0.5 rounded">Operator Cam</div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <h3 className="text-rology-accent font-mono text-xs uppercase mb-2">Probe Settings</h3>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Gain</span>
                <span>{gain}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={gain} 
                onChange={e => setGain(Number(e.target.value))}
                className="w-full accent-rology-accent h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Depth</span>
                <span>{depth}cm</span>
              </div>
              <input 
                type="range" min="5" max="30" value={depth} 
                onChange={e => setDepth(Number(e.target.value))}
                className="w-full accent-rology-accent h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
             <div className="p-3 bg-slate-700/30 rounded border border-slate-700">
               <div className="text-xs text-slate-400 mb-2">Status</div>
               <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                 <span className="text-sm font-medium">{isLive ? 'Broadcasting' : 'Standby'}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Center: Ultrasound Feed */}
        <div className="flex-1 bg-black p-4 flex items-center justify-center relative">
          <div className="w-full max-w-4xl aspect-[4/3] relative">
            <UltrasoundCanvas gain={gain} depth={depth} />
            
            {/* Overlay UI for Demo Purposes */}
            <div className="absolute top-4 left-4 text-white/80 font-mono text-sm pointer-events-none">
              <div>PT: JOHN DOE</div>
              <div>ID: 123456789</div>
              <div>DOB: 01/01/1980</div>
            </div>
            <div className="absolute top-4 right-4 text-white/80 font-mono text-sm pointer-events-none text-right">
              <div>CARDIAC</div>
              <div>PRESET: ADULT</div>
              <div>{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="w-80 bg-slate-900 border-l border-slate-700 p-4">
          <Chat messages={messages} role={UserRole.TECH} onSendMessage={handleSendMessage} />
        </div>
      </main>
    </div>
  );
};

export default TechDashboard;