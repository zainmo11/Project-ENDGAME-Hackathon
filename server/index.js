import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        service: 'Rology Signaling Server',
        rooms: Array.from(io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('room-'))
    });
});

// Track connected users per room
const roomUsers = new Map();

io.on('connection', (socket) => {
    console.log(`[CONNECT] Client connected: ${socket.id}`);
    let currentRoom = null;

    // Handle joining a room
    socket.on('join', ({ roomId, role }) => {
        currentRoom = `room-${roomId}`;
        socket.join(currentRoom);

        // Track user in room
        if (!roomUsers.has(currentRoom)) {
            roomUsers.set(currentRoom, new Map());
        }
        roomUsers.get(currentRoom).set(socket.id, { role, joinedAt: Date.now() });

        console.log(`[JOIN] ${role} joined room: ${currentRoom} (${roomUsers.get(currentRoom).size} users)`);

        // Notify others in the room
        socket.to(currentRoom).emit('signal', {
            type: 'JOIN',
            payload: { role, roomId }
        });

        // Send current room state to the new user
        socket.emit('room-info', {
            users: Array.from(roomUsers.get(currentRoom).values())
        });
    });

    // Handle all signaling events
    socket.on('signal', (event) => {
        if (currentRoom) {
            console.log(`[SIGNAL] ${event.type} in ${currentRoom}`);
            socket.to(currentRoom).emit('signal', event);
        }
    });

    // WebRTC Signaling for Voice/Video
    socket.on('webrtc-offer', (offer) => {
        if (currentRoom) {
            console.log(`[WEBRTC] Offer from ${socket.id}`);
            socket.to(currentRoom).emit('webrtc-offer', { offer, from: socket.id });
        }
    });

    socket.on('webrtc-answer', ({ answer, to }) => {
        if (currentRoom) {
            console.log(`[WEBRTC] Answer to ${to}`);
            io.to(to).emit('webrtc-answer', { answer, from: socket.id });
        }
    });

    socket.on('webrtc-ice-candidate', ({ candidate, to }) => {
        if (currentRoom) {
            console.log(`[WEBRTC] ICE candidate`);
            if (to) {
                io.to(to).emit('webrtc-ice-candidate', { candidate, from: socket.id });
            } else {
                socket.to(currentRoom).emit('webrtc-ice-candidate', { candidate, from: socket.id });
            }
        }
    });

    // WebRTC Video Signaling (bidirectional)
    socket.on('webrtc-video-offer', ({ offer, role }) => {
        if (currentRoom) {
            console.log(`[WEBRTC VIDEO] Offer from ${role} (${socket.id})`);
            socket.to(currentRoom).emit('webrtc-video-offer', { offer, from: socket.id, senderRole: role });
        }
    });

    socket.on('webrtc-video-answer', ({ answer, to, role }) => {
        if (currentRoom) {
            console.log(`[WEBRTC VIDEO] Answer from ${role} to ${to}`);
            io.to(to).emit('webrtc-video-answer', { answer, from: socket.id, senderRole: role });
        }
    });

    socket.on('webrtc-video-ice-candidate', ({ candidate, to, role }) => {
        if (currentRoom) {
            console.log(`[WEBRTC VIDEO] ICE candidate from ${role}`);
            if (to) {
                io.to(to).emit('webrtc-video-ice-candidate', { candidate, from: socket.id, senderRole: role });
            } else {
                socket.to(currentRoom).emit('webrtc-video-ice-candidate', { candidate, from: socket.id, senderRole: role });
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] Client disconnected: ${socket.id}`);
        if (currentRoom && roomUsers.has(currentRoom)) {
            const user = roomUsers.get(currentRoom).get(socket.id);
            roomUsers.get(currentRoom).delete(socket.id);

            // Notify others about the disconnect
            if (user) {
                io.to(currentRoom).emit('signal', {
                    type: 'LEAVE',
                    payload: { role: user.role }
                });
            }

            // Clean up empty rooms
            if (roomUsers.get(currentRoom).size === 0) {
                roomUsers.delete(currentRoom);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🏥 Rology Signaling Server                         ║
║   Running on port ${PORT}                              ║
║                                                      ║
║   Local:   http://localhost:${PORT}                    ║
║   Network: http://<your-ip>:${PORT}                    ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);
});
