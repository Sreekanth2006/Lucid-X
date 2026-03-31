const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Routes for different interfaces
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/patient', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patient.html'));
});

app.get('/therapist', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'therapist.html'));
});

// Room management
const rooms = new Map();

// Emotion data storage for analytics
const emotionDataStore = new Map(); // sessionId -> array of emotion data

io.on('connection', (socket) => {
    console.log('✅ A user connected with Socket ID:', socket.id);

    // Join room logic
    socket.on('join-room', (roomId) => {
        console.log(`🚪 User ${socket.id} joining room: ${roomId}`);
        socket.join(roomId);
        
        // Track room participants
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);
        
        // Broadcast to everyone else in the room
        socket.to(roomId).emit('user-connected', socket.id);
        
        console.log(`📊 Room ${roomId} now has ${rooms.get(roomId).size} participants`);
    });

    // Route Call Offer
    socket.on('send-offer', ({ offer, receiverId }) => {
        console.log(`📞 Routing offer from ${socket.id} to ${receiverId}`);
        socket.to(receiverId).emit('receive-offer', { offer, callerId: socket.id });
    });

    // Route Call Answer
    socket.on('send-answer', ({ answer, callerId }) => {
        console.log(`✅ Routing answer from ${socket.id} to ${callerId}`);
        socket.to(callerId).emit('receive-answer', answer);
    });

    // Route Network Data
    socket.on('send-ice-candidate', ({ candidate, targetUserId }) => {
        socket.to(targetUserId).emit('receive-ice-candidate', candidate);
    });

    // Handle Emotion Data from Patient
    socket.on('emotion-data', (emotionData) => {
        console.log(`😊 Received emotion data from ${socket.id}:`, emotionData.emotion, `${emotionData.confidence}%`);
        
        // Store emotion data for analytics
        if (emotionData.sessionId) {
            if (!emotionDataStore.has(emotionData.sessionId)) {
                emotionDataStore.set(emotionData.sessionId, []);
            }
            emotionDataStore.get(emotionData.sessionId).push({
                ...emotionData,
                timestamp: Date.now(),
                socketId: socket.id
            });
            
            // Keep only last 1000 emotion records to prevent memory issues
            const sessionData = emotionDataStore.get(emotionData.sessionId);
            if (sessionData.length > 1000) {
                sessionData.splice(0, sessionData.length - 1000);
            }
        }
        
        // Forward emotion data to therapist in the same room
        // Find which room the patient is in
        for (const [roomId, participants] of rooms.entries()) {
            if (participants.has(socket.id)) {
                // Send to all other participants in the room (therapist)
                socket.to(roomId).emit('patient-emotion-update', emotionData);
                console.log(`📤 Forwarded emotion data to room ${roomId}`);
                break;
            }
        }
    });

    // Get emotion analytics endpoint
    socket.on('get-emotion-analytics', (sessionId) => {
        if (emotionDataStore.has(sessionId)) {
            const data = emotionDataStore.get(sessionId);
            socket.emit('emotion-analytics-response', {
                sessionId,
                data,
                totalRecords: data.length
            });
        } else {
            socket.emit('emotion-analytics-response', {
                sessionId,
                data: [],
                totalRecords: 0
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        
        // Find and remove user from all rooms
        for (const [roomId, participants] of rooms.entries()) {
            if (participants.has(socket.id)) {
                participants.delete(socket.id);
                socket.to(roomId).emit('user-disconnected', socket.id);
                console.log(`📊 User ${socket.id} left room ${roomId}. ${participants.size} participants remaining`);
                
                // Clean up empty rooms
                if (participants.size === 0) {
                    rooms.delete(roomId);
                    console.log(`🧹 Cleaned up empty room: ${roomId}`);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Lucid-X Server running on http://localhost:${PORT}`);
});