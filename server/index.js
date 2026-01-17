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

// ============================================
// DATA STORES
// ============================================

// Track all connected users: socketId -> User
const connectedUsers = new Map();

// Track session requests: requestId -> SessionRequest
const sessionRequests = new Map();

// Track room assignments: assignmentId -> RoomAssignment
const roomAssignments = new Map();

// Track connected users per room
const roomUsers = new Map();

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get all users by role
const getUsersByRole = (role) => {
    return Array.from(connectedUsers.values()).filter(u => u.role === role);
};

// Get available radiologists
const getAvailableRadiologists = () => {
    return getUsersByRole('RADIOLOGIST').filter(u => u.isAvailable);
};

// Broadcast user list update to all medical admins
const broadcastUserListToAdmins = () => {
    const technicians = getUsersByRole('TECH');
    const radiologists = getUsersByRole('RADIOLOGIST');
    
    getUsersByRole('MEDICAL_ADMIN').forEach(admin => {
        io.to(admin.socketId).emit('signal', {
            type: 'USER_LIST_UPDATE',
            payload: { technicians, radiologists }
        });
    });
};

// Broadcast session requests to all medical admins
const broadcastSessionRequestsToAdmins = () => {
    const requests = Array.from(sessionRequests.values());
    
    getUsersByRole('MEDICAL_ADMIN').forEach(admin => {
        io.to(admin.socketId).emit('session-requests-update', requests);
    });
};

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        service: 'Rology Signaling Server',
        rooms: Array.from(io.sockets.adapter.rooms.keys()).filter(r => r.startsWith('room-')),
        connectedUsers: connectedUsers.size,
        sessionRequests: sessionRequests.size
    });
});

// ============================================
// SOCKET HANDLERS
// ============================================

