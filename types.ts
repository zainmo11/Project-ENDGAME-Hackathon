export enum UserRole {
  TECH = 'TECH',
  RADIOLOGIST = 'RADIOLOGIST',
  MEDICAL_ADMIN = 'MEDICAL_ADMIN',
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: UserRole;
  text: string;
  timestamp: number;
}

export interface SessionState {
  roomId: string;
  isConnected: boolean;
  gain: number;
  depth: number;
  isLive: boolean;
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  color: string;
  text?: string;
}

// User info with availability status
export interface User {
  id: string;
  name: string;
  role: UserRole;
  isAvailable: boolean;
  socketId?: string;
}

// Session request from technician to medical admin
export interface SessionRequest {
  id: string;
  technicianId: string;
  technicianName: string;
  status: 'PENDING' | 'ASSIGNED' | 'ACTIVE' | 'REJECTED';
  assignedRadiologistId?: string;
  assignedRadiologistName?: string;
  roomId?: string;
  createdAt: number;
  rejectionComment?: string;
}

// Room assignment request from medical admin to radiologist
export interface RoomAssignment {
  id: string;
  roomId: string;
  technicianId: string;
  technicianName: string;
  radiologistId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  rejectionComment?: string;
}

// Notification for medical admin
export interface AdminNotification {
  id: string;
  type: 'RADIOLOGIST_REJECTED' | 'SESSION_REQUEST' | 'RADIOLOGIST_JOINED' | 'SESSION_ENDED';
  message: string;
  radiologistId?: string;
  radiologistName?: string;
  sessionRequestId?: string;
  comment?: string;
  timestamp: number;
  read: boolean;
}

// Events sent via BroadcastChannel to simulate WebRTC/Socket.io
export type SignalingEvent = 
  | { type: 'JOIN'; payload: { role: UserRole; roomId: string; userId?: string; userName?: string } }
  | { type: 'SYNC_STATE'; payload: Partial<SessionState> }
  | { type: 'CHAT'; payload: ChatMessage }
  | { type: 'ANNOTATION'; payload: Annotation }
  | { type: 'REQUEST_REPORT'; payload: null }
  | { type: 'REPORT_READY'; payload: string }
  // Session management events
  | { type: 'SESSION_REQUEST'; payload: SessionRequest }
  | { type: 'SESSION_ASSIGNED'; payload: SessionRequest }
  | { type: 'ROOM_INVITE'; payload: RoomAssignment }
  | { type: 'ROOM_ACCEPTED'; payload: { assignmentId: string; radiologistId: string } }
  | { type: 'ROOM_REJECTED'; payload: { assignmentId: string; radiologistId: string; radiologistName: string; comment: string } }
  | { type: 'AVAILABILITY_UPDATE'; payload: { userId: string; isAvailable: boolean } }
  | { type: 'USER_LIST_UPDATE'; payload: { technicians: User[]; radiologists: User[] } }
  | { type: 'SESSION_ENDED'; payload: { requestId: string; reason: string } }
  | { type: 'LEAVE'; payload: { role: UserRole } };
