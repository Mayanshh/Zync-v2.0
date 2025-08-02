
// Socket module
export class SocketModule {
  constructor() {
    this.socket = null;
    this.connectionState = {
      authenticated: false,
      reconnectCount: 0,
      lastHeartbeat: Date.now(),
      heartbeatInterval: null
    };
  }

  async connect(userId) {
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
      await this.loadSocketIO();
    }

    this.socket = io({
      auth: { userId },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 15000,
      transports: ['websocket', 'polling'],
      upgrade: true,
      withCredentials: true
    });

    this.setupEventListeners(userId);
    return this.socket;
  }

  async loadSocketIO() {
    return new Promise((resolve, reject) => {
      if (typeof io !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setTimeout(() => {
          if (typeof io !== 'undefined') {
            resolve();
          } else {
            reject(new Error('Socket.IO failed to load'));
          }
        }, 100);
      };

      script.onerror = () => reject(new Error('Socket.IO script failed to load'));
      document.head.appendChild(script);
    });
  }

  setupEventListeners(userId) {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.socket.emit('authenticate', userId);
    });

    this.socket.on('auth_success', () => {
      this.connectionState.authenticated = true;
      console.log('Socket authenticated successfully');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.connectionState.authenticated = false;
    });
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