io.on('connection', (socket) => {
    console.log(`[CONNECT] Client connected: ${socket.id}`);
    let currentRoom = null;
    let currentUser = null;

    // ----------------------------------------
    // USER REGISTRATION
    // ----------------------------------------
    socket.on('register', ({ userId, userName, role }) => {
        currentUser = {
            id: userId,
            name: userName,
            role: role,
            isAvailable: role === 'RADIOLOGIST' ? true : false,
            socketId: socket.id
        };
        connectedUsers.set(socket.id, currentUser);
        
        console.log(`[REGISTER] ${role} registered: ${userName} (${userId})`);
        
        // Broadcast updated user list to medical admins
        broadcastUserListToAdmins();
        
        // If medical admin, send them current session requests
        if (role === 'MEDICAL_ADMIN') {
            socket.emit('session-requests-update', Array.from(sessionRequests.values()));
        }
    });

    // ----------------------------------------
    // AVAILABILITY (RADIOLOGIST ONLY)
    // ----------------------------------------
    socket.on('set-availability', ({ available }) => {
        if (currentUser && currentUser.role === 'RADIOLOGIST') {
            currentUser.isAvailable = available;
            connectedUsers.set(socket.id, currentUser);
            
            console.log(`[AVAILABILITY] ${currentUser.name} is now ${available ? 'AVAILABLE' : 'UNAVAILABLE'}`);
            
            // Broadcast updated user list
            broadcastUserListToAdmins();
        }
    });

    // ----------------------------------------
    // SESSION REQUESTS (TECHNICIAN -> ADMIN)
    // ----------------------------------------
    socket.on('create-session-request', ({ technicianId, technicianName }) => {
        const requestId = generateId();
        const roomId = `US-${Date.now().toString().slice(-4)}`;
        
        const request = {
            id: requestId,
            technicianId,
            technicianName,
            status: 'PENDING',
            roomId,
            createdAt: Date.now()
        };
        
        sessionRequests.set(requestId, request);
        
        console.log(`[SESSION REQUEST] ${technicianName} requested a session (${requestId})`);
        
        // Notify technician that request was created
        socket.emit('signal', {
            type: 'SESSION_REQUEST',
            payload: request
        });
        
        // Broadcast to all medical admins
        broadcastSessionRequestsToAdmins();
    });

    // ----------------------------------------
    // ASSIGN RADIOLOGIST (ADMIN ACTION)
    // ----------------------------------------
    socket.on('assign-radiologist', ({ requestId, radiologistId, radiologistName }) => {
        const request = sessionRequests.get(requestId);
        if (!request) {
            console.log(`[ERROR] Session request ${requestId} not found`);
            return;
        }
        
        // Find the radiologist socket
        const radiologist = Array.from(connectedUsers.values()).find(u => u.id === radiologistId);
        if (!radiologist) {
            console.log(`[ERROR] Radiologist ${radiologistId} not found`);
            return;
        }
        
        // Update request status
        request.status = 'ASSIGNED';
        request.assignedRadiologistId = radiologistId;
        request.assignedRadiologistName = radiologistName;
        sessionRequests.set(requestId, request);
        
        // Create room assignment
        const assignmentId = generateId();
        const assignment = {
            id: assignmentId,
            roomId: request.roomId,
            technicianId: request.technicianId,
            technicianName: request.technicianName,
            radiologistId,
            status: 'PENDING'
        };
        roomAssignments.set(assignmentId, assignment);
        
        console.log(`[ASSIGN] Admin assigned ${radiologistName} to ${request.technicianName}`);
        
        // Notify the technician
        const technician = Array.from(connectedUsers.values()).find(u => u.id === request.technicianId);
        if (technician) {
            io.to(technician.socketId).emit('signal', {
                type: 'SESSION_ASSIGNED',
                payload: request
            });
        }
        
        // Send room invite to radiologist
        io.to(radiologist.socketId).emit('signal', {
            type: 'ROOM_INVITE',
            payload: assignment
        });
        
        // Update all admins
        broadcastSessionRequestsToAdmins();
    });

    // ----------------------------------------
    // RESPOND TO ASSIGNMENT (RADIOLOGIST)
    // ----------------------------------------
    socket.on('respond-to-assignment', ({ assignmentId, accept, comment }) => {
        const assignment = roomAssignments.get(assignmentId);
        if (!assignment) {
            console.log(`[ERROR] Assignment ${assignmentId} not found`);
            return;
        }
        
        if (accept) {
            assignment.status = 'ACCEPTED';
            roomAssignments.set(assignmentId, assignment);
            
            // Find the session request and mark as active
            const request = Array.from(sessionRequests.values()).find(r => r.roomId === assignment.roomId);
            if (request) {
                request.status = 'ACTIVE';
                sessionRequests.set(request.id, request);
            }
            
            console.log(`[ACCEPTED] ${currentUser?.name} accepted room ${assignment.roomId}`);
            
            // Notify the technician
            const technician = Array.from(connectedUsers.values()).find(u => u.id === assignment.technicianId);
            if (technician) {
                io.to(technician.socketId).emit('signal', {
                    type: 'ROOM_ACCEPTED',
                    payload: { 
                        assignmentId, 
                        radiologistId: currentUser?.id,
                        roomId: assignment.roomId // Added roomId here
                    }
                });
            }
            
            // Send room info to radiologist so they can join
            socket.emit('join-room', { roomId: assignment.roomId });
            
        } else {
            assignment.status = 'REJECTED';
            assignment.rejectionComment = comment;
            roomAssignments.set(assignmentId, assignment);
            
            console.log(`[REJECTED] ${currentUser?.name} rejected room ${assignment.roomId}: ${comment}`);
            
            // Update session request status back to pending
            const request = Array.from(sessionRequests.values()).find(r => r.roomId === assignment.roomId);
            if (request) {
                request.status = 'PENDING';
                request.assignedRadiologistId = undefined;
                request.assignedRadiologistName = undefined;
                request.rejectionComment = comment;
                sessionRequests.set(request.id, request);
            }
            
            // Notify all medical admins about rejection
            getUsersByRole('MEDICAL_ADMIN').forEach(admin => {
                io.to(admin.socketId).emit('signal', {
                    type: 'ROOM_REJECTED',
                    payload: {
                        assignmentId,
                        radiologistId: currentUser?.id,
                        radiologistName: currentUser?.name,
                        comment
                    }
                });
            });
        }
        
        // Update all admins
        broadcastSessionRequestsToAdmins();
    });

    // ----------------------------------------
    // LEAVE SESSION (TECH/RAD ACTION)
    // ----------------------------------------
    socket.on('leave-session', ({ roomId }) => {
        console.log(`[LEAVE SESSION] ${currentUser?.name} leaving room ${roomId}`);
        
        // Find session request for this room
        const request = Array.from(sessionRequests.values()).find(r => r.roomId === roomId);
        
        if (request) {
            // If request exists, we can treat it same as "end-session" logic
            // Re-use the existing end-session logic by manually triggering it internally
            // Or just duplicate functionality for clarity
            
            // Notify other party
            socket.to(`room-${roomId}`).emit('signal', {
                type: 'SESSION_ENDED',
                payload: { requestId: request.id, reason: `${currentUser?.name} left the session` }
            });
            
            // Cleanup
            sessionRequests.delete(request.id);
            
            // Find radiologist and make available
            if (request.assignedRadiologistId) {
                const radiologist = Array.from(connectedUsers.values()).find(u => u.id === request.assignedRadiologistId);
                if (radiologist) {
                    radiologist.isAvailable = true;
                    connectedUsers.set(radiologist.socketId, radiologist);
                }
            }
            
            // Clean up room assignments
            for (const [assignmentId, assignment] of roomAssignments) {
                if (assignment.roomId === roomId) {
                    roomAssignments.delete(assignmentId);
                }
            }
            
            // Broadcast updates
            broadcastSessionRequestsToAdmins();
            broadcastUserListToAdmins();
            
            // Clean up room in memory
            const roomName = `room-${roomId}`;
            if (roomUsers.has(roomName)) {
                roomUsers.delete(roomName);
            }
            
            // Acknowledge to sender (in case they don't get the broadcast)
            socket.emit('signal', {
                type: 'SESSION_ENDED',
                payload: { requestId: request.id, reason: 'You ended the session' }
            });
        }
    });

    // ----------------------------------------
    // END SESSION (ADMIN ACTION)
    // ----------------------------------------
    socket.on('end-session', ({ requestId }) => {
        console.log(`[END SESSION] Received end-session request for: ${requestId}`);
        console.log(`[END SESSION] Current session requests:`, Array.from(sessionRequests.keys()));
        
        const request = sessionRequests.get(requestId);
        if (!request) {
            console.log(`[ERROR] Session request ${requestId} not found in sessionRequests map`);
            return;
        }
        
        console.log(`[END SESSION] Admin ending session ${requestId} for room ${request.roomId}`);
        
        // Find the technician and radiologist
        const technician = Array.from(connectedUsers.values()).find(u => u.id === request.technicianId);
        const radiologist = Array.from(connectedUsers.values()).find(u => u.id === request.assignedRadiologistId);
        
        // Notify technician
        if (technician) {
            io.to(technician.socketId).emit('signal', {
                type: 'SESSION_ENDED',
                payload: { requestId, reason: 'Session ended by admin' }
            });
        }
        
        // Notify radiologist
        if (radiologist) {
            io.to(radiologist.socketId).emit('signal', {
                type: 'SESSION_ENDED',
                payload: { requestId, reason: 'Session ended by admin' }
            });
            // Make radiologist available again
            radiologist.isAvailable = true;
            connectedUsers.set(radiologist.socketId, radiologist);
        }
        
        // Remove the session request
        sessionRequests.delete(requestId);
        
        // Clean up room assignments for this room
        for (const [assignmentId, assignment] of roomAssignments) {
            if (assignment.roomId === request.roomId) {
                roomAssignments.delete(assignmentId);
            }
        }
        
        // Clean up the room
        const roomName = `room-${request.roomId}`;
        if (roomUsers.has(roomName)) {
            roomUsers.delete(roomName);
        }
        
        // Broadcast updates
        broadcastSessionRequestsToAdmins();
        broadcastUserListToAdmins();
    });

    // ----------------------------------------
    // GET DATA ENDPOINTS
    // ----------------------------------------
    socket.on('get-users', (callback) => {
        const technicians = getUsersByRole('TECH');
        const radiologists = getUsersByRole('RADIOLOGIST');
        callback({ technicians, radiologists });
    });

    socket.on('get-session-requests', (callback) => {
        callback(Array.from(sessionRequests.values()));
    });

    socket.on('get-available-radiologists', (callback) => {
        callback(getAvailableRadiologists());
    });

    // ----------------------------------------
    // ROOM JOINING (existing functionality)
    // ----------------------------------------
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
            payload: { role, roomId, userId: currentUser?.id, userName: currentUser?.name }
        });

        // Send current room state to the new user
        socket.emit('room-info', {
            users: Array.from(roomUsers.get(currentRoom).values())
        });
    });

    // ----------------------------------------
    // SIGNALING (existing functionality)
    // ----------------------------------------
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

    // ----------------------------------------
    // DISCONNECT
    // ----------------------------------------
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] Client disconnected: ${socket.id}`);
        
        // Remove from connected users
        const user = connectedUsers.get(socket.id);
        connectedUsers.delete(socket.id);
        
        // If technician disconnects, close any active sessions they were in
        if (user && user.role === 'TECH') {
            // Find any session requests for this technician
            for (const [requestId, request] of sessionRequests) {
                if (request.technicianId === user.id && (request.status === 'ACTIVE' || request.status === 'ASSIGNED')) {
                    console.log(`[AUTO-END] Technician ${user.name} left, ending session ${requestId}`);
                    
                    // Notify the radiologist
                    if (request.assignedRadiologistId) {
                        const radiologist = Array.from(connectedUsers.values()).find(u => u.id === request.assignedRadiologistId);
                        if (radiologist) {
                            io.to(radiologist.socketId).emit('signal', {
                                type: 'SESSION_ENDED',
                                payload: { requestId, reason: 'Technician left the session' }
                            });
                            // Make radiologist available again
                            radiologist.isAvailable = true;
                            connectedUsers.set(radiologist.socketId, radiologist);
                        }
                    }
                    
                    // Notify admins
                    getUsersByRole('MEDICAL_ADMIN').forEach(admin => {
                        io.to(admin.socketId).emit('signal', {
                            type: 'SESSION_ENDED',
                            payload: { requestId, reason: 'Technician disconnected' }
                        });
                    });
                    
                    // Remove session
                    sessionRequests.delete(requestId);
                    
                    // Clean up room assignments
                    for (const [assignmentId, assignment] of roomAssignments) {
                        if (assignment.roomId === request.roomId) {
                            roomAssignments.delete(assignmentId);
                        }
                    }
                }
            }
        }
        
        // Clean up room
        if (currentRoom && roomUsers.has(currentRoom)) {
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
        
        // Broadcast updated user list to medical admins
        broadcastUserListToAdmins();
        broadcastSessionRequestsToAdmins();
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
║   Features:                                          ║
║   • User Registration & Availability                 ║
║   • Session Request Management                       ║
║   • Room Assignment Workflow                         ║
║   • Real-time Notifications                          ║
║                                                      ║
║   Local:   http://localhost:${PORT}                    ║
║   Network: http://<your-ip>:${PORT}                    ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);
});
