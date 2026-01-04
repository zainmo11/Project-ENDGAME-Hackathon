import React, { useState, useEffect, useRef } from 'react';
import { UserRole, ChatMessage, Annotation } from '../types';
import RealSignalingService from '../services/realSignaling';
import DicomViewer from './DicomViewer';
import Chat from './Chat';
import ReportSidebar from './ReportSidebar';
import { useWebRTCVoice } from '../hooks/useWebRTCVoice';
import { ReportData } from '../utils/pdfGenerator';

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
  const [isConnected, setIsConnected] = useState(false);
  const [isCamExpanded, setIsCamExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320); // w-80 = 320px
  const [isResizing, setIsResizing] = useState(false);

  const signaling = useRef<RealSignalingService | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const streamRef = useRef<MediaStream | null>(null); // Prevent camera recreation

  // WebRTC Voice
  const { isVoiceActive, isMuted, isRemoteConnected, startVoice, stopVoice, toggleMute } = useWebRTCVoice({
    socket,
    isConnected
  });

  useEffect(() => {
    signaling.current = new RealSignalingService(roomId, 'RADIOLOGIST');

    // Subscribe to connection changes
    const unsubConnection = signaling.current.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setSocket(signaling.current?.getSocket() || null);
      }
    });

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

    return () => {
      unsubscribe();
      unsubConnection();
      signaling.current?.close();
    };
  }, [roomId]);

  // Hacky simulation of receiving a stream for the demo without a TURN server
  const simulateRemoteStream = async () => {
    // Only start stream once
    if (streamRef.current) return;

    try {
      // In a real app, this comes from WebRTC peer. 
      // For localhost demo, we just grab local cam to show "video is working"
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
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
    const ctx = annotationCanvasRef.current?.getContext('2d');
    if (ctx && annotationCanvasRef.current) {
      ctx.clearRect(0, 0, annotationCanvasRef.current.width, annotationCanvasRef.current.height);
    }
    setAnnotations([]);
  };

  // Sidebar resize handlers
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleResize = (e: MouseEvent) => {
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 240 && newWidth <= 600) {
      setSidebarWidth(newWidth);
    }
  };

  const stopResize = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
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
          {/* Voice Controls */}
          {!isVoiceActive ? (
            <button
              onClick={startVoice}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              Connect Voice
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`p-2 rounded ${isMuted ? 'bg-red-600' : 'bg-green-600'} hover:opacity-80`}
              >
                {isMuted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                )}
              </button>
              <span className={`text-xs ${isRemoteConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                {isRemoteConnected ? '🎙️ Voice Active' : '⏳ Waiting...'}
              </span>
              <button
                onClick={stopVoice}
                className="text-xs text-red-400 hover:text-red-300"
              >
                End Voice
              </button>
            </>
          )}
          <button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-4 py-1.5 bg-rology-accent text-slate-900 font-bold rounded hover:bg-cyan-400 transition">
            Generate Report
          </button>
          <button onClick={onLeave} className="text-slate-400 hover:text-white">Exit Session</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Report Sidebar - Left */}
        {showReport && (
          <ReportSidebar
            onClose={() => setShowReport(false)}
            onSendReport={(reportData: ReportData) => {
              signaling.current?.send({ type: 'REPORT_READY', payload: JSON.stringify(reportData) });
            }}
          />
        )}

        {/* Center: Remote View */}
        <div className="flex-1 flex flex-col bg-black relative">

          <div className="flex-1 flex items-center justify-center relative p-4">
            <div className="relative w-full max-w-4xl aspect-[4/3] border border-slate-700 bg-black">
              {/* The Ultrasound Feed */}
              <DicomViewer gain={remoteGain} depth={remoteDepth} className="w-full h-full" />

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
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="text-xs text-slate-400">
                {isConnected ? 'Server Connected' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={startResize}
          className={`w-1 cursor-col-resize hover:bg-rology-accent/50 transition-colors ${isResizing ? 'bg-rology-accent' : 'bg-slate-700'}`}
        />

        {/* Right: Sidebar */}
        <div style={{ width: sidebarWidth }} className="flex flex-col border-l border-slate-700 bg-slate-900 shrink-0">
          {/* Remote Webcam - Expandable */}
          <div className={`${isCamExpanded ? 'h-80' : 'h-48'} bg-black border-b border-slate-700 relative transition-all duration-300`}>
            <video ref={remoteVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 px-2 py-0.5 rounded">Tech Room Cam</div>
            <button
              onClick={() => setIsCamExpanded(!isCamExpanded)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded transition"
              title={isCamExpanded ? 'Shrink' : 'Expand'}
            >
              {isCamExpanded ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4M12 4v16" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              )}
            </button>
          </div>

          {/* Chat */}
          <div className="flex-1 p-4 overflow-hidden">
            <Chat messages={messages} role={UserRole.RADIOLOGIST} onSendMessage={handleSendMessage} />
          </div>
        </div>
      </main>

    </div>
  );
};

export default RadDashboard;