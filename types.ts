export enum UserRole {
  TECH = 'TECH',
  RADIOLOGIST = 'RADIOLOGIST',
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

// Events sent via BroadcastChannel to simulate WebRTC/Socket.io
export type SignalingEvent = 
  | { type: 'JOIN'; payload: { role: UserRole; roomId: string } }
  | { type: 'SYNC_STATE'; payload: Partial<SessionState> }
  | { type: 'CHAT'; payload: ChatMessage }
  | { type: 'ANNOTATION'; payload: Annotation }
  | { type: 'REQUEST_REPORT'; payload: null }
  | { type: 'REPORT_READY'; payload: string };
