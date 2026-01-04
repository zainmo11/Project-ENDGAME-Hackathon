import React, { useState, useEffect, useRef } from 'react';
import { UserRole, ChatMessage, Annotation } from '../types';
import MockSignalingService from '../services/mockSignaling';
import UltrasoundCanvas from './UltrasoundCanvas';
import Chat from './Chat';
import AIReportModal from './AIReportModal';

interface RadDashboardProps {
  roomId: string;
  onLeave: () => void;
}

const RadDashboard: React.FC<RadDashboardProps> = ({ roomId, onLeave }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteGain, setRemoteGain] = useState(50);
  const [remoteDepth, setRemoteDepth] = useState(15);
  const [isLive, setIsLive] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showReport, setShowReport] = useState(false);

  const signaling = useRef<MockSignalingService | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    signaling.current = new MockSignalingService(roomId);

    // Subscribe to events
    const unsubscribe = signaling.current.subscribe((event) => {
      if (event.type === 'CHAT') {
        setMessages(prev => [...prev, event.payload]);
      } else if (event.type === 'SYNC_STATE') {
        if (event.payload.gain !== undefined) setRemoteGain(event.payload.gain);
        if (event.payload.depth !== undefined) setRemoteDepth(event.payload.depth);
        if (event.payload.isLive !== undefined) {
          setIsLive(event.payload.isLive);
          if (event.payload.isLive) simulateRemoteStream();
        }
      }
    });

    signaling.current.send({
      type: 'JOIN',
      payload: { role: UserRole.RADIOLOGIST, roomId }
    });

    return () => {
      unsubscribe();
      signaling.current?.close();
    };
  }, [roomId]);

  // Hacky simulation of receiving a stream for the demo without a TURN server
  const simulateRemoteStream = async () => {
    try {
      // In a real app, this comes from WebRTC peer. 
      // For localhost demo, we just grab local cam to show "video is working"
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("Could not simulate remote stream via local cam");
    }
  };

  const handleSendMessage = (text: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'Dr. Rad',
      role: UserRole.RADIOLOGIST,
      text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
    signaling.current?.send({ type: 'CHAT', payload: msg });
  };

  // Remote Control Logic
  const updateRemoteSetting = (setting: 'gain' | 'depth', value: number) => {
    if (setting === 'gain') setRemoteGain(value);
    if (setting === 'depth') setRemoteDepth(value);

    signaling.current?.send({
      type: 'SYNC_STATE',
      payload: { [setting]: value }
    });
  };

  // Annotation Logic
  const startDrawing = (e: React.MouseEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = annotationCanvasRef.current?.getContext('2d');
    ctx?.beginPath(); // Reset path
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !annotationCanvasRef.current) return;
    const canvas = annotationCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ef4444'; // Red for annotation

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearAnnotations = () => {
    const canvas = annotationCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    ctx?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
  };

  return (
    <div className="flex flex-col h-screen bg-rology-900 text-slate-100">
      {/* Header */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/rology.png" alt="Rology" className="h-10 w-auto" />
          <span className="font-bold">Radiologist Console</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-4 py-1.5 bg-rology-accent text-slate-900 font-bold rounded hover:bg-cyan-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Generate AI Report
          </button>
          <button onClick={onLeave} className="text-slate-400 hover:text-white">Exit Session</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Remote View */}
        <div className="flex-1 flex flex-col bg-black relative">

          <div className="flex-1 flex items-center justify-center relative p-4">
            <div className="relative w-full max-w-4xl aspect-[4/3] border border-slate-700 bg-black">
              {/* The Ultrasound Feed */}
              <UltrasoundCanvas gain={remoteGain} depth={remoteDepth} />

              {/* Annotation Layer */}
              <canvas
                ref={annotationCanvasRef}
                width={800} // hardcoded for demo scale
                height={600}
                className="absolute inset-0 w-full h-full cursor-crosshair z-10"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onMouseLeave={stopDrawing}
              />

              {/* Connection Status Overlay */}
              {!isLive && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col gap-4 z-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rology-accent"></div>
                  <p className="text-slate-400 animate-pulse">Waiting for Tech to start stream...</p>
                </div>
              )}
            </div>
          </div>

          {/* Remote Controls Toolbar */}
          <div className="h-16 bg-slate-800 border-t border-slate-700 flex items-center px-6 gap-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">REMOTE GAIN</span>
              <input
                type="range" min="0" max="100" value={remoteGain}
                onChange={e => updateRemoteSetting('gain', Number(e.target.value))}
                className="w-32 accent-rology-accent h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">REMOTE DEPTH</span>
              <input
                type="range" min="5" max="30" value={remoteDepth}
                onChange={e => updateRemoteSetting('depth', Number(e.target.value))}
                className="w-32 accent-rology-accent h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="h-8 w-px bg-slate-600 mx-2"></div>
            <button onClick={clearAnnotations} className="text-xs text-red-400 hover:text-red-300 border border-red-900/50 bg-red-900/20 px-3 py-1 rounded">
              Clear Annotations
            </button>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-slate-400">WebRTC Connected (32ms)</span>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-80 flex flex-col border-l border-slate-700 bg-slate-900">
          {/* Remote Webcam */}
          <div className="h-48 bg-black border-b border-slate-700 relative">
            <video ref={remoteVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 px-2 py-0.5 rounded">Tech Room Cam</div>
          </div>

          {/* Chat */}
          <div className="flex-1 p-4 overflow-hidden">
            <Chat messages={messages} role={UserRole.RADIOLOGIST} onSendMessage={handleSendMessage} />
          </div>
        </div>
      </main>

      {/* AI Report Modal */}
      {showReport && <AIReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
};

export default RadDashboard;