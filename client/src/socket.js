import { io } from 'socket.io-client';

const socket = io('/', { withCredentials: true, autoConnect: false });

export default socket;

export function joinRoom(roomId) {
  if (!socket.connected) socket.connect();
  socket.emit('join:room', roomId);
}

export function leaveRoom(roomId) {
  socket.emit('leave:room', roomId);
}
