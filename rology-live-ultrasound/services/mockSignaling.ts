import { SignalingEvent } from '../types';

/**
 * This service simulates a Socket.io / WebRTC signaling server using 
 * the BroadcastChannel API. This allows multiple tabs (Tech and Rad) 
 * to communicate locally without a running Node.js backend.
 */
class MockSignalingService {
  private channel: BroadcastChannel;
  private listeners: ((event: SignalingEvent) => void)[] = [];

  constructor(roomId: string) {
    this.channel = new BroadcastChannel(`rology-room-${roomId}`);
    this.channel.onmessage = (msg) => {
      this.notify(msg.data as SignalingEvent);
    };
  }

  public send(event: SignalingEvent) {
    this.channel.postMessage(event);
  }

  public subscribe(callback: (event: SignalingEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify(event: SignalingEvent) {
    this.listeners.forEach(cb => cb(event));
  }

  public close() {
    this.channel.close();
  }
}

export default MockSignalingService;