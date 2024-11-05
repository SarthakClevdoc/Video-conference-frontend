import io from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://15.206.171.112:3001/';

const sockets = io(SOCKET_SERVER_URL, {
  autoConnect: true,
  forceNew: false, // Changed to false to prevent multiple connections
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000, // Increased timeout
  withCredentials: true
});

sockets.on('connect', () => {
  console.log('Socket connected successfully. Socket ID:', sockets.id);
});

sockets.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
});

sockets.on('disconnect', (reason) => {
  console.log('Socket disconnected. Reason:', reason);
  // Attempt to reconnect on disconnect
  if (reason === "io server disconnect") {
    // the disconnection was initiated by the server, reconnect manually
    sockets.connect();
  }
});

sockets.on('reconnect', (attemptNumber) => {
  console.log('Socket reconnected after', attemptNumber, 'attempts');
});

sockets.on('reconnect_attempt', (attemptNumber) => {
  console.log('Socket reconnection attempt:', attemptNumber);
});

sockets.on('error', (error) => {
  console.error('Socket error:', error);
});

export default sockets;