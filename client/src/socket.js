import io from 'socket.io-client';

const sockets = io('http://15.206.171.112:3001/', {
  autoConnect: true,
  forceNew: true,
  transports: ['websocket', 'polling']
});

export default sockets;