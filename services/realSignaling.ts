import { io, Socket } from 'socket.io-client';
import { SignalingEvent } from '../types';

/**
 * Real WebSocket signaling service using Socket.IO.
 * Connects to the backend server for cross-device communication.
 */
class RealSignalingService {
    private socket: Socket;
    private listeners: ((event: SignalingEvent) => void)[] = [];
    private connectionListeners: ((connected: boolean) => void)[] = [];
    private _isConnected: boolean = false;

    constructor(roomId: string, role: string) {
        // Use the current hostname so devices on the same network connect to the same server
        const defaultServerUrl = `http://${window.location.hostname}:3001`;
        const serverUrl = import.meta.env.VITE_SIGNALING_SERVER || defaultServerUrl;

        this.socket = io(serverUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
            console.log('[RealSignaling] Connected to server');
            this._isConnected = true;
            this.notifyConnectionChange(true);

            // Join the room
            this.socket.emit('join', { roomId, role });
        });

        this.socket.on('disconnect', () => {
            console.log('[RealSignaling] Disconnected from server');
            this._isConnected = false;
            this.notifyConnectionChange(false);
        });

        this.socket.on('signal', (event: SignalingEvent) => {
            this.notify(event);
        });

        this.socket.on('room-info', (info: { users: any[] }) => {
            console.log('[RealSignaling] Room info:', info);
        });

        this.socket.on('connect_error', (error) => {
            console.error('[RealSignaling] Connection error:', error.message);
        });
    }

    public get isConnected(): boolean {
        return this._isConnected;
    }

    public getSocket(): Socket {
        return this.socket;
    }

    public send(event: SignalingEvent) {
        if (this._isConnected) {
            this.socket.emit('signal', event);
        }
    }

    public subscribe(callback: (event: SignalingEvent) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    public onConnectionChange(callback: (connected: boolean) => void) {
        this.connectionListeners.push(callback);
        // Immediately notify of current state
        callback(this._isConnected);
        return () => {
            this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
        };
    }

    private notify(event: SignalingEvent) {
        this.listeners.forEach(cb => cb(event));
    }

    private notifyConnectionChange(connected: boolean) {
        this.connectionListeners.forEach(cb => cb(connected));
    }

    public close() {
        this.socket.disconnect();
    }
}

export default RealSignalingService;
