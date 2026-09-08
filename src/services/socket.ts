import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type SocketConnectionState = 'connected' | 'reconnecting' | 'disconnected';

class SocketService {
  private socket: Socket | null = null;
  private stateListeners: Set<(state: SocketConnectionState, detail?: any) => void> = new Set();
  public currentState: SocketConnectionState = 'disconnected';

  connect(token: string) {

    if (this.socket) {
      if (this.socket.connected) return;
      this.socket.disconnect();
    }

    this.currentState = 'reconnecting';
    this.notifyStateChange('reconnecting');

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.currentState = 'connected';
      this.notifyStateChange('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.currentState = 'disconnected';
      this.notifyStateChange('disconnected', reason);
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.currentState = 'reconnecting';
      this.notifyStateChange('reconnecting');
    });

    this.socket.io.on('reconnect', () => {
      this.currentState = 'connected';
      this.notifyStateChange('connected');
    });

    this.socket.on('connect_error', (error) => {
      this.currentState = 'reconnecting';
      this.notifyStateChange('reconnecting', error);
    });
  }

  onStateChange(callback: (state: SocketConnectionState, detail?: any) => void) {
    this.stateListeners.add(callback);
    callback(this.currentState);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  private notifyStateChange(state: SocketConnectionState, detail?: any) {
    this.stateListeners.forEach((cb) => cb(state, detail));
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentState = 'disconnected';
    this.notifyStateChange('disconnected');
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
