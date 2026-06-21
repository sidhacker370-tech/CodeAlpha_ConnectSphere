import { Server, Socket } from 'socket.io';
import prisma from '../services/db';

interface RoomParticipant {
  socketId: string;
  userId: string;
  userName: string;
}

const roomPeers: Record<string, RoomParticipant[]> = {};

export const setupSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room
    socket.on('join-room', async ({ roomCode, userId, userName }) => {
      if (!roomCode || !userId || !userName) return;
      
      const formattedCode = roomCode.trim().toLowerCase();
      socket.join(formattedCode);

      if (!roomPeers[formattedCode]) {
        roomPeers[formattedCode] = [];
      }

      const exists = roomPeers[formattedCode].some(p => p.socketId === socket.id);
      if (!exists) {
        roomPeers[formattedCode].push({
          socketId: socket.id,
          userId,
          userName,
        });
      }

      console.log(`User ${userName} (${userId}) joined room ${formattedCode}`);

      const peers = roomPeers[formattedCode].filter(p => p.socketId !== socket.id);

      socket.emit('room-users', peers);

      socket.to(formattedCode).emit('user-joined', {
        socketId: socket.id,
        userId,
        userName,
      });
    });

    // Relay WebRTC SDP Offers
    socket.on('webrtc-offer', ({ toSocketId, sdp }) => {
      io.to(toSocketId).emit('webrtc-offer', {
        fromSocketId: socket.id,
        sdp,
      });
    });

    // Relay WebRTC SDP Answers
    socket.on('webrtc-answer', ({ toSocketId, sdp }) => {
      io.to(toSocketId).emit('webrtc-answer', {
        fromSocketId: socket.id,
        sdp,
      });
    });

    // Relay WebRTC ICE Candidates
    socket.on('webrtc-candidate', ({ toSocketId, candidate }) => {
      io.to(toSocketId).emit('webrtc-candidate', {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // Chat Message
    socket.on('send-message', async ({ roomCode, content, senderId, senderName }) => {
      if (!roomCode || !content || !senderId) return;
      const formattedCode = roomCode.trim().toLowerCase();

      try {
        const room = await prisma.room.findUnique({
          where: { roomCode: formattedCode }
        });

        if (room) {
          const dbMessage = await prisma.message.create({
            data: {
              senderId,
              roomId: room.id,
              content,
            }
          });

          io.to(formattedCode).emit('new-message', {
            id: dbMessage.id,
            content: dbMessage.content,
            senderId,
            senderName,
            createdAt: dbMessage.createdAt,
          });
        }
      } catch (error) {
        console.error('Socket message save error:', error);
      }
    });

    // Whiteboard drawing synchronization
    socket.on('draw-line', ({ roomCode, drawing }) => {
      if (!roomCode) return;
      const formattedCode = roomCode.trim().toLowerCase();
      socket.to(formattedCode).emit('draw-line', drawing);
    });

    // Clear Whiteboard
    socket.on('clear-canvas', ({ roomCode }) => {
      if (!roomCode) return;
      const formattedCode = roomCode.trim().toLowerCase();
      socket.to(formattedCode).emit('clear-canvas');
    });

    // Screen sharing signaling
    socket.on('screen-share-started', ({ roomCode }) => {
      if (!roomCode) return;
      const formattedCode = roomCode.trim().toLowerCase();
      socket.to(formattedCode).emit('screen-share-started', { socketId: socket.id });
    });

    socket.on('screen-share-stopped', ({ roomCode }) => {
      if (!roomCode) return;
      const formattedCode = roomCode.trim().toLowerCase();
      socket.to(formattedCode).emit('screen-share-stopped', { socketId: socket.id });
    });

    // File sharing notification
    socket.on('file-shared', ({ roomCode, file }) => {
      if (!roomCode) return;
      const formattedCode = roomCode.trim().toLowerCase();
      socket.to(formattedCode).emit('file-shared', file);
    });

    // User leaving room explicitly
    socket.on('leave-room', ({ roomCode }) => {
      if (!roomCode) return;
      const formattedCode = roomCode.trim().toLowerCase();
      
      socket.leave(formattedCode);
      
      if (roomPeers[formattedCode]) {
        const idx = roomPeers[formattedCode].findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
          const participant = roomPeers[formattedCode][idx];
          roomPeers[formattedCode].splice(idx, 1);
          
          socket.to(formattedCode).emit('user-left', {
            socketId: socket.id,
            userId: participant.userId,
            userName: participant.userName,
          });

          if (roomPeers[formattedCode].length === 0) {
            delete roomPeers[formattedCode];
          }
        }
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      for (const roomCode of Object.keys(roomPeers)) {
        const idx = roomPeers[roomCode].findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
          const participant = roomPeers[roomCode][idx];
          roomPeers[roomCode].splice(idx, 1);
          
          socket.to(roomCode).emit('user-left', {
            socketId: socket.id,
            userId: participant.userId,
            userName: participant.userName,
          });
          
          if (roomPeers[roomCode].length === 0) {
            delete roomPeers[roomCode];
          }
        }
      }
    });
  });
};
