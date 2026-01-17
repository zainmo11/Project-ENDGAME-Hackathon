import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { UserRole, ChatMessage, RoomAssignment } from '../types';
import DicomViewer from './DicomViewer';

interface RadDashboardProps {
  userId: string;
  userName: string;
  onLeave: () => void;
}

type RadStatus = 'LOBBY' | 'ACTIVE';

const RadDashboard: React.FC<RadDashboardProps> = ({ userId, userName, onLeave }) => {
  const [radStatus, setRadStatus] = useState<RadStatus>('LOBBY');
  const [isAvailable, setIsAvailable] = useState(true);
  const [roomId, setRoomId] = useState<string>('');
  const [technicianName, setTechnicianName] = useState<string>('');
  const [pendingInvite, setPendingInvite] = useState<RoomAssignment | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const mainSocketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  // View mode - video or study
  const [viewMode, setViewMode] = useState<'video' | 'study'>('study');

  // Study controls - synced between tech and rad
  const [gain, setGain] = useState(50);
  const [depth, setDepth] = useState(15);
  const [frame, setFrame] = useState(0);

  const DICOM_FILES = Array.from({ length: 9 }, (_, i) => 
    `/dicom_viewer_0002/IMG-0001-${String(i + 1).padStart(5, '0')}.dcm`
  );

  // WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [remoteConnected, setRemoteConnected] = useState(false);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    const defaultServerUrl = `http://${window.location.hostname}:3001`;
    const serverUrl = import.meta.env.VITE_SIGNALING_SERVER || defaultServerUrl;
    
    mainSocketRef.current = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const socket = mainSocketRef.current;

    socket.on('connect', () => {
      setIsServerConnected(true);
      socket.emit('register', { userId, userName, role: 'RADIOLOGIST' });
    });

    socket.on('disconnect', () => setIsServerConnected(false));

    socket.on('signal', (event: any) => {
      if (event.type === 'ROOM_INVITE') {
        setPendingInvite(event.payload);
      }
      if (event.type === 'SESSION_ENDED') {
        // Session was ended by admin or technician left
        cleanupWebRTC();
        setRadStatus('LOBBY');
        setRoomId('');
        setTechnicianName('');
        setMessages([]);
        setRemoteConnected(false);
        setPendingInvite(null);
        setPendingInvite(null);
        console.log('Session ended:', event.payload.reason);
      }
      if (event.type === 'CHAT') {
        setMessages(prev => [...prev, event.payload]);
      }
      // Sync study controls
      if (event.type === 'SYNC_STATE') {
        if (event.payload.gain !== undefined) setGain(event.payload.gain);
        if (event.payload.depth !== undefined) setDepth(event.payload.depth);
        if (event.payload.frame !== undefined) setFrame(event.payload.frame);
      }
      // WebRTC signaling
      if (event.type === 'OFFER') {
        handleOffer(event.payload);
      }
      if (event.type === 'ANSWER') {
        handleAnswer(event.payload);
      }
      if (event.type === 'ICE_CANDIDATE') {
        handleIceCandidate(event.payload);
      }
    });

    socket.on('join-room', ({ roomId }: { roomId: string }) => {
      setRoomId(roomId);
      setRadStatus('ACTIVE');
      // Join the socket room for messaging
      socket.emit('join', { roomId, role: 'RADIOLOGIST' });
    });

    return () => { 
      socket.disconnect(); 
      cleanupWebRTC();
    };
  }, [userId, userName]);

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // WebRTC Functions
  const startWebRTC = async (isInitiator: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track: ${event.track.kind}`);
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.muted = false; // Ensure not muted
          remoteVideoRef.current.play().catch(e => console.error('Error playing remote video:', e));
          setRemoteConnected(true);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && mainSocketRef.current) {
          mainSocketRef.current.emit('signal', {
            type: 'ICE_CANDIDATE',
            payload: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setRemoteConnected(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setRemoteConnected(false);
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        mainSocketRef.current?.emit('signal', {
          type: 'OFFER',
          payload: offer
        });
      }
    } catch (error: any) {
      console.error('Error starting WebRTC:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Camera access denied. Please allow camera access in your browser settings.');
      } else if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        alert('Camera access blocked! Browsers block camera on http:// (remote IP). Please check the instructions provided or use localhost.');
      } else {
        alert(`Camera error: ${error.message || 'Could not access camera'}`);
      }
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      await startWebRTC(false);
    }
    const pc = peerConnectionRef.current;
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    mainSocketRef.current?.emit('signal', {
      type: 'ANSWER',
      payload: answer
    });
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const cleanupWebRTC = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const handleAvailabilityChange = (available: boolean) => {
    setIsAvailable(available);
    mainSocketRef.current?.emit('set-availability', { available });
  };

  const handleAcceptInvite = () => {
    if (!pendingInvite || !mainSocketRef.current) return;
    mainSocketRef.current.emit('respond-to-assignment', {
      assignmentId: pendingInvite.id,
      accept: true
    });
    setRoomId(pendingInvite.roomId);
    setTechnicianName(pendingInvite.technicianName);
    setPendingInvite(null);
    setRadStatus('ACTIVE');
    // Start WebRTC (radiologist responds to offer)
    startWebRTC(false);
  };

  const handleRejectInvite = () => {
    if (!pendingInvite || !mainSocketRef.current) return;
    mainSocketRef.current.emit('respond-to-assignment', {
      assignmentId: pendingInvite.id,
      accept: false,
      comment: rejectComment || 'No reason provided'
    });
    setPendingInvite(null);
    setShowRejectModal(false);
    setRejectComment('');
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !mainSocketRef.current) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: userName,
      role: UserRole.RADIOLOGIST,
      text: newMessage,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
    mainSocketRef.current.emit('signal', { type: 'CHAT', payload: msg });
    setNewMessage('');
  };

  const handleEndSession = () => {
    if (!mainSocketRef.current || !pendingInvite && !roomId) return;
    if (confirm('Are you sure you want to end this session?')) {
        // Find requestId (not directly stored in RadDashboard state, but room ID is key)
        // Since we don't have requestId easily, we'll implement a room-based disconnect
        // For now, simpler to just disconnect which triggers auto-cleanup on server
        // OR emit 'end-session-by-room' which we need to implement on server
        // Let's use the existing 'end-session' but we need requestId.
        // Actually, tech disconnect triggers cleanup. Rad disconnect does too?
        // Let's implement 'leave-session' event on server for cleaner exit.
        mainSocketRef.current.emit('leave-session', { roomId });
    }
  };

  return (
    <div className="min-h-screen bg-rology-950 flex flex-col">
      {/* Header */}
      <header className="h-12 bg-rology-800 border-b border-rology-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-rology-500 rounded flex items-center justify-center text-white font-bold text-xs">R</div>
            <span className="text-sm font-bold text-white">ROLOGY</span>
          </div>
          <div className="w-px h-6 bg-rology-700"></div>
          <span className="text-xs text-gray-400">Radiologist Console</span>
          <span className="text-[10px] text-gray-500 ml-2">Simply, we save lives. ❤️</span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Availability Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Status:</span>
            <button onClick={() => handleAvailabilityChange(!isAvailable)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isAvailable ? 'bg-green-500' : 'bg-gray-600'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isAvailable ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className={`text-xs ${isAvailable ? 'text-green-400' : 'text-gray-400'}`}>
              {isAvailable ? 'Available' : 'Busy'}
            </span>
          </div>

          <div className={`flex items-center gap-2 text-xs ${isServerConnected ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isServerConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            {isServerConnected ? 'Connected' : 'Disconnected'}
          </div>
          <span className="text-sm text-gray-300">{userName}</span>
          <button onClick={onLeave} className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors">
            Logout
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="h-10 bg-rology-850 border-b border-rology-700 flex items-center px-4 gap-4">
        <button onClick={toggleVideo}
          className={`flex items-center gap-2 text-xs transition-colors ${isVideoEnabled ? 'text-green-400' : 'text-red-400'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isVideoEnabled ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            )}
          </svg>
          {isVideoEnabled ? 'Video On' : 'Video Off'}
        </button>
        <button onClick={toggleAudio}
          className={`flex items-center gap-2 text-xs transition-colors ${isAudioEnabled ? 'text-green-400' : 'text-red-400'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isAudioEnabled ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            )}
          </svg>
          {isAudioEnabled ? 'Mic On' : 'Mic Off'}
        </button>
        <div className="w-px h-5 bg-rology-700"></div>
        <button className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
          Zoom
        </button>
        <div className="w-px h-5 bg-rology-700"></div>
        <button 
          onClick={handleEndSession}
          disabled={radStatus !== 'ACTIVE'}
          className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          End Session
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Resizable */}
        <div style={{ width: sidebarWidth }} className="bg-rology-900 border-r border-rology-700 flex flex-col shrink-0">
          <div className="p-4 flex flex-col h-full overflow-hidden">
            {/* Session Section */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Session</h3>
              <div className="p-3 bg-rology-800 rounded border border-rology-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${radStatus === 'ACTIVE' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-sm text-white">{radStatus === 'ACTIVE' ? 'In Session' : 'Waiting'}</span>
                </div>
                {radStatus === 'ACTIVE' ? (
                  <div className="text-xs text-gray-400">
                    <p>Room: <span className="text-white font-mono">{roomId}</span></p>
                    <p>Tech: <span className="text-rology-400">{technicianName}</span></p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    {isAvailable ? 'Waiting for assignments...' : 'Marked as unavailable'}
                  </p>
                )}
              </div>
            </div>

            {/* Local Video Preview */}
            {radStatus === 'ACTIVE' && (
              <div className="mb-4">
                <h4 className="text-xs text-gray-500 mb-2">Your Camera</h4>
                <div className="relative aspect-video bg-black rounded border border-rology-700 overflow-hidden">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-rology-800 flex items-center justify-center">
                      <span className="text-xs text-gray-500">Camera Off</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Medical Info - Only in Active */}
            {radStatus === 'ACTIVE' && (
              <div className="mb-4 pb-4 border-b border-rology-700">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Medical Info</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex"><span className="text-gray-500 w-20">Name</span><span className="text-white">Demo Patient</span></div>
                  <div className="flex"><span className="text-gray-500 w-20">Gender</span><span className="text-white">Male</span></div>
                  <div className="flex"><span className="text-gray-500 w-20">Admission</span><span className="text-red-400">ER</span></div>
                </div>
              </div>
            )}

            {/* Chat Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 shrink-0">Chat</h3>
              <div className="flex-1 overflow-y-auto space-y-2 mb-2 min-h-0">
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No messages</p>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`p-2 rounded text-xs ${msg.role === UserRole.RADIOLOGIST ? 'bg-rology-700 ml-2' : 'bg-rology-800 mr-2'}`}>
                      <p className="text-gray-500 text-[10px]">{msg.sender}</p>
                      <p className="text-white break-words">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Message..." disabled={radStatus !== 'ACTIVE'}
                  className="flex-1 min-w-0 bg-rology-800 border border-rology-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 disabled:opacity-50" />
                <button onClick={handleSendMessage} disabled={radStatus !== 'ACTIVE'}
                  className="px-3 py-2 bg-rology-500 hover:bg-rology-400 disabled:bg-rology-700 text-white rounded text-sm transition-colors shrink-0">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div onMouseDown={() => setIsResizing(true)}
          className={`w-1 cursor-col-resize hover:bg-rology-500/50 transition-colors ${isResizing ? 'bg-rology-500' : 'bg-rology-700'}`} />

        {/* Main Viewer Area */}
        <div className="flex-1 bg-black flex flex-col min-w-0">
          {/* Patient Info Bar */}
          <div className="h-8 bg-rology-850 border-b border-rology-700 flex items-center justify-between px-4 text-xs shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-rology-400 font-semibold">LIVE ULTRASOUND</span>
              <span className="text-gray-500">Room: {roomId || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-rology-800 rounded overflow-hidden">
                <button
                  onClick={() => setViewMode('study')}
                  className={`px-3 py-1 text-xs transition-colors ${viewMode === 'study' ? 'bg-rology-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Study
                </button>
                <button
                  onClick={() => setViewMode('video')}
                  className={`px-3 py-1 text-xs transition-colors ${viewMode === 'video' ? 'bg-rology-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Video
                </button>
              </div>
              {remoteConnected && <span className="text-green-400">● Technician Connected</span>}
              <span className="text-gray-500">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Display Area */}
          <div className="flex-1 flex items-center justify-center">
            {radStatus === 'ACTIVE' ? (
              <div className="w-full h-full flex gap-2 p-2">
                {/* DICOM Study Viewer - Always visible in active session */}
                <div className={`relative bg-rology-900 rounded-lg overflow-hidden border border-rology-700 ${viewMode === 'study' ? 'flex-1' : 'w-1/3'}`}>
                  <DicomViewer 
                    urls={DICOM_FILES} 
                    className="w-full h-full" 
                    gain={gain} 
                    depth={depth}
                    frame={frame}
                    onFrameChange={(newFrame) => {
                      setFrame(newFrame);
                      if (mainSocketRef.current) {
                        mainSocketRef.current.emit('signal', { 
                          type: 'SYNC_STATE', 
                          payload: { frame: newFrame } 
                        });
                      }
                    }}
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-[10px] text-cyan-400">
                    ULTRASOUND STUDY
                  </div>
                  {/* Study Controls */}
                  <div className="absolute bottom-2 right-2 bg-black/80 rounded p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-400 w-10">Gain</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={gain}
                        onChange={(e) => {
                          const newGain = parseInt(e.target.value);
                          setGain(newGain);
                          mainSocketRef.current?.emit('signal', { type: 'SYNC_STATE', payload: { gain: newGain, depth } });
                        }}
                        className="w-20 h-1 accent-cyan-400"
                      />
                      <span className="text-[10px] text-white w-6">{gain}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-400 w-10">Depth</label>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        value={depth}
                        onChange={(e) => {
                          const newDepth = parseInt(e.target.value);
                          setDepth(newDepth);
                          mainSocketRef.current?.emit('signal', { type: 'SYNC_STATE', payload: { gain, depth: newDepth } });
                        }}
                        className="w-20 h-1 accent-cyan-400"
                      />
                      <span className="text-[10px] text-white w-6">{depth}</span>
                    </div>
                  </div>
                </div>
                
                {/* Video Call - Technician */}
                <div className={`relative bg-rology-900 rounded-lg overflow-hidden border border-rology-700 ${viewMode === 'video' ? 'flex-1' : 'w-1/3'}`}>
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  {!remoteConnected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-rology-900">
                      <div className="text-center">
                        <div className="animate-pulse w-12 h-12 bg-rology-800 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 text-xs">Connecting...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-[10px] text-white">
                    {technicianName || 'Technician'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 bg-rology-800 rounded-lg flex items-center justify-center mx-auto mb-4 border border-rology-700">
                  <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500">No Active Session</p>
                <p className="text-gray-600 text-sm mt-1">Waiting for session assignment</p>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="h-6 bg-rology-850 border-t border-rology-700 flex items-center justify-between px-4 text-[10px] shrink-0">
            <span className="text-gray-500">Rology © 2024</span>
            <span className={`${radStatus === 'ACTIVE' ? 'text-green-400' : 'text-gray-500'}`}>
              Status: {radStatus === 'ACTIVE' ? 'ASSIGNED' : 'WAITING'}
            </span>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-48 bg-rology-900 border-l border-rology-700 p-3 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tools</h3>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-2 p-2 bg-rology-800 hover:bg-rology-700 rounded text-xs text-gray-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Old Studies
            </button>
            <button className="w-full flex items-center gap-2 p-2 bg-rology-800 hover:bg-rology-700 rounded text-xs text-gray-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Report
            </button>
          </div>
        </div>
      </div>

      {/* Room Invite Modal */}
      {pendingInvite && !showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-rology-800 rounded-lg border border-rology-700 p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-rology-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-rology-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Session Invitation</h3>
              <p className="text-gray-400 text-sm mt-1">You've been assigned to a session</p>
            </div>
            
            <div className="p-4 bg-rology-850 rounded border border-rology-700 mb-6 space-y-2 text-sm">
              <div><span className="text-gray-400">Technician:</span> <span className="text-white ml-2">{pendingInvite.technicianName}</span></div>
              <div><span className="text-gray-400">Room:</span> <span className="text-white font-mono ml-2">{pendingInvite.roomId}</span></div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(true)}
                className="flex-1 px-4 py-2 bg-rology-700 hover:bg-rology-600 text-white rounded transition-colors">
                Decline
              </button>
              <button onClick={handleAcceptInvite}
                className="flex-1 px-4 py-2 bg-rology-500 hover:bg-rology-400 text-white font-bold rounded transition-colors">
                Accept & Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && pendingInvite && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-rology-800 rounded-lg border border-rology-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Decline Session</h3>
            <p className="text-gray-400 text-sm mb-4">Please provide a reason for declining.</p>
            <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)}
              placeholder="e.g., Currently busy..."
              className="w-full bg-rology-900 border border-rology-700 rounded px-4 py-3 text-white text-sm resize-none h-20" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 bg-rology-700 hover:bg-rology-600 text-white rounded transition-colors">
                Cancel
              </button>
              <button onClick={handleRejectInvite}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-colors">
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RadDashboard;