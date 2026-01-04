import React, { useState, useEffect, useRef } from 'react';
import { UserRole, ChatMessage, SessionState } from '../types';
import RealSignalingService from '../services/realSignaling';
import DicomViewer from './DicomViewer';
import Chat from './Chat';
import { useWebRTCVoice } from '../hooks/useWebRTCVoice';
import { useWebRTCVideo } from '../hooks/useWebRTCVideo';
import { generateReportPDF, downloadPDF, ReportData } from '../utils/pdfGenerator';

interface TechDashboardProps {
  roomId: string;
  onLeave: () => void;
}

const TechDashboard: React.FC<TechDashboardProps> = ({ roomId, onLeave }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gain, setGain] = useState(50);
  const [depth, setDepth] = useState(15);
  const [isLive, setIsLive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedReport, setReceivedReport] = useState<string | null>(null);
  const signaling = useRef<RealSignalingService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [socket, setSocket] = useState<any>(null);

  // WebRTC Voice
  const { isVoiceActive, isMuted, isRemoteConnected, startVoice, stopVoice, toggleMute } = useWebRTCVoice({
    socket,
    isConnected
  });

  // WebRTC Video (bidirectional - Tech sends and receives)
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const { isVideoActive, isRemoteConnected: isVideoRemoteConnected, startVideo, stopVideo } = useWebRTCVideo({
    socket,
    isConnected,
    localVideoRef,
    remoteVideoRef,
    role: 'TECH',
  });

  useEffect(() => {
    // Initialize Signaling with real WebSocket
    signaling.current = new RealSignalingService(roomId, 'TECH');

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
        // Sync remotely controlled params
        if (event.payload.gain !== undefined) setGain(event.payload.gain);
        if (event.payload.depth !== undefined) setDepth(event.payload.depth);
      } else if (event.type === 'REPORT_READY') {
        // Report received from Radiologist
        setReceivedReport(event.payload);
      }
    });

    return () => {
      unsubscribe();
      unsubConnection();
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
        // Start WebRTC video streaming to Radiologist
        await startVideo();
        setIsLive(true);
      } catch (e) {
        alert("Camera permission denied or not available.");
      }
    } else {
      // Stop WebRTC video
      stopVideo();
      setIsLive(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-rology-900 text-slate-100">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-bold tracking-wide">ROLOGY <span className="text-rology-accent font-light">LIVE</span></span>
          <span className="ml-4 text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">ROOM: {roomId}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${isConnected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
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

          {/* Webcam Preview - Operator */}
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-600 relative">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 px-2 py-0.5 rounded">Operator Cam</div>
          </div>

          {/* Radiologist Camera - Remote */}
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-600 relative">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[10px] bg-black/50 px-2 py-0.5 rounded">
              <div className={`w-2 h-2 rounded-full ${isVideoRemoteConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
              <span>{isVideoRemoteConnected ? 'Radiologist Cam (Live)' : 'Radiologist Cam (Waiting...)'}</span>
            </div>
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
            <DicomViewer gain={gain} depth={depth} className="w-full h-full" />

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

      {/* Received Report Modal */}
      {receivedReport && (() => {
        // Try to parse JSON report, fallback to plain text
        let reportData: ReportData | null = null;
        try {
          reportData = JSON.parse(receivedReport);
        } catch (e) {
          // Not JSON, display as plain text
        }

        const handleDownloadPDF = async () => {
          if (reportData) {
            const blob = await generateReportPDF(reportData);
            downloadPDF(blob, `Report_${reportData.accessionNumber}.pdf`);
          }
        };

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-emerald-600 text-white p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="font-bold">Report Received from Radiologist!</span>
                </div>
                <button onClick={() => setReceivedReport(null)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {reportData ? (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-bold text-slate-800">{reportData.title}</h2>
                      <p className="text-slate-500 text-sm">Date: {reportData.date} | Acc: {reportData.accessionNumber}</p>
                    </div>

                    {/* Screenshot */}
                    {reportData.screenshotDataUrl && (
                      <div className="border rounded-lg overflow-hidden">
                        <img src={reportData.screenshotDataUrl} alt="Ultrasound" className="w-full" />
                      </div>
                    )}

                    {/* Findings */}
                    <div>
                      <h3 className="font-bold text-slate-700 uppercase text-sm mb-2">Findings</h3>
                      <p className="text-slate-600 leading-relaxed">{reportData.findings}</p>
                    </div>

                    {/* Measurements */}
                    <div>
                      <h3 className="font-bold text-slate-700 uppercase text-sm mb-2">Measurements</h3>
                      <pre className="font-mono text-sm text-slate-600 whitespace-pre-wrap">{reportData.measurements}</pre>
                    </div>

                    {/* Conclusion */}
                    <div>
                      <h3 className="font-bold text-slate-700 uppercase text-sm mb-2">Conclusion</h3>
                      <p className="text-slate-800 font-medium">{reportData.conclusion}</p>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm bg-slate-50 p-4 rounded border">{receivedReport}</pre>
                )}
              </div>

              <div className="bg-slate-50 p-4 border-t flex justify-between items-center">
                {reportData && (
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download PDF
                  </button>
                )}
                <button
                  onClick={() => setReceivedReport(null)}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded ml-auto"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TechDashboard;