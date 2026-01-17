import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, SessionRequest, AdminNotification } from '../types';

interface MedicalAdminDashboardProps {
  userId: string;
  userName: string;
  onLeave: () => void;
}

const MedicalAdminDashboard: React.FC<MedicalAdminDashboardProps> = ({ userId, userName, onLeave }) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [radiologists, setRadiologists] = useState<User[]>([]);
  const [sessionRequests, setSessionRequests] = useState<SessionRequest[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SessionRequest | null>(null);
  const [selectedRadiologist, setSelectedRadiologist] = useState<string>('');

  useEffect(() => {
    const defaultServerUrl = `http://${window.location.hostname}:3001`;
    const serverUrl = import.meta.env.VITE_SIGNALING_SERVER || defaultServerUrl;
    
    socketRef.current = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('register', { userId, userName, role: 'MEDICAL_ADMIN' });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('signal', (event: any) => {
      if (event.type === 'USER_LIST_UPDATE') {
        setTechnicians(event.payload.technicians || []);
        setRadiologists(event.payload.radiologists || []);
      }
      if (event.type === 'ROOM_REJECTED') {
        const newNotification: AdminNotification = {
          id: `notif-${Date.now()}`,
          type: 'RADIOLOGIST_REJECTED',
          message: `${event.payload.radiologistName} rejected assignment`,
          radiologistId: event.payload.radiologistId,
          radiologistName: event.payload.radiologistName,
          comment: event.payload.comment,
          timestamp: Date.now(),
          read: false
        };
        setNotifications(prev => [newNotification, ...prev]);
      }
      if (event.type === 'SESSION_ENDED') {
        const newNotification: AdminNotification = {
          id: `notif-${Date.now()}`,
          type: 'SESSION_ENDED',
          message: event.payload.reason || 'Session ended',
          timestamp: Date.now(),
          read: false
        };
        setNotifications(prev => [newNotification, ...prev]);
      }
    });

    socket.on('session-requests-update', (requests: SessionRequest[]) => {
      setSessionRequests(requests);
    });

    return () => { socket.disconnect(); };
  }, [userId, userName]);

  const handleAssign = () => {
    if (!selectedRequest || !selectedRadiologist || !socketRef.current) return;
    const radiologist = radiologists.find(r => r.id === selectedRadiologist);
    if (!radiologist) return;
    
    socketRef.current.emit('assign-radiologist', {
      requestId: selectedRequest.id,
      radiologistId: selectedRadiologist,
      radiologistName: radiologist.name
    });
    
    setSelectedRequest(null);
    setSelectedRadiologist('');
  };

  const handleEndSession = (requestId: string) => {
    if (!socketRef.current) {
      console.error('Socket not connected');
      return;
    }
    console.log('Sending end-session for:', requestId);
    socketRef.current.emit('end-session', { requestId });
  };

  const availableRadiologists = radiologists.filter(r => r.isAvailable);
  const pendingRequests = sessionRequests.filter(r => r.status === 'PENDING');
  const assignedRequests = sessionRequests.filter(r => r.status === 'ASSIGNED');
  const activeRequests = sessionRequests.filter(r => r.status === 'ACTIVE');

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
          <span className="text-xs text-gray-400">Medical Admin Console</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <span className="text-sm text-gray-300">{userName}</span>
          <button onClick={onLeave} className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Users */}
        <div className="w-64 bg-rology-900 border-r border-rology-700 flex flex-col">
          <div className="p-3 border-b border-rology-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Connected Users</h3>
          </div>
          
          {/* Technicians */}
          <div className="p-3 border-b border-rology-700">
            <h4 className="text-[10px] font-semibold text-rology-400 uppercase tracking-wider mb-2">
              Technicians ({technicians.length})
            </h4>
            {technicians.length === 0 ? (
              <p className="text-[10px] text-gray-600 italic">No technicians online</p>
            ) : (
              <div className="space-y-1">
                {technicians.map(tech => (
                  <div key={tech.id} className="flex items-center gap-2 p-2 bg-rology-800 rounded text-xs">
                    <div className="w-6 h-6 bg-rology-700 rounded-full flex items-center justify-center text-rology-400 text-[10px]">
                      {tech.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white">{tech.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Radiologists */}
          <div className="p-3 flex-1 overflow-y-auto">
            <h4 className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-2">
              Radiologists ({radiologists.length})
            </h4>
            {radiologists.length === 0 ? (
              <p className="text-[10px] text-gray-600 italic">No radiologists online</p>
            ) : (
              <div className="space-y-1">
                {radiologists.map(rad => (
                  <div key={rad.id} className="flex items-center gap-2 p-2 bg-rology-800 rounded text-xs">
                    <div className="w-6 h-6 bg-rology-700 rounded-full flex items-center justify-center text-green-400 text-[10px]">
                      {rad.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-white">{rad.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      rad.isAvailable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {rad.isAvailable ? 'Available' : 'Busy'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center - Session Requests */}
        <div className="flex-1 bg-rology-950 flex flex-col">
          <div className="p-3 border-b border-rology-700 bg-rology-900">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Session Requests</h3>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Pending */}
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-3">
                Pending ({pendingRequests.length})
              </h4>
              {pendingRequests.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No pending requests</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="p-4 bg-rology-800 rounded border border-yellow-500/30">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium text-sm">{request.technicianName}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">Pending</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-3">Room: <span className="font-mono text-white">{request.roomId}</span></p>
                      <button
                        onClick={() => setSelectedRequest(request)}
                        disabled={availableRadiologists.length === 0}
                        className="w-full px-3 py-2 bg-rology-500 hover:bg-rology-400 disabled:bg-rology-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
                      >
                        {availableRadiologists.length === 0 ? 'No radiologists available' : 'Assign Radiologist'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned */}
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-rology-400 uppercase tracking-wider mb-3">
                Assigned ({assignedRequests.length})
              </h4>
              {assignedRequests.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No assigned sessions</p>
              ) : (
                <div className="space-y-2">
                  {assignedRequests.map(request => (
                    <div key={request.id} className="p-3 bg-rology-800 rounded border border-rology-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-white text-sm">{request.technicianName}</span>
                        <span className="text-gray-500 mx-2">↔</span>
                        <span className="text-rology-400 text-sm">{request.assignedRadiologistName}</span>
                      </div>
                      <span className="text-[10px] text-gray-500">Waiting for radiologist</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active */}
            <div>
              <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3">
                Active ({activeRequests.length})
              </h4>
              {activeRequests.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No active sessions</p>
              ) : (
                <div className="space-y-2">
                  {activeRequests.map(request => (
                    <div key={request.id} className="p-3 bg-rology-800 rounded border border-green-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-white text-sm">{request.technicianName}</span>
                        <span className="text-gray-500 mx-2">↔</span>
                        <span className="text-green-400 text-sm">{request.assignedRadiologistName}</span>
                        <span className="ml-2 text-[10px] text-gray-500 font-mono">{request.roomId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded">In Progress</span>
                        <button
                          onClick={() => handleEndSession(request.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                        >
                          End Session
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Notifications */}
        <div className="w-64 bg-rology-900 border-l border-rology-700 flex flex-col">
          <div className="p-3 border-b border-rology-700 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notifications</h3>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-[10px] text-gray-600 italic">No notifications</p>
            ) : (
              <div className="space-y-2">
                {notifications.map(notif => (
                  <div key={notif.id} className={`p-3 rounded border ${
                    notif.read ? 'bg-rology-850 border-rology-700' : 'bg-red-900/20 border-red-800/30'
                  }`}>
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs text-white">{notif.message}</span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(notif.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {notif.comment && (
                      <p className="text-[10px] text-gray-400 italic">"{notif.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-rology-800 rounded-lg border border-rology-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Assign Radiologist</h3>
            
            <div className="mb-4 p-3 bg-rology-850 rounded border border-rology-700">
              <p className="text-xs text-gray-400">Technician</p>
              <p className="text-white">{selectedRequest.technicianName}</p>
              <p className="text-[10px] text-gray-500 mt-1">Room: {selectedRequest.roomId}</p>
            </div>
            
            <div className="mb-6">
              <label className="block text-xs text-gray-400 mb-2">Select Radiologist</label>
              <select
                value={selectedRadiologist}
                onChange={(e) => setSelectedRadiologist(e.target.value)}
                className="w-full bg-rology-900 border border-rology-700 rounded px-4 py-2 text-white text-sm"
              >
                <option value="">Choose a radiologist...</option>
                {availableRadiologists.map(rad => (
                  <option key={rad.id} value={rad.id}>{rad.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedRequest(null); setSelectedRadiologist(''); }}
                className="flex-1 px-4 py-2 bg-rology-700 hover:bg-rology-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedRadiologist}
                className="flex-1 px-4 py-2 bg-rology-500 hover:bg-rology-400 disabled:bg-rology-700 disabled:text-gray-500 text-white font-bold rounded transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalAdminDashboard;
